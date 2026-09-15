import { sanitizeEmailHtml, formatPlainTextToHtml } from "../utils/sanitizeEmailHtml";

describe("sanitizeEmailHtml", () => {
  it("strips executable scripts and event handlers", () => {
    const raw = `<div>Hello<script>alert(1)</script><img src="x" onerror="alert(2)" /></div>`;
    const cleaned = sanitizeEmailHtml(raw);
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("alert(1)");
    expect(cleaned).not.toContain("onerror");
  });

  it("disarms javascript: and vbscript: links", () => {
    const raw = `<a href="javascript:alert('pwned')">Click here</a>`;
    const cleaned = sanitizeEmailHtml(raw);
    expect(cleaned).not.toContain("javascript:");
    expect(cleaned).toContain('href="#"');
  });

  it("forces target='_blank' and rel='noopener noreferrer' on links with clickable styling", () => {
    const raw = `<a href="https://mastersunion.org">Masters' Union Portal</a>`;
    const cleaned = sanitizeEmailHtml(raw);
    expect(cleaned).toContain('target="_blank"');
    expect(cleaned).toContain('rel="noopener noreferrer"');
    expect(cleaned).toContain('href="https://mastersunion.org"');
    expect(cleaned).toContain("color: #1a73e8");
    expect(cleaned).toContain("text-decoration: underline");
  });

  it("preserves rich HTML formatting (tables, styles, bold, spans)", () => {
    const raw = `
      <div style="font-family: Arial;">
        <h2 style="color: #202124;">Exam Schedule</h2>
        <table border="1">
          <tr><th>Subject</th><th>Time</th></tr>
          <tr><td>Data Science</td><td>10:00 AM</td></tr>
        </table>
      </div>
    `;
    const cleaned = sanitizeEmailHtml(raw);
    expect(cleaned).toContain("<table");
    expect(cleaned).toContain("Exam Schedule");
    expect(cleaned).toContain("Data Science");
    expect(cleaned).toContain("color: #202124");
  });
});

describe("formatPlainTextToHtml", () => {
  it("converts http/https URLs to clickable links opening in new tab", () => {
    const text = "Please visit https://canvas.mastersunion.org/courses/101 to check assignments.";
    const formatted = formatPlainTextToHtml(text);
    expect(formatted).toContain('<a href="https://canvas.mastersunion.org/courses/101" target="_blank" rel="noopener noreferrer"');
    expect(formatted).toContain("color: #1a73e8");
    expect(formatted).toContain("text-decoration: underline");
  });

  it("converts www. URLs to clickable links", () => {
    const text = "Check out www.mastersunion.org for announcements.";
    const formatted = formatPlainTextToHtml(text);
    expect(formatted).toContain('<a href="https://www.mastersunion.org" target="_blank" rel="noopener noreferrer"');
  });

  it("converts email addresses to mailto clickable links", () => {
    const text = "Reach out to support@mastersunion.org if you have questions.";
    const formatted = formatPlainTextToHtml(text);
    expect(formatted).toContain('<a href="mailto:support@mastersunion.org"');
    expect(formatted).toContain("color: #1a73e8");
  });

  it("escapes raw HTML to prevent injection", () => {
    const text = "<script>alert('xss')</script> & check this";
    const formatted = formatPlainTextToHtml(text);
    expect(formatted).not.toContain("<script>");
    expect(formatted).toContain("&lt;script&gt;");
    expect(formatted).toContain("&amp;");
  });
});
