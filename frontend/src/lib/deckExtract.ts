'use client';

import {
  MAX_DECK_CHARS,
  MAX_DECK_FILE_BYTES,
  MAX_DECK_SLIDES,
  MAX_SLIDE_CHARS,
  type DeckFormat,
  type ExtractedDeck,
  type ExtractedSlide,
} from '@/types/checkpoint';

/**
 * Decks are read in the browser and only their text is sent onward. Uploading the
 * raw file would blow past the serverless body limit on a normal 20 MB deck and
 * would put student coursework on a third-party server for no benefit.
 */

const MAX_NOTES_CHARS = 1_500;

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NOTES_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide';

/** Placeholders that carry chrome rather than argument. */
const IGNORED_PLACEHOLDERS = new Set(['sldNum', 'ftr', 'dt']);

export class DeckExtractError extends Error {}

export function deckFormatFor(file: File): DeckFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pptx')) return 'pptx';
  if (name.endsWith('.pdf')) return 'pdf';
  return null;
}

const collapse = (value: string) =>
  value.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export async function extractDeck(file: File): Promise<ExtractedDeck> {
  const format = deckFormatFor(file);
  if (!format) throw new DeckExtractError('Upload a .pptx or .pdf file. Other formats cannot be read.');
  if (file.size === 0) throw new DeckExtractError('That file is empty.');
  if (file.size > MAX_DECK_FILE_BYTES) {
    throw new DeckExtractError(`That file is ${(file.size / 1_000_000).toFixed(1)} MB. The limit is 25 MB — export a compressed copy and retry.`);
  }

  const buffer = await file.arrayBuffer();
  const raw = format === 'pptx' ? await extractPptx(buffer) : await extractPdf(buffer);
  if (!raw.length) throw new DeckExtractError('No slides could be read from that file. It may be corrupt or password-protected.');

  let truncated = raw.length > MAX_DECK_SLIDES;
  const slides: ExtractedSlide[] = [];
  let budget = MAX_DECK_CHARS;

  for (const slide of raw.slice(0, MAX_DECK_SLIDES)) {
    const text = collapse(slide.text).slice(0, MAX_SLIDE_CHARS);
    const notes = collapse(slide.notes).slice(0, MAX_NOTES_CHARS);
    const cost = text.length + notes.length;
    if (cost > budget) {
      truncated = true;
      break;
    }
    budget -= cost;
    slides.push({
      index: slides.length + 1,
      title: collapse(slide.title).slice(0, 300),
      text,
      notes,
      minFontPt: slide.minFontPt,
      imageCount: slide.imageCount,
    });
  }

  if (!slides.length) throw new DeckExtractError('The first slide alone exceeds the text limit. Split the deck and retry.');

  const emptySlides = slides.filter((slide) => !slide.title && slide.text.replace(/\s/g, '').length < 12).map((slide) => slide.index);

  return {
    fileName: file.name.slice(0, 200),
    format,
    slides,
    emptySlides,
    textPoor: emptySlides.length > slides.length / 2,
    truncated,
  };
}

interface RawSlide {
  title: string;
  text: string;
  notes: string;
  minFontPt: number | null;
  imageCount: number | null;
}

// ─── PPTX ─────────────────────────────────────────────────────────────────────

/** Nearest placeholder type governing a paragraph, walking up through groups. */
function placeholderType(node: Element): string | null {
  for (let current: Element | null = node; current; current = current.parentElement) {
    if (current.namespaceURI === P_NS && current.localName === 'sp') {
      const ph = current.getElementsByTagNameNS(P_NS, 'ph')[0];
      return ph?.getAttribute('type') ?? 'body';
    }
  }
  return null;
}

function paragraphText(paragraph: Element): { text: string; minFontPt: number | null } {
  let text = '';
  let minFontPt: number | null = null;
  for (const child of Array.from(paragraph.children)) {
    if (child.namespaceURI !== A_NS) continue;
    if (child.localName === 'br') {
      text += '\n';
      continue;
    }
    // a:fld holds auto-generated values such as slide numbers; a:r holds authored text.
    if (child.localName !== 'r') continue;
    const run = Array.from(child.getElementsByTagNameNS(A_NS, 't')).map((node) => node.textContent ?? '').join('');
    if (!run.trim()) continue;
    text += run;
    const size = Number(child.getElementsByTagNameNS(A_NS, 'rPr')[0]?.getAttribute('sz'));
    if (Number.isFinite(size) && size > 0) {
      const points = size / 100;
      minFontPt = minFontPt === null ? points : Math.min(minFontPt, points);
    }
  }
  return { text, minFontPt };
}

function readSlideXml(xml: string): Omit<RawSlide, 'notes'> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new DeckExtractError('A slide inside the file is malformed and could not be read.');
  const titleParts: string[] = [];
  const bodyParts: string[] = [];
  let minFontPt: number | null = null;

  for (const paragraph of Array.from(doc.getElementsByTagNameNS(A_NS, 'p'))) {
    const type = placeholderType(paragraph);
    if (type && IGNORED_PLACEHOLDERS.has(type)) continue;
    const { text, minFontPt: size } = paragraphText(paragraph);
    if (!text.trim()) continue;
    if (size !== null) minFontPt = minFontPt === null ? size : Math.min(minFontPt, size);
    (type === 'title' || type === 'ctrTitle' ? titleParts : bodyParts).push(text);
  }

  // A deck without title placeholders still has a leading line that acts as one.
  const title = titleParts.join(' ') || bodyParts[0] || '';
  return {
    title,
    text: (titleParts.length ? bodyParts : bodyParts.slice(1)).join('\n'),
    minFontPt,
    imageCount: doc.getElementsByTagNameNS(P_NS, 'pic').length,
  };
}

function readNotesXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return '';
  const parts: string[] = [];
  for (const paragraph of Array.from(doc.getElementsByTagNameNS(A_NS, 'p'))) {
    const type = placeholderType(paragraph);
    if (type && IGNORED_PLACEHOLDERS.has(type)) continue;
    const { text } = paragraphText(paragraph);
    if (text.trim()) parts.push(text);
  }
  return parts.join('\n');
}

/** Resolve a relationship target against the folder holding its .rels owner. */
function resolveTarget(ownerPath: string, target: string): string {
  const base = ownerPath.split('/').slice(0, -1);
  const segments = target.replace(/^\.\//, '').split('/');
  for (const segment of segments) {
    if (segment === '..') base.pop();
    else if (segment && segment !== '.') base.push(segment);
  }
  return base.join('/');
}

async function extractPptx(buffer: ArrayBuffer): Promise<RawSlide[]> {
  const { default: JSZip } = await import('jszip');
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new DeckExtractError('That .pptx could not be opened. If it is password-protected, save an unprotected copy first.');
  }

  const read = async (path: string) => {
    const entry = zip.file(path);
    return entry ? entry.async('string') : null;
  };

  const parseRels = (xml: string | null, ownerPath: string) => {
    const map = new Map<string, { target: string; type: string }>();
    if (!xml) return map;
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    for (const rel of Array.from(doc.getElementsByTagNameNS(PKG_REL_NS, 'Relationship'))) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (!id || !target || /^https?:/i.test(target)) continue;
      map.set(id, { target: resolveTarget(ownerPath, target), type: rel.getAttribute('Type') ?? '' });
    }
    return map;
  };

  // Presentation order is authoritative: PowerPoint keeps original file numbers
  // when slides are reordered, so sorting slide1..slideN would shuffle the deck.
  let paths: string[] = [];
  const presentationRels = parseRels(await read('ppt/_rels/presentation.xml.rels'), 'ppt/presentation.xml');
  const presentation = await read('ppt/presentation.xml');
  if (presentation && presentationRels.size) {
    const doc = new DOMParser().parseFromString(presentation, 'application/xml');
    for (const id of Array.from(doc.getElementsByTagNameNS(P_NS, 'sldId'))) {
      const target = presentationRels.get(id.getAttributeNS(R_NS, 'id') ?? '')?.target;
      if (target && zip.file(target)) paths.push(target);
    }
  }
  if (!paths.length) {
    paths = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => Number(a.match(/(\d+)/)![1]) - Number(b.match(/(\d+)/)![1]));
  }
  if (!paths.length) throw new DeckExtractError('No slides were found inside that .pptx.');

  const slides: RawSlide[] = [];
  for (const path of paths.slice(0, MAX_DECK_SLIDES + 1)) {
    const xml = await read(path);
    if (xml === null) continue;
    const slide = readSlideXml(xml);
    const rels = parseRels(await read(path.replace(/([^/]+)$/, '_rels/$1.xml.rels')), path);
    const notesPath = [...rels.values()].find((rel) => rel.type === NOTES_REL)?.target;
    const notesXml = notesPath ? await read(notesPath) : null;
    slides.push({ ...slide, notes: notesXml ? readNotesXml(notesXml) : '' });
  }
  return slides;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

let workerConfigured = false;

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured) {
    // Bundler-emitted asset URL; keeps the worker local instead of reaching for a CDN.
    const { PDF_WORKER_SRC } = await import('@/lib/pdfWorkerSrc');
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    workerConfigured = true;
  }
  return pdfjs;
}

async function extractPdf(buffer: ArrayBuffer): Promise<RawSlide[]> {
  const pdfjs = await loadPdfjs();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new DeckExtractError(
      /password/i.test(message)
        ? 'That PDF is password-protected. Save an unprotected copy and retry.'
        : 'That PDF could not be opened. It may be corrupt.'
    );
  }

  try {
    const slides: RawSlide[] = [];
    for (let page = 1; page <= Math.min(pdf.numPages, MAX_DECK_SLIDES + 1); page += 1) {
      const loaded = await pdf.getPage(page);
      try {
        const content = await loaded.getTextContent();
        const lines: string[] = [];
        let current = '';
        let minFontPt: number | null = null;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          current += item.str;
          if (item.height > 0 && item.str.trim()) {
            minFontPt = minFontPt === null ? item.height : Math.min(minFontPt, item.height);
          }
          if (item.hasEOL) {
            if (current.trim()) lines.push(current.trim());
            current = '';
          }
        }
        if (current.trim()) lines.push(current.trim());
        slides.push({
          title: lines[0] ?? '',
          text: lines.slice(1).join('\n'),
          notes: '',
          minFontPt: minFontPt === null ? null : Math.round(minFontPt * 10) / 10,
          imageCount: null,
        });
      } finally {
        loaded.cleanup();
      }
    }
    return slides;
  } finally {
    await pdf.destroy();
  }
}
