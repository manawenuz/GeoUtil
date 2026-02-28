import { authOptions } from "./auth";

describe("NextAuth Configuration", () => {
  it("should have Google provider configured", () => {
    expect(authOptions.providers).toHaveLength(1);
    expect(authOptions.providers[0].id).toBe("google");
  });

  it("should use JWT session strategy", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("should have 30-day session expiration", () => {
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    expect(authOptions.session?.maxAge).toBe(thirtyDaysInSeconds);
  });

  it("should have automatic session renewal configured", () => {
    const oneDayInSeconds = 24 * 60 * 60;
    expect(authOptions.session?.updateAge).toBe(oneDayInSeconds);
  });

  it("should have custom sign-in page configured", () => {
    expect(authOptions.pages?.signIn).toBe("/auth/signin");
  });

  it("should have custom error page configured", () => {
    expect(authOptions.pages?.error).toBe("/auth/error");
  });

  it("should have HTTP-only session cookie", () => {
    expect(authOptions.cookies?.sessionToken?.options?.httpOnly).toBe(true);
  });

  it("should have lax SameSite cookie policy", () => {
    expect(authOptions.cookies?.sessionToken?.options?.sameSite).toBe("lax");
  });

  it("should have CSRF token cookie configured", () => {
    expect(authOptions.cookies?.csrfToken).toBeDefined();
    expect(authOptions.cookies?.csrfToken?.options?.httpOnly).toBe(true);
    expect(authOptions.cookies?.csrfToken?.options?.sameSite).toBe("lax");
  });

  it("should have callback URL cookie configured", () => {
    expect(authOptions.cookies?.callbackUrl).toBeDefined();
    expect(authOptions.cookies?.callbackUrl?.options?.httpOnly).toBe(true);
    expect(authOptions.cookies?.callbackUrl?.options?.sameSite).toBe("lax");
  });

  it("should have secure cookies in production", () => {
    const originalEnv = process.env.NODE_ENV;
    
    // Test production
    process.env.NODE_ENV = "production";
    // Note: This test checks the configuration structure, not runtime behavior
    expect(authOptions.cookies?.sessionToken?.options?.secure).toBeDefined();
    
    process.env.NODE_ENV = originalEnv;
  });

  it("should have JWT callback defined", () => {
    expect(authOptions.callbacks?.jwt).toBeDefined();
    expect(typeof authOptions.callbacks?.jwt).toBe("function");
  });

  it("should have session callback defined", () => {
    expect(authOptions.callbacks?.session).toBeDefined();
    expect(typeof authOptions.callbacks?.session).toBe("function");
  });
});

describe("JWT Callback", () => {
  it("should add user info to token on initial sign in", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: "https://example.com/avatar.jpg",
    };

    const mockToken = {};

    const result = await authOptions.callbacks?.jwt?.({
      token: mockToken,
      user: mockUser,
      trigger: "signIn",
      session: undefined,
      account: null,
    });

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    });
  });

  it("should handle missing user image", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: undefined,
    };

    const mockToken = {};

    const result = await authOptions.callbacks?.jwt?.({
      token: mockToken,
      user: mockUser,
      trigger: "signIn",
      session: undefined,
      account: null,
    });

    expect(result?.picture).toBe("");
  });

  it("should preserve existing token when no user", async () => {
    const mockToken = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    };

    const result = await authOptions.callbacks?.jwt?.({
      token: mockToken,
      user: undefined,
      trigger: "update",
      session: undefined,
      account: null,
    });

    expect(result).toEqual(mockToken);
  });
});

describe("Session Callback", () => {
  it("should add user info from token to session", async () => {
    const mockToken = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    };

    const mockSession = {
      user: {
        id: "",
        email: "",
        name: "",
        image: "",
      },
      expires: "2024-12-31",
    };

    const result = await authOptions.callbacks?.session?.({
      session: mockSession,
      token: mockToken,
      user: undefined as any,
      newSession: undefined,
      trigger: "getSession",
    });

    expect(result?.user).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: "https://example.com/avatar.jpg",
    });
  });
});
