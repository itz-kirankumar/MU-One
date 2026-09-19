import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface TestmailMessage {
  id: string;
  tag: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  receivedAt: string;
  dueDate: string | null;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
}

async function testmailCall<T>(data: Record<string, unknown>): Promise<T> {
  const result = await httpsCallable<Record<string, unknown>, T>(functions, 'testmailPortal')(data);
  return result.data;
}

export const testmailApi = {
  address: (tag: string) => testmailCall<{ address: string }>({ action: 'address', tag }),
  list: (options: { tag?: string; tagPrefix?: string; offset?: number; limit?: number; liveQuery?: boolean } = {}) =>
    testmailCall<{ messages: TestmailMessage[]; count: number; limit: number; offset: number }>({ action: 'list', ...options }),
};

export function testmailError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('permission-denied')) return 'This inbox is restricted to configured Email QA administrators.';
  if (code.includes('failed-precondition')) return error instanceof Error ? error.message : 'Testmail configuration is incomplete.';
  return error instanceof Error ? error.message : 'Could not reach Testmail. Please try again.';
}
