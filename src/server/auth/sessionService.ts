import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { AuthTokensResponse } from "../../shared/types/api.js";
import { sessionRepository } from "../db/repositories/sessionRepository.js";
import { settingsRepository } from "../db/repositories/settingsRepository.js";
import { generateSecretKey } from "./password.js";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AccessTokenPayload {
  sub: "admin";
  iat: number;
  exp: number;
  jti: string;
  pwd: string;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function passwordFingerprint(): string {
  const hash = settingsRepository.get("password_hash") ?? "";
  return createHash("sha256").update(hash).digest("base64url").slice(0, 12);
}

function getOrCreateSecretKey(): string {
  const existing = settingsRepository.get("secret_key");
  if (existing) return existing;
  const generated = generateSecretKey();
  settingsRepository.set("secret_key", generated);
  return generated;
}

function signSegment(data: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(data).digest("base64url");
}

function createAccessToken(secretKey: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload: AccessTokenPayload = {
    sub: "admin",
    iat: nowSeconds,
    exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
    jti: randomBytes(12).toString("base64url"),
    pwd: passwordFingerprint(),
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${payloadSegment}`;
  const signature = signSegment(signingInput, secretKey);
  return `${signingInput}.${signature}`;
}

function verifyAccessToken(token: string, secretKey: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  if (!headerSegment || !payloadSegment || !signatureSegment) return false;

  const expectedSignature = signSegment(`${headerSegment}.${payloadSegment}`, secretKey);
  const actualBuf = Buffer.from(signatureSegment);
  const expectedBuf = Buffer.from(expectedSignature);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as Partial<AccessTokenPayload>;
    if (payload.sub !== "admin" || typeof payload.exp !== "number") return false;
    if (payload.pwd !== passwordFingerprint()) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowSeconds;
  } catch {
    return false;
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export const sessionService = {
  issueTokens(): AuthTokensResponse {
    const secretKey = getOrCreateSecretKey();
    const accessToken = createAccessToken(secretKey);
    const refreshToken = randomBytes(40).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    sessionRepository.deleteExpired();
    sessionRepository.create(hashRefreshToken(refreshToken), expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      mustChangePassword: settingsRepository.get("must_change_password") === "true",
    };
  },

  rotateRefreshToken(refreshToken: string): AuthTokensResponse | null {
    sessionRepository.deleteExpired();
    const consumed = sessionRepository.consume(hashRefreshToken(refreshToken));
    if (!consumed) return null;
    return this.issueTokens();
  },

  isAuthenticated(request: Request): boolean {
    const token = extractBearerToken(request);
    if (!token) return false;
    const secretKey = getOrCreateSecretKey();
    return verifyAccessToken(token, secretKey);
  },

  revokeRefreshToken(refreshToken?: string): void {
    if (!refreshToken) return;
    sessionRepository.delete(hashRefreshToken(refreshToken));
  },

  resetAllAndIssueNew(): AuthTokensResponse {
    sessionRepository.deleteAll();
    return this.issueTokens();
  },
};
