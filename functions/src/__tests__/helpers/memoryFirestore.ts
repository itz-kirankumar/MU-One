/**
 * An in-memory stand-in for Firestore, sufficient for the Founder Connect
 * service tests: document get/set/update/delete, equality and array-contains
 * filters, multi-field ordering, snapshot cursors, and serialised transactions
 * whose writes only land when the callback resolves.
 *
 * It is deliberately small. Anything it cannot express — collection-group
 * queries, inequality filters — is not used by the service, and adding it here
 * before the service needs it would just be a second implementation to keep
 * honest.
 */

import type { Firestore } from 'firebase-admin/firestore';

export type Doc = Record<string, unknown>;

const clone = <T>(value: T): T => structuredClone(value);

/** Reads `a.b.c` out of a document, for the dotted field paths queries use. */
function readPath(data: Doc | undefined, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (value, key) => (value && typeof value === 'object' ? (value as Doc)[key] : undefined),
    data,
  );
}

/** Writes `a.b.c`, creating the intermediate objects an update implies. */
function writePath(data: Doc, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop() as string;
  let cursor: Doc = data;
  for (const key of keys) {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Doc;
  }
  cursor[last] = value;
}

export class MemoryStore {
  readonly documents = new Map<string, Doc>();
  private sequence = 0;
  private queue: Promise<unknown> = Promise.resolve();

  nextId(): string {
    this.sequence += 1;
    return `auto${String(this.sequence).padStart(16, '0')}`;
  }

  reset(): void {
    this.documents.clear();
    this.sequence = 0;
    this.queue = Promise.resolve();
  }

  get<T = Doc>(path: string): T | undefined {
    const value = this.documents.get(path);
    return value === undefined ? undefined : (clone(value) as T);
  }

  seed(path: string, data: Doc): void {
    this.documents.set(path, clone(data));
  }

  /** Paths of the documents directly inside a collection, in insertion order. */
  children(collectionPath: string): string[] {
    const depth = collectionPath.split('/').length + 1;
    return [...this.documents.keys()].filter(
      (path) => path.startsWith(`${collectionPath}/`) && path.split('/').length === depth,
    );
  }

  serialise<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(work);
    this.queue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  asFirestore(): Firestore {
    const store = this;
    return {
      collection: (path: string) => new MemoryQuery(store, path),
      getAll: (...refs: MemoryRef[]) => Promise.all(refs.map((ref) => ref.get())),
      runTransaction: <T>(callback: (tx: MemoryTransaction) => Promise<T>) => store.serialise(async () => {
        const writes: Array<() => void> = [];
        const result = await callback({
          get: (ref: MemoryRef) => ref.get(),
          create: (ref: MemoryRef, data: Doc) => {
            if (store.documents.has(ref.path)) throw new Error(`Already exists: ${ref.path}`);
            writes.push(() => store.documents.set(ref.path, clone(data)));
          },
          set: (ref: MemoryRef, data: Doc) => {
            writes.push(() => store.documents.set(ref.path, clone(data)));
          },
          update: (ref: MemoryRef, data: Doc) => {
            writes.push(() => {
              const existing = store.documents.get(ref.path);
              if (!existing) throw new Error(`No document to update: ${ref.path}`);
              const next = clone(existing);
              for (const [key, value] of Object.entries(data)) writePath(next, key, clone(value));
              store.documents.set(ref.path, next);
            });
          },
          delete: (ref: MemoryRef) => {
            writes.push(() => store.documents.delete(ref.path));
          },
        });
        writes.forEach((write) => write());
        return result;
      }),
    } as unknown as Firestore;
  }
}

export interface MemoryTransaction {
  get(ref: MemoryRef): Promise<MemorySnapshot>;
  create(ref: MemoryRef, data: Doc): void;
  set(ref: MemoryRef, data: Doc): void;
  update(ref: MemoryRef, data: Doc): void;
  delete(ref: MemoryRef): void;
}

