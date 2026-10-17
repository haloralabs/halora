import { describe, expect, test } from 'bun:test';
import {
  HALORA_ERROR_CODES,
  HALORA_ERRORS,
  HaloraPolicyError,
  haloraErrorFromCode,
  isHaloraErrorCode,
  isHaloraPolicyError,
  parseHaloraContractError,
} from './errors.js';

describe('error map', () => {
  test('matches the contract codes in interfaces.md', () => {
    HALORA_ERROR_CODES.forEach((name, i) => {
      expect(HALORA_ERRORS[name].code).toBe(i + 1);
      expect(HALORA_ERRORS[name].name).toBe(name);
      expect(HALORA_ERRORS[name].message.length).toBeGreaterThan(10);
      expect(HALORA_ERRORS[name].message).not.toContain('\u2014');
    });
    expect(haloraErrorFromCode(7)?.name).toBe('PerTxLimitExceeded');
    expect(haloraErrorFromCode(0)).toBeUndefined();
    expect(haloraErrorFromCode(11)).toBeUndefined();
  });

  test('parses host error strings', () => {
    expect(parseHaloraContractError('HostError: Error(Contract, #8)')?.name).toBe(
      'DailyLimitExceeded',
    );
    expect(parseHaloraContractError('Error(Auth, InvalidAction)')).toBeUndefined();
    expect(parseHaloraContractError('Error(Contract, #99)')).toBeUndefined();
  });

  test('HaloraPolicyError carries typed code', () => {
    const err = new HaloraPolicyError('Paused', 'Ask the owner to unpause.');
    expect(err).toBeInstanceOf(Error);
    expect(isHaloraPolicyError(err)).toBe(true);
    expect(err.code).toBe('Paused');
    expect(err.contractCode).toBe(4);
    expect(err.message).toContain('paused');
    expect(isHaloraErrorCode('Paused')).toBe(true);
    expect(isHaloraErrorCode('Nope')).toBe(false);
  });
});
