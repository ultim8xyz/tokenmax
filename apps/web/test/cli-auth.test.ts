import { beforeAll, describe, expect, it } from "bun:test";

beforeAll(() => {
  process.env.CLI_JWT_SECRET ??= "test-secret";
});

const { authenticate, createAuthCode, createCliToken, hashDeviceSecret } = await import(
  "../lib/api/cli-auth"
);

function bearer(token: string | null): Request {
  return new Request("http://localhost", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("cli tokens", () => {
  const token = createCliToken("user-1", "ohong");

  it("authenticates a token it issued", () => {
    expect(authenticate(bearer(token))?.userId).toBe("user-1");
  });

  it("rejects a missing or malformed header", () => {
    expect(authenticate(bearer(null))).toBeNull();
    expect(authenticate(bearer("a.b.c"))).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [header, payload] = token.split(".");
    expect(authenticate(bearer(`${header}.${payload}.AAAA`))).toBeNull();
  });

  it("rejects a payload swapped onto a valid signature", () => {
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "user-2", iat: 0, exp: 9e9 })).toString(
      "base64url",
    );
    expect(authenticate(bearer(`${header}.${forged}.${signature}`))).toBeNull();
  });

  it("does not hand back a refresh for a fresh token", () => {
    expect(authenticate(bearer(token))?.refreshedToken).toBeNull();
  });
});

describe("device codes", () => {
  it("uses an alphabet with no ambiguous glyphs", () => {
    expect(createAuthCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("hashes poll secrets deterministically", () => {
    expect(hashDeviceSecret("x")).toBe(hashDeviceSecret("x"));
    expect(hashDeviceSecret("x")).not.toBe(hashDeviceSecret("y"));
  });
});
