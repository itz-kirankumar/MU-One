import fs from 'fs';
import path from 'path';
import { buildDashboardRedirect } from '../auth/oauthRedirect';

test('production OAuth configuration returns users to MU One rather than localhost', () => {
  const env = fs.readFileSync(path.resolve(__dirname, '../../.env.mu-one-508502'), 'utf8');
  expect(env).toContain('DASHBOARD_URL=https://muone.live/dashboard');
  expect(env).not.toContain('DASHBOARD_URL=http://localhost');
  expect(buildDashboardRedirect('https://muone.live/dashboard', 'success'))
    .toBe('https://muone.live/dashboard?google_connect=success');
});

test('encodes provider errors without changing the configured host', () => {
  const redirect = new URL(buildDashboardRedirect('https://muone.live/dashboard', 'error', 'token failed & retry'));
  expect(redirect.origin).toBe('https://muone.live');
  expect(redirect.searchParams.get('reason')).toBe('token failed & retry');
});
