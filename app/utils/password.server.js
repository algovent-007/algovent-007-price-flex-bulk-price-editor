import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(password), salt, KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !String(storedHash).includes(":")) {
    return false;
  }

  const [salt, hash] = String(storedHash).split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = await scryptAsync(String(password), salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");

  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expected, derived);
}
