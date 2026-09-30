import { createPublicKey, verify } from 'node:crypto';

const TREND_INGEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEACH23EjwiZ0UqUVQEFi8JOgSticZDHxAqGX/Pry2YMs0=
-----END PUBLIC KEY-----`;

export type SignedTrendHeaders = {
  timestamp: string;
  signature: string;
};

/** Verifies a short-lived Ed25519 signature from the GitHub collection job. */
export function verifyTrendIngestSignature(
  rawBody: string,
  headers: SignedTrendHeaders,
  now = Date.now(),
  publicKey = TREND_INGEST_PUBLIC_KEY,
): boolean {
  const timestamp = Number(headers.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > 5 * 60_000)
    return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(headers.signature)) return false;
  try {
    return verify(
      null,
      Buffer.from(`${headers.timestamp}.${rawBody}`),
      createPublicKey(publicKey),
      Buffer.from(headers.signature, 'base64'),
    );
  } catch {
    return false;
  }
}
