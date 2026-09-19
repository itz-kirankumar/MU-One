import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SurveyHub } from '../src/components/surveys/SurveyHub';
import { SurveyBuilder } from '../src/components/surveys/SurveyBuilder';
import { SurveyDetail } from '../src/components/surveys/SurveyDetail';
import { SurveyResults } from '../src/components/surveys/SurveyResults';
import { surveyApi } from '../src/lib/surveys';
import type { Survey } from '../src/types/surveys';

jest.mock('../src/lib/surveys', () => ({
  surveyApi: { list: jest.fn(), create: jest.fn(), detail: jest.fn(), respond: jest.fn(), results: jest.fn(), close: jest.fn() },
  surveyError: (error: Error) => error.message,
}));
const api = jest.mocked(surveyApi);
const survey: Survey = { id: 'survey-0000001', title: 'A better campus lunch', description: 'Help us understand what matters at lunchtime.',
  anonymousAuthor: true, anonymousResponses: true, authorName: 'Anonymous member', createdAt: '2026-09-18T12:00:00Z',
  closesAt: '2099-10-01T12:00:00Z', status: 'open', responseCount: 0, isOwner: false, hasResponded: false,
  questions: [{ id: 'q1', title: 'Would you try it?', type: 'choice', required: true, options: ['Yes', 'No'] }] };

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => 'survey-request-00001' });
  api.list.mockResolvedValue({ surveys: [survey], nextCursor: null });
  api.detail.mockResolvedValue(survey);
  api.respond.mockResolvedValue({ submitted: true });
  api.results.mockResolvedValue({ survey: { ...survey, isOwner: true }, responses: [], counts: {}, answeredCounts: {}, nextCursor: null });
  api.close.mockResolvedValue({ closed: true });
});

test('members discover surveys and open the response form', async () => {
  render(<SurveyHub />);
  expect(await screen.findByText('A better campus lunch')).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Explore surveys' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('button', { name: /Take survey/ }));
  expect(await screen.findByText('Your response is anonymous to the creator')).toBeVisible();
  expect(screen.getByRole('heading', { level: 1, name: survey.title })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Submit response' })).toBeVisible();
});

test('My surveys requests only the current member’s surveys', async () => {
  render(<SurveyHub />);
  await screen.findByText(survey.title);
  const exploreTab = screen.getByRole('tab', { name: 'Explore surveys' });
  fireEvent.keyDown(exploreTab, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'My surveys' })).toHaveFocus();
  await waitFor(() => expect(api.list).toHaveBeenCalledWith(true));
});

test('builder publishes questions and both anonymity controls, retaining the request ID after failure', async () => {
  api.create.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ id: survey.id });
  const published = jest.fn();
  render(<SurveyBuilder onCancel={jest.fn()} onPublished={published} />);
  fireEvent.change(screen.getByLabelText('Survey title'), { target: { value: survey.title } });
  fireEvent.change(screen.getByLabelText('What are you validating?'), { target: { value: survey.description } });
  fireEvent.change(screen.getByLabelText('Question 1 text'), { target: { value: 'Would you try it?' } });
  fireEvent.change(screen.getByLabelText('Question 1 option 1'), { target: { value: 'Yes' } });
  fireEvent.change(screen.getByLabelText('Question 1 option 2'), { target: { value: 'No' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Post as an anonymous/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Publish survey' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(screen.getByLabelText('Survey title')).toHaveValue(survey.title);
  fireEvent.click(screen.getByRole('button', { name: 'Publish survey' }));
  await waitFor(() => expect(published).toHaveBeenCalledWith(survey.id));
  expect(api.create).toHaveBeenLastCalledWith(expect.objectContaining({ anonymousAuthor: true, anonymousResponses: true, questions: [expect.objectContaining({ type: 'choice', options: ['Yes', 'No'] })] }), 'survey-request-00001');
});

test('named responses disclose identity sharing and submit explicit consent', async () => {
  api.detail.mockResolvedValue({ ...survey, anonymousResponses: false });
  render(<SurveyDetail id={survey.id} onBack={jest.fn()} onResults={jest.fn()} />);
  expect(await screen.findByText('Your name and email will be shared with the creator')).toBeVisible();
  fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree to share/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
  await screen.findByText('Thank you. Your response is in.');
  expect(api.respond).toHaveBeenCalledWith(survey.id, [{ questionId: 'q1', value: 0 }], true);
  expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
});

test.each([
  [{ hasResponded: true }, 'You’ve already responded.'],
  [{ status: 'closed' as const }, 'This survey is no longer accepting responses.'],
  [{ isOwner: true }, 'This is your survey. Other members can respond; your own answers won’t count toward validation.'],
])('prevents unavailable response flows: %j', async (changes, message) => {
  api.detail.mockResolvedValue({ ...survey, ...changes });
  render(<SurveyDetail id={survey.id} onBack={jest.fn()} onResults={jest.fn()} />);
  expect(await screen.findByText(message)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
});

test('displays actionable loading failures instead of an empty feed', async () => {
  api.list.mockRejectedValueOnce(new Error('Connection unavailable'));
  render(<SurveyHub />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(survey.title)).toBeVisible();
});

test('shows private result counts and confirms closure before sending it', async () => {
  api.results.mockResolvedValue({ survey: { ...survey, isOwner: true, responseCount: 1 }, counts: { q1: { '0': 1 } }, answeredCounts: { q1: 1 },
    responses: [{ id: 'response-0000001', respondent: null, answers: [{ questionId: 'q1', value: 0 }] }], nextCursor: null });
  render(<SurveyResults id={survey.id} onBack={jest.fn()} />);
  expect(await screen.findByText('1 · 100%')).toBeVisible();
  expect(screen.getByText('Anonymous response 1')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close survey' }));
  expect(api.close).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirm close' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
  await waitFor(() => expect(api.close).toHaveBeenCalledWith(survey.id));
});
