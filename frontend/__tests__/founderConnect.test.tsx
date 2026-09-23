import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FounderConnectHub } from '../src/components/founder/FounderConnectHub';
import { founderApi } from '../src/lib/founder';

jest.mock('../src/lib/founder', () => ({
  founderApi: { bootstrap: jest.fn(), authUrl: jest.fn(), importLinkedIn: jest.fn(), submit: jest.fn(), suggestions: jest.fn() },
  founderError: (error: Error) => error.message,
  extractLinkedInPdf: jest.fn(),
}));
const api = jest.mocked(founderApi);
const incomplete = {
  onboarding: { status: 'not_started' as const }, profile: null, linkedinConnection: null,
  linkedinSignInReady: false,
  questionnaire: {
    questions: [{ id: 'story', section: 'story', kind: 'text' as const, title: 'Your founder story', minChars: 10, maxChars: 500, required: true }],
    sectionOrder: ['story'], sectionLabels: { story: 'Your story' },
  },
  labels: { skills: {}, interests: {}, archetypes: {} },
  vocab: { interests: [], skills: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  api.bootstrap.mockResolvedValue(incomplete);
  api.submit.mockResolvedValue({ profile: {} as never });
});

test('onboarding works without LinkedIn app credentials and requires explicit AI consent', async () => {
  render(<FounderConnectHub />);
  expect(await screen.findByText('Not configured yet.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to questionnaire' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I shipped a student product.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Finish profile' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please agree to AI-assisted');
  expect(api.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree to have my questionnaire/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish profile' }));
  await waitFor(() => expect(api.submit).toHaveBeenCalledWith({ story: 'I shipped a student product.' }, true));
});
