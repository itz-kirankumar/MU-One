import { fetchTestmailInbox, normalizeTestmailMessage, testmailAddress } from '../integrations/testmail';

describe('Testmail integration', () => {
  test('builds inbox addresses only from safe namespace and tag tokens', () => {
    expect(testmailAddress('muone', 'deadline-sept')).toBe('muone.deadline-sept@inbox.testmail.app');
    expect(() => testmailAddress('muone', '../unsafe')).toThrow('unsupported characters');
  });

  test('normalizes received mail and applies MU One deadline intelligence', () => {
    const message = normalizeTestmailMessage({
      id: 'email-1', tag: 'deadline', from: 'Faculty <faculty@example.com>',
      to: 'muone.deadline@inbox.testmail.app', subject: 'Submission · 18th Sept',
      html: '<p>Please submit before EOD.</p>', timestamp: 1789675200,
      attachments: [{ filename: 'brief.pdf', content_type: 'application/pdf', size: 1200 }],
    }, new Date('2026-09-18T12:00:00Z'));
    expect(message).toMatchObject({ id: 'email-1', tag: 'deadline', dueDate: '2026-09-18',
      subject: 'Submission · 18th Sept', attachments: [{ filename: 'brief.pdf', contentType: 'application/pdf', size: 1200 }] });
    expect(message.text).not.toContain('<p>');
  });

  test('queries the fixed Testmail endpoint without leaking credentials in the result', async () => {
    const fetcher = jest.fn(async (url: URL) => {
      expect(url.origin + url.pathname).toBe('https://api.testmail.app/api/json');
      expect(url.searchParams.get('apikey')).toBe('private-key');
      expect(url.searchParams.get('namespace')).toBe('muone');
      expect(url.searchParams.get('tag')).toBe('deadline');
      return new Response(JSON.stringify({ result: 'success', count: 1, limit: 5, offset: 0,
        emails: [{ id: '1', subject: 'Due 18 Sep', text: '', timestamp: 1789675200 }] }), { status: 200 });
    }) as typeof fetch;
    const result = await fetchTestmailInbox({ apiKey: 'private-key', namespace: 'muone' }, { tag: 'deadline', limit: 5 }, fetcher);
    expect(result.messages[0].dueDate).toBe('2026-09-18');
    expect(JSON.stringify(result)).not.toContain('private-key');
  });

  test('rejects conflicting filters, large pages, and provider failures', async () => {
    await expect(fetchTestmailInbox({ apiKey: 'key', namespace: 'muone' }, { tag: 'one', tagPrefix: 'two' }, jest.fn() as typeof fetch)).rejects.toThrow('not both');
    await expect(fetchTestmailInbox({ apiKey: 'key', namespace: 'muone' }, { limit: 51 }, jest.fn() as typeof fetch)).rejects.toThrow('between 1 and 50');
    const failed = jest.fn(async () => new Response(JSON.stringify({ result: 'fail', message: 'Unauthorized namespace' }), { status: 403 })) as typeof fetch;
    await expect(fetchTestmailInbox({ apiKey: 'key', namespace: 'muone' }, {}, failed)).rejects.toThrow('Unauthorized namespace');
  });
});
