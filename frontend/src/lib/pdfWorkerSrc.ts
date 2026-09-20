/**
 * The `new URL(…, import.meta.url)` form is what makes the bundler emit the
 * pdf.js worker as a local asset instead of reaching for a CDN. It lives alone
 * in this module so it is only ever evaluated when a PDF is actually read —
 * CommonJS test runners cannot parse `import.meta` at all.
 */
export const PDF_WORKER_SRC = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
