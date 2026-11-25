import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Password cannot be empty.');
  }
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  if (typeof plainPassword !== 'string' || typeof passwordHash !== 'string') {
    return false;
  }
  return bcrypt.compare(plainPassword, passwordHash);
}
