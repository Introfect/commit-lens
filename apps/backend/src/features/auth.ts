import { WithDbAndEnv, WithEnv } from "../utils/commonTypes";
import * as jwt from "@tsndr/cloudflare-worker-jwt";
import { DateTime } from "luxon";
import { z } from "zod";
import { ErrorCodes } from "../utils/error";
import { getUserByEmail, getUserById } from "./user";

export async function createApiKey({
  env,
  userId,
}: WithEnv<{ userId: string }>) {
  const token = await jwt.sign(
    {
      userId,
      exp: DateTime.now().plus({ year: 1 }).toSeconds(),
    },
    env.JWT_SECRET
  );

  return token;
}

const TokenPayloadSchema = z.object({
  userId: z.string(),
});

async function decodeApiKey({ env, token }: WithEnv<{ token: string }>) {
  const decoded = await jwt.verify(token, env.JWT_SECRET);

  if (!decoded) {
    return {
      ok: false,
      errorCode: ErrorCodes.INVALID_API_KEY,
      error: "Invalid api key",
    } as const;
  }

  const payload = TokenPayloadSchema.parse(decoded?.payload);

  return { ok: true, payload } as const;
}

export async function getUserFromApiKey({
  apiKey,
  db,
  env,
}: WithDbAndEnv<{ apiKey:string }>) {
  const decoded = await decodeApiKey({ env, token: apiKey });

  if (!decoded.ok) {
    return decoded;
  }

  const user = await getUserById({ id: decoded.payload.userId, db });

  if (!user) {
    return {
      ok: false,
      errorCode: ErrorCodes.INVALID_API_KEY,
      error: "Invalid api key",
    } as const;
  }

  return { ok: true, user: user } as const;
}