export class MemorySnapshot {
  readonly value: Doc | undefined;

  constructor(readonly ref: MemoryRef) {
    const stored = ref.store.documents.get(ref.path);
    this.value = stored === undefined ? undefined : clone(stored);
  }

  get id(): string { return this.ref.id; }
  get exists(): boolean { return this.value !== undefined; }
  data(): Doc | undefined { return this.value; }
}

export class MemoryRef {
  constructor(readonly store: MemoryStore, readonly path: string) {}

  get id(): string { return this.path.split('/').pop() as string; }

  collection(name: string): MemoryQuery { return new MemoryQuery(this.store, `${this.path}/${name}`); }

  async get(): Promise<MemorySnapshot> { return new MemorySnapshot(this); }

  async set(data: Doc): Promise<void> { this.store.documents.set(this.path, clone(data)); }

  async update(data: Doc): Promise<void> {
    const existing = this.store.documents.get(this.path);
    if (!existing) throw new Error(`No document to update: ${this.path}`);
    const next = clone(existing);
    for (const [key, value] of Object.entries(data)) writePath(next, key, clone(value));
    this.store.documents.set(this.path, next);
  }

  async delete(): Promise<void> { this.store.documents.delete(this.path); }
}

type Condition = { field: string; op: string; value: unknown };

export class MemoryQuery {
  private conditions: Condition[] = [];
  private orders: Array<[string, string]> = [];
  private maximum = Infinity;
  private cursor: MemorySnapshot | undefined;

  constructor(readonly store: MemoryStore, readonly path: string) {}

  doc(id?: string): MemoryRef {
    return new MemoryRef(this.store, `${this.path}/${id ?? this.store.nextId()}`);
  }

  private clone(): MemoryQuery {
    const copy = new MemoryQuery(this.store, this.path);
    copy.conditions = [...this.conditions];
    copy.orders = [...this.orders];
    copy.maximum = this.maximum;
    copy.cursor = this.cursor;
    return copy;
  }

  where(field: string, op: string, value: unknown): MemoryQuery {
    const next = this.clone();
    next.conditions.push({ field, op, value });
    return next;
  }

  orderBy(field: unknown, direction = 'asc'): MemoryQuery {
    const next = this.clone();
    next.orders.push([typeof field === 'string' ? field : '__name__', direction]);
    return next;
  }

  limit(max: number): MemoryQuery {
    const next = this.clone();
    next.maximum = max;
    return next;
  }

  startAfter(cursor: MemorySnapshot): MemoryQuery {
    const next = this.clone();
    next.cursor = cursor;
    return next;
  }

  private matches(snapshot: MemorySnapshot): boolean {
    return this.conditions.every(({ field, op, value }) => {
      const actual = readPath(snapshot.data(), field);
      if (op === 'array-contains') return Array.isArray(actual) && actual.includes(value);
      return actual === value;
    });
  }

  private compare(a: MemorySnapshot, b: MemorySnapshot): number {
    for (const [key, direction] of this.orders) {
      const left = key === '__name__' ? a.id : String(readPath(a.data(), key) ?? '');
      const right = key === '__name__' ? b.id : String(readPath(b.data(), key) ?? '');
      const order = left < right ? -1 : left > right ? 1 : 0;
      if (order) return direction === 'desc' ? -order : order;
    }
    return 0;
  }

  async get(): Promise<{ docs: MemorySnapshot[]; empty: boolean }> {
    let docs = this.store.children(this.path)
      .map((path) => new MemorySnapshot(new MemoryRef(this.store, path)))
      .filter((snapshot) => this.matches(snapshot));

    if (this.orders.length) docs.sort((a, b) => this.compare(a, b));
    if (this.cursor) {
      const cursor = this.cursor;
      docs = docs.filter((doc) => this.compare(doc, cursor) > 0);
    }
    const page = docs.slice(0, this.maximum);
    return { docs: page, empty: page.length === 0 };
  }
}
