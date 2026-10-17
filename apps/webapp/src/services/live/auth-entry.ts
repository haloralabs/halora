/** Decodes a base64 signature returned by a SEP-43 wallet into raw bytes. Fails closed on any other length. */
export function decodeWalletSignature(signedAuthEntry: string): Uint8Array {
  const bytes = Buffer.from(signedAuthEntry, 'base64');
  if (bytes.length !== 64) throw new Error('The wallet returned an invalid signature.');
  return new Uint8Array(bytes);
}
