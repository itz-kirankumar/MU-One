/**
 * Tests for domainCheck utility.
 */

import { requireMuDomain } from "../utils/domainCheck";
import { CallableRequest } from "firebase-functions/v2/https";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  uid: string | null,
  email: string | null
): CallableRequest {
  if (uid === null || email === null) {
    return {
      auth: undefined,
      data: {},
      rawRequest: {} as never,
    } as unknown as CallableRequest;
  }
  return {
    auth: {
      uid,
      token: {
        email,
        uid,
        aud: "test",
        exp: 9999999999,
        iat: 0,
        iss: "test",
        sub: uid,
        firebase: { identities: {}, sign_in_provider: "google.com" },
      },
    },
    data: {},
    rawRequest: {} as never,
  } as unknown as CallableRequest;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("requireMuDomain", () => {
  it("returns uid for a valid @mastersunion.org email", () => {
    const req = makeRequest("uid-123", "student@mastersunion.org");
    expect(requireMuDomain(req)).toBe("uid-123");
  });

  it("throws permission-denied for a non-MU email (@gmail.com)", () => {
    const req = makeRequest("uid-456", "user@gmail.com");
    expect(() => requireMuDomain(req)).toThrow();
    try {
      requireMuDomain(req);
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("permission-denied");
    }
  });

  it("throws permission-denied for a non-MU email (@example.com)", () => {
    const req = makeRequest("uid-789", "user@example.com");
    expect(() => requireMuDomain(req)).toThrow();
    try {
      requireMuDomain(req);
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("permission-denied");
    }
  });

  it("throws unauthenticated when auth is missing", () => {
    const req = makeRequest(null, null);
    expect(() => requireMuDomain(req)).toThrow();
    try {
      requireMuDomain(req);
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("unauthenticated");
    }
  });

  it("is case-insensitive for the domain check", () => {
    const req = makeRequest("uid-001", "STUDENT@MASTERSUNION.ORG");
    expect(requireMuDomain(req)).toBe("uid-001");
  });

  it("throws permission-denied for a subdomain attack (mastersunion.org.evil.com)", () => {
    const req = makeRequest("uid-002", "user@mastersunion.org.evil.com");
    expect(() => requireMuDomain(req)).toThrow();
    try {
      requireMuDomain(req);
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("permission-denied");
    }
  });
});
