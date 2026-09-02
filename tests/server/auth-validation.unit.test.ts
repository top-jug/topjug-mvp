import assert from 'node:assert/strict';
import test from 'node:test';
import { getPasswordRequirementState, validatePasswordPolicy } from '../../src/lib/auth/password-policy';
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

test('shared password policy accepts all valid requirement pairs', () => {
  for (const password of ['ABCDEF12', 'ABCDEF!!', '123456!!']) {
    assert.equal(validatePasswordPolicy(password), null, password);
    assert.equal(registerSchema.safeParse({ ...registration, password }).success, true, password);
  }
});

test('shared password policy rejects invalid lengths and insufficient composition', () => {
  for (const password of ['Ab1!', 'abcdefgh', 'ABCDEFGH', '12345678', '!!!!!!??', `A1${'a'.repeat(127)}`]) {
    assert.notEqual(validatePasswordPolicy(password), null, password);
    assert.equal(registerSchema.safeParse({ ...registration, password }).success, false, password);
  }
  assert.equal(getPasswordRequirementState(`A1${'a'.repeat(126)}`).hasMaximumLength, true);
});

test('login accepts legacy passwords while recovery inputs use the new policy', () => {
  assert.equal(loginSchema.safeParse({ email: registration.email, password: 'legacy-password' }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ password: 'Valid123', emailVerificationToken: 'v'.repeat(43) }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ password: 'legacy-password', emailVerificationToken: 'v'.repeat(43) }).success, false);
});

test('email challenge schemas allow only purpose-bound backend flows', () => {
  assert.equal(requestEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'register' }).success, true);
  assert.equal(requestEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'reset_password' }).success, true);
  assert.equal(requestEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'find_account' }).success, false);
  assert.equal(confirmEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'register', code: '123456' }).success, true);
  assert.equal(confirmEmailVerificationSchema.safeParse({ email: registration.email, purpose: 'register', code: '12345a' }).success, false);
});
