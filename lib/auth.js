import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export const passwordHash = password => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
export function passwordMatches(password, encoded) {
  try {
    const [type, salt, hash] = encoded.split(':');
    return type === 'scrypt' && timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64));
  } catch { return false; }
}
export function publicEmployee(employee) {
  if (!employee) return null;
  const { password, passwordHash, ...safe } = employee;
  return safe;
}
