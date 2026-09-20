import { buildMimeMessage } from '../actions/sendMail';

describe('buildMimeMessage', () => {
  it('builds a rich multipart email with HTML and attachments', () => {
    const message = buildMimeMessage({
      recipients: ['student@mastersunion.org'],
      subject: 'Formatted update',
      body: 'Plain fallback',
      html: '<p><strong>Formatted</strong> update</p>',
      attachments: [{ filename: 'brief.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf-data') }],
    });

    expect(message).toContain('Content-Type: multipart/mixed');
    expect(message).toContain('Content-Type: multipart/alternative');
    expect(message).toContain('Content-Type: text/html; charset=utf-8');
    expect(message).toContain('Content-Disposition: attachment; filename="brief.pdf"');
    expect(message).toContain(Buffer.from('<p><strong>Formatted</strong> update</p>').toString('base64'));
  });

  it('removes line breaks from mail headers', () => {
    const message = buildMimeMessage({ recipients: ['student@mastersunion.org'], subject: 'Hello\r\nBcc: attacker@example.com', body: 'Safe body' });
    expect(message).not.toContain('\r\nBcc: attacker@example.com');
  });
});
