import { validateMuDomain } from '../src/lib/auth';

describe('validateMuDomain', () => {
  it('rejects non-MU emails', () => {
    expect(validateMuDomain('student@gmail.com')).toBe(false);
    expect(validateMuDomain('test@harvard.edu')).toBe(false);
    expect(validateMuDomain('')).toBe(false);
    expect(validateMuDomain('notanemail')).toBe(false);
  });

  it('accepts @mastersunion.org emails', () => {
    expect(validateMuDomain('student@mastersunion.org')).toBe(true);
    expect(validateMuDomain('faculty@mastersunion.org')).toBe(true);
    expect(validateMuDomain('STUDENT@MASTERSUNION.ORG')).toBe(true);
  });

  it('rejects emails that only contain but do not end with @mastersunion.org', () => {
    expect(validateMuDomain('user@mastersunion.org.evil.com')).toBe(false);
    expect(validateMuDomain('mastersunion.org@gmail.com')).toBe(false);
  });
});

describe('signOutUser', () => {
  it('clears auth state when called', async () => {
    // Firebase auth is mocked via __mocks__/firebase/auth
    const { signOutUser } = await import('../src/lib/auth');
    await expect(signOutUser()).resolves.not.toThrow();
  });
});
