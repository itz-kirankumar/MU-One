// Mock for firebase/auth in tests
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockSignInWithPopup = jest.fn().mockResolvedValue({
  user: { email: 'test@mastersunion.org', uid: 'test-uid', displayName: 'Test User' },
});
const mockOnAuthStateChanged = jest.fn((auth, cb) => {
  cb(null);
  return () => {};
});
const mockSetPersistence = jest.fn().mockResolvedValue(undefined);

module.exports = {
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  setPersistence: mockSetPersistence,
  browserLocalPersistence: { type: 'LOCAL' },
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    addScope: jest.fn(),
  })),
  getAuth: jest.fn().mockReturnValue({}),
};
