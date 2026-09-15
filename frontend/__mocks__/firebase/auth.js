// Mock for firebase/auth in tests
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockSignInWithPopup = jest.fn().mockResolvedValue({
  user: { email: 'test@mastersunion.org', uid: 'test-uid', displayName: 'Test User' },
});
const mockOnAuthStateChanged = jest.fn((auth, cb) => {
  cb(null);
  return () => {};
});

module.exports = {
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    addScope: jest.fn(),
  })),
  getAuth: jest.fn().mockReturnValue({}),
};
