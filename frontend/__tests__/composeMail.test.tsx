import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComposeMailModal } from '../src/components/dashboard/ComposeMailModal';
import { sendMail } from '../src/lib/functions';

jest.mock('../src/lib/functions', () => ({ sendMail: jest.fn() }));

const mockedSendMail = sendMail as jest.MockedFunction<typeof sendMail>;

test('sends recipients as the array required by the mail callable', async () => {
  mockedSendMail.mockResolvedValue({ success: true, messageId: 'message-1' });
  render(<ComposeMailModal onClose={jest.fn()} />);

  fireEvent.change(screen.getByLabelText(/To/), { target: { value: 'first@mastersunion.org, second@mastersunion.org' } });
  fireEvent.change(screen.getByLabelText(/Subject/), { target: { value: 'Project update' } });
  const editor = screen.getByRole('textbox', { name: 'Body' });
  editor.innerHTML = '<p>The project is ready.</p>';
  Object.defineProperty(editor, 'innerText', { configurable: true, value: 'The project is ready.' });
  fireEvent.input(editor);
  fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));

  await waitFor(() => expect(mockedSendMail).toHaveBeenCalledWith({
    recipients: ['first@mastersunion.org', 'second@mastersunion.org'],
    subject: 'Project update',
    body: 'The project is ready.',
    html: '<p>The project is ready.</p>',
    attachments: [],
    bulkMode: false,
  }));
});
