/**
 * Sanitizes email HTML for secure in-app rendering in Gmail-style template.
 *
 * Strips executable scripts, dangerous tags, event handlers, and tracking pixels
 * while preserving rich email formatting, styles, tables, colors, buttons, and clickable links.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let clean = html;

  // 1. Remove dangerous blocks entirely (scripts, iframes, objects, forms)
  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/<input\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");

  // 2. Strip event handlers (onload, onclick, onerror, onmouseover, etc.)
  clean = clean.replace(/\son\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, "");

  // 3. Disarm javascript: or vbscript: or data: in href and src (supporting nested opposite quotes)
  clean = clean.replace(/\shref\s*=\s*"[^"]*?(?:javascript|vbscript|data):[^"]*"/gi, ' href="#"');
  clean = clean.replace(/\shref\s*=\s*'[^']*?(?:javascript|vbscript|data):[^']*'/gi, " href='#'");
  clean = clean.replace(/\shref\s*=\s*(?:javascript|vbscript|data):[^\s>]+/gi, ' href="#"');
  clean = clean.replace(/\ssrc\s*=\s*"[^"]*?(?:javascript|vbscript):[^"]*"/gi, ' src="#"');
  clean = clean.replace(/\ssrc\s*=\s*'[^']*?(?:javascript|vbscript):[^']*'/gi, " src='#'");
  clean = clean.replace(/\ssrc\s*=\s*(?:javascript|vbscript):[^\s>]+/gi, ' src="#"');

  // 4. Ensure all links open securely in a new tab with target="_blank" and rel="noopener noreferrer"
  clean = clean.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
    let cleanAttrs = attrs
      .replace(/\starget\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, "")
      .replace(/\srel\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, "");

    // If no explicit style with color is present, ensure default clickable link styling
    let styleAttr = "";
    if (!/style\s*=\s*/i.test(cleanAttrs)) {
      styleAttr = ' style="color: #1a73e8; text-decoration: underline; cursor: pointer;"';
    }

    return `<a ${cleanAttrs.trim()}${styleAttr} target="_blank" rel="noopener noreferrer">`;
  });

  // 5. Remove 1x1 tracking pixels
  clean = clean.replace(/<img\b[^>]*(?:width=["']?[01]["']?|height=["']?[01]["']?)[^>]*>/gi, "");

  return clean.trim();
}

/**
 * Converts plain text into clean, formatted HTML paragraphs with clickable links and emails.
 */
export function formatPlainTextToHtml(text: string): string {
  if (!text || typeof text !== "string") return "";

  // 1. HTML escape special characters to prevent XSS
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Auto-link http/https URLs into styled clickable links
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  escaped = escaped.replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: underline; word-break: break-all; cursor: pointer; font-weight: 500;">$1</a>'
  );

  // 3. Auto-link www. URLs
  const wwwRegex = /(^|[^\/])(www\.[^\s<>"']+)/g;
  escaped = escaped.replace(
    wwwRegex,
    '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: underline; word-break: break-all; cursor: pointer; font-weight: 500;">$2</a>'
  );

  // 4. Auto-link email addresses
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  escaped = escaped.replace(
    emailRegex,
    '<a href="mailto:$1" style="color: #1a73e8; text-decoration: underline; cursor: pointer; font-weight: 500;">$1</a>'
  );

  // 5. Convert double linebreaks to paragraphs and single linebreaks to <br/>
  const paragraphs = escaped.split(/\n{2,}/);
  return paragraphs
    .map((p) => `<p style="margin-bottom: 12px; line-height: 1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
