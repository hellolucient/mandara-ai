/**
 * Password hashing with PBKDF2-HMAC-SHA256 through WebCrypto, which Cloudflare Workers and Node both provide.
 * 100,000 iterations is the most Workers allow per derivation. Each hash has its own 16-byte salt.
 * Stored form: pbkdf2-sha256$<iterations>$<salt b64url>$<hash b64url>
 */
export const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const salt = fromB64url(parts[2]);
  const expected = fromB64url(parts[3]);
  if (!salt.length || expected.length !== KEY_BYTES) return false;
  const actual = await derive(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

/** A hash to compare against when the username is unknown, so a miss takes as long as a wrong password. */
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword("not-a-real-password-placeholder");
  return dummy;
}

export function passwordProblem(password: string, username = ""): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "The password cannot contain the username.";
  return null;
}

/** A readable temporary password for an administrator to pass on, e.g. "tide-amber-4821-lotus". */
export function temporaryPassword(): string {
  const words = ["amber", "coral", "lotus", "palm", "tide", "reef", "sand", "jasmine", "lagoon", "breeze", "orchid", "pearl", "atoll", "mango", "cedar", "dune"];
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return `${words[bytes[0] % 16]}-${words[bytes[1] % 16]}-${String(n).padStart(4, "0")}-${words[bytes[2] % 16]}-${words[bytes[3] % 16]}`;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, KEY_BYTES * 8);
  return new Uint8Array(bits);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  try {
    const s = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

/** Session tokens: 32 random bytes in the cookie; only their SHA-256 is stored. */
export function newSessionToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return b64url(new Uint8Array(digest));
}
