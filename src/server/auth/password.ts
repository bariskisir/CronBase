import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_BYTES = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, n, r, p, saltText, hashText] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltText || !hashText) return false;

  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(hashText, "base64");
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generatePassword(length = 20): string {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

export function generateSecretKey(): string {
  return randomBytes(32).toString("hex");
}
