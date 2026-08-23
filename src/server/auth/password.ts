import 'server-only';

import { hash, verify, type Options } from '@node-rs/argon2';

const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$hHmsgEgZ5RFlYuE5THWEiQ$0FgVCM3S2Pu/TjwV7opmSokXhs6YUxKtyja4j3DK44E';
const HASH_OPTIONS: Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function hashPassword(password: string) {
  return hash(password, HASH_OPTIONS);
}

export function verifyPassword(passwordHash: string | null, password: string) {
  return verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
}
