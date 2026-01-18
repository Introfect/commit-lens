import { sign, verify } from "hono/jwt";
import { z } from "zod";

const sessionPayload = z.object({
  userId: z.string(),
  exp: z.number(),
});

export const createSession = async ({
  userId,
  secret,
}: {
  userId: string;
  secret: string;
}) => {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };
  const token = await sign(payload, secret);
  return token;
};

export const verifySession = async ({
  token,
  secret,
}: {
  token: string;
  secret: string;
}) => {
  try {
    const decoded = await verify(token, secret);
    const payload = sessionPayload.parse(decoded);
    return {
      ok: true,
      payload,
    };
  } catch (e) {
    return {
      ok: false,
    };
  }
};