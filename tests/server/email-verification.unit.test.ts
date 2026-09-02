import assert from 'node:assert/strict';
import test from 'node:test';
import { hashVerificationCode, hashVerificationToken } from '../../src/server/auth/email-verification-service';

process.env.AUTH_RATE_LIMIT_PEPPER = 'test-rate-limit-pepper-that-is-at-least-32-bytes';

test('email verification codes are bound to email and purpose with an HMAC', () => {
  const hash = hashVerificationCode('climber@example.com', 'register', '123456');
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashVerificationCode('climber@example.com', 'register', '123456'));
  assert.notEqual(hash, hashVerificationCode('climber@example.com', 'reset_password', '123456'));
  assert.notEqual(hash, hashVerificationCode('other@example.com', 'register', '123456'));
});

test('verified bearer tokens are stored only as SHA-256 hashes', () => {
  const token = 'verification-token-that-is-never-stored-in-plaintext';
  assert.match(hashVerificationToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashVerificationToken(token), token);
});
