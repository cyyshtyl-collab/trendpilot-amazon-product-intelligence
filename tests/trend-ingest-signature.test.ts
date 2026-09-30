import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';

import { verifyTrendIngestSignature } from '../lib/trend-ingest-signature.ts';

void test('accepts a current Ed25519 signature and rejects changed content', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const body = JSON.stringify({ geo: 'US', items: [{ keyword: 'desk foot rest' }] });
  const timestamp = String(Date.now());
  const signature = sign(null, Buffer.from(`${timestamp}.${body}`), privateKey).toString(
    'base64',
  );
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.equal(
    verifyTrendIngestSignature(body, { timestamp, signature }, Date.now(), publicPem),
    true,
  );
  assert.equal(
    verifyTrendIngestSignature(`${body} `, { timestamp, signature }, Date.now(), publicPem),
    false,
  );
});

void test('rejects expired signed payloads', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const body = '{}';
  const timestamp = String(Date.now() - 6 * 60_000);
  const signature = sign(null, Buffer.from(`${timestamp}.${body}`), privateKey).toString(
    'base64',
  );
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.equal(
    verifyTrendIngestSignature(body, { timestamp, signature }, Date.now(), publicPem),
    false,
  );
});
