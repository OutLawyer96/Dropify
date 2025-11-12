import { SHARE_LINK_ID_LENGTH, PASSWORD_HASH_ROUNDS } from "./constants";

/**
 * Cryptographic helper utilities for share link operations.
 * All heavy dependencies are loaded lazily to keep cold start sizes minimal.
 */
export interface GenerateSecureLinkIdOptions {
  readonly length?: number;
}

export interface HashPasswordOptions {
  readonly rounds?: number;
}

const toUrlSafe = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");

/**
 * Generates a URL-safe random identifier using crypto-strength randomness.
 */
export const generateSecureLinkId = (
  options: GenerateSecureLinkIdOptions = {}
): string => {
  const length = options.length ?? SHARE_LINK_ID_LENGTH;
  if (length <= 0) {
    throw new Error("Link id length must be positive");
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require("crypto") as {
    randomBytes: (size: number) => Buffer;
  };

  const bytes = Math.ceil((length * 6) / 8);
  const id = toUrlSafe(randomBytes(bytes)).slice(0, length);
  if (id.length < length) {
    throw new Error("Failed to generate secure link id of requested length");
  }
  return id;
};

const loadBcrypt = () =>
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("bcrypt") as typeof import("bcrypt");

/**
 * Hashes a plaintext password using bcrypt with the configured number of rounds.
 */
export const hashPassword = async (
  password: string,
  options: HashPasswordOptions = {}
): Promise<string> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string");
  }
  const rounds = options.rounds ?? PASSWORD_HASH_ROUNDS;
  const bcrypt = loadBcrypt();
  return bcrypt.hash(password, rounds);
};

/**
 * Verifies whether a plaintext password matches a stored bcrypt hash.
 */
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  if (!hash) return false;
  const bcrypt = loadBcrypt();
  return bcrypt.compare(password, hash);
};
