import { describe, expect, test } from 'bun:test';
import { Address, Keypair, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import {
  attachOwnerSignature,
  coSignAuthEntryAsOwner,
  describeTransferAuthEntry,
  getAddressCredentials,
  getAuthEntryPayload,
  keypairSigner,
  signHaloraAuthEntry,
} from '../src/auth.js';
import { decodeHaloraSignature } from '../src/scval.js';
import { CONTRACT_ID, PASSPHRASE, TOKEN_ID } from './fake-ledger.js';

const agent = Keypair.random();
const owner = Keypair.random();
const to = Keypair.random().publicKey();

function unsignedEntry(v2 = false, from = CONTRACT_ID): xdr.SorobanAuthorizationEntry {
  const creds = new xdr.SorobanAddressCredentials({
    address: new Address(from).toScAddress(),
    nonce: 42n,
    signatureExpirationLedger: 0,
    signature: xdr.ScVal.scvVoid(),
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials: v2
      ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(creds)
      : xdr.SorobanCredentials.sorobanCredentialsAddress(creds),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(TOKEN_ID).toScAddress(),
          functionName: 'transfer',
          args: [
            new Address(from).toScVal(),
            new Address(to).toScVal(),
            nativeToScVal(70_000_000n, { type: 'i128' }),
          ],
        }),
      ),
      subInvocations: [],
    }),
  });
}

for (const v2 of [false, true]) {
  describe(`auth entries (${v2 ? 'CAP-71 V2' : 'legacy'} credentials)`, () => {
    test('agent signature verifies over the standard payload and keeps the credential arm', async () => {
      const signed = await signHaloraAuthEntry({
        entry: unsignedEntry(v2),
        contractId: CONTRACT_ID,
        role: 'Agent',
        signer: keypairSigner(agent),
        validUntilLedgerSeq: 1_234,
        networkPassphrase: PASSPHRASE,
      });
      expect(signed.credentials.type).toBe(
        v2 ? 'sorobanCredentialsAddressV2' : 'sorobanCredentialsAddress',
      );
      const creds = getAddressCredentials(signed)!;
      expect(creds.signatureExpirationLedger).toBe(1_234);
      expect(creds.nonce).toBe(42n);
      const sig = decodeHaloraSignature(creds.signature);
      expect(sig.kind).toBe('Agent');
      const payload = getAuthEntryPayload(signed, PASSPHRASE);
      if (sig.kind !== 'Agent') throw new Error('unreachable');
      expect(agent.verify(payload, sig.agent.signature)).toBe(true);
      expect(sig.agent.publicKey).toEqual(agent.rawPublicKey());
      // Different network -> different payload.
      expect(
        getAuthEntryPayload(signed, 'Public Global Stellar Network ; September 2015'),
      ).not.toEqual(payload);
    });

    test('owner co-signature produces AgentWithOwner over the same payload', async () => {
      const signed = await signHaloraAuthEntry({
        entry: unsignedEntry(v2),
        contractId: CONTRACT_ID,
        role: 'Agent',
        signer: keypairSigner(agent),
        validUntilLedgerSeq: 2_000,
        networkPassphrase: PASSPHRASE,
      });
      const b64 = signed.toXdr('base64');
      const co = await coSignAuthEntryAsOwner({
        authEntryXdr: b64,
        owner: keypairSigner(owner),
        networkPassphrase: PASSPHRASE,
      });
      const entry = xdr.SorobanAuthorizationEntry.fromXdr(co, 'base64');
      const sig = decodeHaloraSignature(getAddressCredentials(entry)!.signature);
      if (sig.kind !== 'AgentWithOwner') throw new Error('expected AgentWithOwner');
      const payload = getAuthEntryPayload(entry, PASSPHRASE);
      expect(agent.verify(payload, sig.agent.signature)).toBe(true);
      expect(owner.verify(payload, sig.owner.signature)).toBe(true);

      const external = attachOwnerSignature({
        authEntryXdr: b64,
        ownerPublicKey: owner.publicKey(),
        ownerSignature: owner.sign(payload),
        networkPassphrase: PASSPHRASE,
      });
      expect(external).toBe(co); // ed25519 is deterministic
      expect(() =>
        attachOwnerSignature({
          authEntryXdr: b64,
          ownerPublicKey: owner.publicKey(),
          ownerSignature: agent.sign(payload),
          networkPassphrase: PASSPHRASE,
        }),
      ).toThrow(/does not verify/);
    });
  });
}

describe('safety checks', () => {
  test('refuses to sign for a different address', async () => {
    await expect(
      signHaloraAuthEntry({
        entry: unsignedEntry(false, TOKEN_ID),
        contractId: CONTRACT_ID,
        role: 'Agent',
        signer: keypairSigner(agent),
        validUntilLedgerSeq: 10,
        networkPassphrase: PASSPHRASE,
      }),
    ).rejects.toThrow(/different address/);
  });

  test('rejects a signer that returns a bad signature', async () => {
    await expect(
      signHaloraAuthEntry({
        entry: unsignedEntry(),
        contractId: CONTRACT_ID,
        role: 'Agent',
        signer: { publicKey: agent.publicKey(), sign: () => new Uint8Array(64) },
        validUntilLedgerSeq: 10,
        networkPassphrase: PASSPHRASE,
      }),
    ).rejects.toThrow(/invalid signature/);
  });

  test('describeTransferAuthEntry parses and validates a transfer', () => {
    const d = describeTransferAuthEntry(unsignedEntry().toXdr('base64'));
    expect(d).toEqual({
      from: CONTRACT_ID,
      token: TOKEN_ID,
      to,
      amount: 70_000_000n,
      signatureExpirationLedger: 0,
    });
  });
});
