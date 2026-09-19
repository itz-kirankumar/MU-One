import { inferDueDate, normalizeMessage } from '../utils/mailParsing';
import { extractMailDueDate } from '../../../frontend/src/lib/mailUtils';

const received = new Date('2026-09-10T12:00:00Z');
const formats = [
  '18th Sept', '18 Sep', 'sep 18', 'SEPTEMBER 18TH, 2026',
  '18th of September 2026', '[18 Sept]', 'Sept. 18, 2026',
  '18-Sept-2026', '18/09/2026', '18.09.26', '2026-09-18',
  '18/09', '18 September, 2026', '18\u00a0Sept',
  '18<sup>th</sup>&nbsp;<b>Sept</b>', '18&#32;Sept',
];

describe.each(formats)('mail date format: %s', (date) => {
  test.each(['subject', 'body', 'snippet'])('extracts from %s alone', (location) => {
    const subject = location === 'subject' ? `Reminder: ${date}` : 'Reminder';
    const body = location === 'body' ? `Details\n${date}` : 'Please check the details.';
    const snippet = location === 'snippet' ? date : '';
    const message = normalizeMessage({
      id: 'format-test', snippet,
      payload: {
        mimeType: 'text/html',
        headers: [
          { name: 'Subject', value: subject },
          { name: 'Date', value: received.toUTCString() },
        ],
        body: { data: Buffer.from(body).toString('base64url') },
      },
    });
    expect(message.dueDate).toBe('2026-09-18');
    expect(message.isDeadlineSignal).toBe(true);
    expect(extractMailDueDate(subject, `${body}\n${snippet}`, received.toISOString(), received))
      .toBe('2026-09-18');
  });
});

test.each([
  ['Event 20 Sep. Apply by 18 Sep.', '2026-09-18'],
  ['Event 12 Sep. Deadline 18 Sep.', '2026-09-18'],
  ['Deadline tomorrow. Event 18 Sep.', '2026-09-11'],
  ['18 Sep is the deadline. Event 12 Sep.', '2026-09-18'],
  ['Deadline: 18 Sep and 20 Sep', '2026-09-18'],
  ['Deadline: 2026-09-18', '2026-09-18'],
  ['18 Sep 11:59 PM', '2026-09-18'],
  ['Sept 18, 2026 at 11:59 PM', '2026-09-18'],
  ['09/18/2026', '2026-09-18'],
  ['09/10/2026', '2026-10-09'],
  ['31 September 2026', null], ['2026-02-30', null],
  ['29 February 2026', null], ['29 February 2028', '2028-02-29'],
  ['Due 31/09/2026', null], ['Team size: 1-4 members', null],
  ['https://example.com/2026-09-18', null], ['No date supplied', null],
  ['<style>.x { content: "18 Sep" }</style>No date', null],
])('backend and frontend agree for %s', (text, expected) => {
  expect(inferDueDate(text, received, received)).toBe(expected);
  expect(extractMailDueDate(text, '', received.toISOString(), received)).toBe(expected);
});

test.each([
  ['2026-12-28', '2 Jan', '2027-01-02'],
  ['2027-01-03', '30 Dec', '2026-12-30'],
])('infers the year near receipt %s', (base, text, expected) => {
  const date = new Date(`${base}T12:00:00Z`);
  expect(inferDueDate(text, date, date)).toBe(expected);
  expect(extractMailDueDate(text, '', date.toISOString(), date)).toBe(expected);
});

test('finds dates in later inline MIME parts without reading attachments', () => {
  const part = (text: string, filename = '') => ({
    mimeType: 'text/plain', filename, body: { data: Buffer.from(text).toString('base64url') },
  });
  const result = normalizeMessage({ payload: {
    headers: [{ name: 'Date', value: received.toUTCString() }],
    mimeType: 'multipart/mixed',
    parts: [part('Please read below'), part('18 Sep'), part('12 Sep', 'attachment.txt')],
  } });
  expect(result.dueDate).toBe('2026-09-18');
});

test('reads HTML-only dates even when a plain-text alternative exists', () => {
  const result = normalizeMessage({ payload: {
    headers: [{ name: 'Date', value: received.toUTCString() }],
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/plain', body: { data: Buffer.from('Please register').toString('base64url') } },
      { mimeType: 'text/html', body: { data: Buffer.from('<p>18<sup>th</sup>&nbsp;Sept</p>').toString('base64url') } },
    ],
  } });
  expect(result.dueDate).toBe('2026-09-18');
});
