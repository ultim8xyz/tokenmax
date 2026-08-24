import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_DAYS = 30;
/** Verified tokens older than this get a fresh one back in a response header,
 *  so a machine that syncs regularly never hits the expiry cliff. */
const REFRESH_AFTER_DAYS = 7;

interface JwtPayload {
  sub: string;
  username?: string | null;
  iat: number;
  exp: number;
}

export interface CliAuthResult {
  userId: string;
  username: string | null;
  refreshedToken: string | null;
}

function secret(): string {
  const value = process.env.CLI_JWT_SECRET;
  if (!value) throw new Error("CLI_JWT_SECRET is not set");
  return value;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function unb64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function sign(header: string, payload: string): string {
  return createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
}

export function createDeviceSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createAuthCode(): string {
  // Ambiguity-free alphabet: the user may have to read this off one screen
  // and compare it on another.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function createCliToken(userId: string, username: string | null): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      username,
      iat: now,
      exp: now + TOKEN_TTL_DAYS * 24 * 60 * 60,
    } satisfies JwtPayload),
  );
  return `${header}.${payload}.${sign(header, payload)}`;
}

function verifyToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  const expected = Buffer.from(sign(header, payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const claims = JSON.parse(unb64url(payload)) as JwtPayload;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Reads the bearer token off a request and returns the caller, or null. */
export function authenticate(request: Request): CliAuthResult | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const claims = verifyToken(header.slice(7).trim());
  if (!claims) return null;

  const ageDays = (Math.floor(Date.now() / 1000) - claims.iat) / 86400;
  return {
    userId: claims.sub,
    username: claims.username ?? null,
    refreshedToken:
      ageDays > REFRESH_AFTER_DAYS ? createCliToken(claims.sub, claims.username ?? null) : null,
  };
}
