// @vitest-environment node
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only to prevent import error in test environment
vi.mock("server-only");

import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
  type SessionPayload,
} from "../auth";

const TEST_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

function mockCookieStore() {
  return { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
}

async function captureTokenFromCreateSession(
  userId: string,
  email: string
) {
  const mockStore = mockCookieStore();
  (cookies as any).mockResolvedValue(mockStore);

  await createSession(userId, email);

  const setCall = mockStore.set.mock.calls[0];
  return setCall[1] as string; // token value
}

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("sets a cookie with JWT token", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    await createSession("user123", "user@example.com");

    expect(mockStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = mockStore.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format: header.payload.signature
  });

  test("sets cookie with correct options", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    await createSession("user123", "user@example.com");

    const [, , options] = mockStore.set.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("sets secure:false when NODE_ENV is not production", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    await createSession("user123", "user@example.com");

    const [, , options] = mockStore.set.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  test("sets secure:true when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    await createSession("user123", "user@example.com");

    const [, , options] = mockStore.set.mock.calls[0];
    expect(options.secure).toBe(true);
  });

  test("sets expires date approximately 7 days from now", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    const beforeCall = Date.now();
    await createSession("user123", "user@example.com");
    const afterCall = Date.now();

    const [, , options] = mockStore.set.mock.calls[0];
    const expiresTime = options.expires.getTime();
    const expectedTime = beforeCall + 7 * 24 * 60 * 60 * 1000;

    // Allow 5 second tolerance
    expect(expiresTime).toBeGreaterThanOrEqual(expectedTime - 5000);
    expect(expiresTime).toBeLessThanOrEqual(expectedTime + 5000);
  });

  test("signs token with correct userId and email in payload", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    await createSession("user123", "user@example.com");

    const [, token] = mockStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token as string, TEST_SECRET);

    expect(payload.userId).toBe("user123");
    expect(payload.email).toBe("user@example.com");
  });

  test("token payload includes expiresAt as ISO string and exp claim", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    const beforeCall = Date.now();
    await createSession("user123", "user@example.com");

    const [, token] = mockStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token as string, TEST_SECRET);

    expect(typeof payload.expiresAt).toBe("string");
    const expiresAtDate = new Date(payload.expiresAt as string);
    expect(expiresAtDate.getTime()).toBeGreaterThan(beforeCall);

    // Verify exp claim is approximately 7 days
    const expTime = (payload.exp as number) * 1000;
    const expectedExpTime = beforeCall + 7 * 24 * 60 * 60 * 1000;
    expect(expTime).toBeGreaterThanOrEqual(expectedExpTime - 5000);
    expect(expTime).toBeLessThanOrEqual(expectedExpTime + 5000);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no cookie is set", async () => {
    const mockStore = mockCookieStore();
    mockStore.get.mockReturnValue(undefined);
    (cookies as any).mockResolvedValue(mockStore);

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns null for malformed token", async () => {
    const mockStore = mockCookieStore();
    mockStore.get.mockReturnValue({ value: "not-a-valid-jwt" });
    (cookies as any).mockResolvedValue(mockStore);

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns session payload for valid token", async () => {
    const token = await captureTokenFromCreateSession("user123", "user@example.com");

    const mockStore = mockCookieStore();
    mockStore.get.mockReturnValue({ value: token });
    (cookies as any).mockResolvedValue(mockStore);

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user123");
    expect(session?.email).toBe("user@example.com");
  });

  test("returns null for expired token", async () => {
    const expiredToken = await new SignJWT({
      userId: "user123",
      email: "user@example.com",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-10s")
      .sign(TEST_SECRET);

    const mockStore = mockCookieStore();
    mockStore.get.mockReturnValue({ value: expiredToken });
    (cookies as any).mockResolvedValue(mockStore);

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns null for token signed with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret-key");
    const tamperedToken = await new SignJWT({
      userId: "user123",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);

    const mockStore = mockCookieStore();
    mockStore.get.mockReturnValue({ value: tamperedToken });
    (cookies as any).mockResolvedValue(mockStore);

    const session = await getSession();

    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deletes the auth-token cookie", async () => {
    const mockStore = mockCookieStore();
    (cookies as any).mockResolvedValue(mockStore);

    await deleteSession();

    expect(mockStore.delete).toHaveBeenCalledOnce();
    expect(mockStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when request has no cookie", async () => {
    const request = new NextRequest("http://localhost/");
    const session = await verifySession(request);

    expect(session).toBeNull();
  });

  test("returns null for malformed token in request", async () => {
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: `${COOKIE_NAME}=not-a-valid-jwt` },
    });

    const session = await verifySession(request);

    expect(session).toBeNull();
  });

  test("returns session payload for valid token in request", async () => {
    const token = await captureTokenFromCreateSession("user456", "user456@example.com");

    const request = new NextRequest("http://localhost/", {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    });

    const session = await verifySession(request);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user456");
    expect(session?.email).toBe("user456@example.com");
  });

  test("returns null for expired token in request", async () => {
    const expiredToken = await new SignJWT({
      userId: "user456",
      email: "user456@example.com",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-10s")
      .sign(TEST_SECRET);

    const request = new NextRequest("http://localhost/", {
      headers: { cookie: `${COOKIE_NAME}=${expiredToken}` },
    });

    const session = await verifySession(request);

    expect(session).toBeNull();
  });

  test("returns null for tampered token in request", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret-key");
    const tamperedToken = await new SignJWT({
      userId: "user456",
      email: "user456@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);

    const request = new NextRequest("http://localhost/", {
      headers: { cookie: `${COOKIE_NAME}=${tamperedToken}` },
    });

    const session = await verifySession(request);

    expect(session).toBeNull();
  });
});
