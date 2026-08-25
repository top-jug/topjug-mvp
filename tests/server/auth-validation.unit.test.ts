import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confirmEmailVerificationSchema,
  loginSchema,
  requestEmailVerificationSchema,
  resetPasswordSchema,
  registerSchema,
} from '../../src/server/auth/auth-validation';

const registration = {
  email: 'climber@example.com',
  displayName: 'Climber',
  emailVerificationToken: 'v'.repeat(43),
};

test('registration accepts every valid pair of password composition requirements', () => {
  for (const password of ['ABCDEF12', 'ABCDEF!!', '123456!!']) {
    assert.equal(registerSchema.safeParse({ ...registration, password }).success, true, password);
  }
});

test('registration rejects short passwords and passwords satisfying fewer than two requirements', () => {
  for (const password of ['Ab1!', 'abcdefgh', 'ABCDEFGH', '12345678', '!!!!!!??']) {
    assert.equal(registerSchema.safeParse({ ...registration, password }).success, false, password);
  }
});

test('registration keeps the maximum password length at 128 characters', () => {
  assert.equal(registerSchema.safeParse({ ...registration, password: `A1${'a'.repeat(126)}` }).success, true);
  assert.equal(registerSchema.safeParse({ ...registration, password: `A1${'a'.repeat(127)}` }).success, false);
});

test('login continues to accept existing passwords without the registration composition policy', () => {
  assert.equal(loginSchema.safeParse({ email: registration.email, password: 'legacy-password' }).success, true);
});

test('email verification schemas constrain purposes, codes, and one-time tokens', () => {
  assert.equal(requestEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'register' }).success, true);
  assert.equal(requestEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'unknown' }).success, false);
  assert.equal(confirmEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'reset_password', code: '123456' }).success, true);
  assert.equal(confirmEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'reset_password', code: '12345a' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ password: 'Valid123', emailVerificationToken: 'short' }).success, false);
});
