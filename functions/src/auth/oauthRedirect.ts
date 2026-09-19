export function buildDashboardRedirect(
  dashboardUrl: string,
  status: 'success' | 'denied' | 'error',
  reason?: string,
): string {
  const url = new URL(dashboardUrl || 'https://muone.live/dashboard');
  url.searchParams.set('google_connect', status);
  if (reason) url.searchParams.set('reason', reason.slice(0, 100));
  return url.toString();
}
