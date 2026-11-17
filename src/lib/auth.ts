import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface TokenPayload {
  userId: string;
  email: string;
  role?: string;
  purpose?: string;
}

export const signToken = (
  payload: TokenPayload,
  expiresIn: NonNullable<SignOptions["expiresIn"]> = "7d",
): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn });

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, JWT_SECRET) as TokenPayload;
