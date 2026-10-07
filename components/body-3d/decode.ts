import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { gunzipSync } from 'fflate';
import { delivery, type BodyVariant } from './contract';

export function decodeBodyAsset(payload: Uint8Array, variant: BodyVariant): ArrayBuffer {
  const expected = delivery.variants[variant];
  const compressed = payload[0] === 0x1f && payload[1] === 0x8b;
  if (compressed && (payload.length !== expected.bytes || bytesToHex(sha256(payload)) !== expected.sha256)) {
    throw new Error('Body delivery integrity check failed');
  }
  const bytes = compressed ? gunzipSync(payload) : payload;
  if (bytes.length !== expected.decodedBytes || bytesToHex(sha256(bytes)) !== expected.decodedSha256) {
    throw new Error('Body GLB integrity check failed');
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.length) {
    throw new Error('Invalid body GLB');
  }
  return bytes.slice().buffer;
}
