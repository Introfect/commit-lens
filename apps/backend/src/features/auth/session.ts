import * as jwt from "@tsndr/cloudflare-worker-jwt";
import type { MiddlewareHandler } from "hono";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { WithEnv } from "../../utils/commonTypes";
import { ErrorCodes, type Result } from "../../utils/error";

const SESSION_COOKIE_NAME = "commit_lens_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const SessionPayloadSchema = z.object({
  userId: z.string(),
  githubLogin: z.string(),
  exp: z.number(),
});

export type SessionPayload = z.infer<typeof SessionPayloadSchema>;

export type SessionUser = {
  id: string;
  githubLogin: string;
};

type AppContext = Context<{
  Bindings: Env;
  Variables: {
    authUser: SessionUser;
  };
}>;

function shouldUseSecureCookies(env: Env): boolean {
  try {
    return new URL(env.FRONTEND_URL).protocol === "https:";
  } catch {
    return false;
  }
}

export async function createSessionToken({
  env,
  userId,
  githubLogin,
}: WithEnv<{
  userId: string;
  githubLogin: string;
}>): Promise<string> {
  return jwt.sign(
    {
      userId,
      githubLogin,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    },
    env.JWT_SECRET
  );
}

export async function verifySessionToken({
  env,
  token,
}: WithEnv<{
  token: string;
}>): Promise<Result<SessionPayload>> {
  const isValid = await jwt.verify(token, env.JWT_SECRET);

  if (!isValid) {
    return {
      ok: false,
      errorCode: ErrorCodes.AUTH_SESSION_INVALID,
      error: "Invalid session token",
    } as const;
  }

  const decoded = jwt.decode(token);
  const payloadValidation = SessionPayloadSchema.safeParse(decoded.payload);

  if (!payloadValidation.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.AUTH_SESSION_INVALID,
      error: payloadValidation.error.message,
    } as const;
  }

  return {
    ok: true,
    data: payloadValidation.data,
  } as const;
}

export async function getSessionUser(c: AppContext): Promise<SessionUser | null> {
  const token = getCookie(c, SESSION_COOKIE_NAME);

  if (!token) {
    return null;
  }

  const session = await verifySessionToken({
    env: c.env,
    token,
  });

  if (!session.ok) {
    return null;
  }

  return {
    id: session.data.userId,
    githubLogin: session.data.githubLogin,
  };
}

export function setSessionCookie(c: AppContext, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: shouldUseSecureCookies(c.env),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: "Lax",
    secure: shouldUseSecureCookies(c.env),
  });
}

export function requireSession(): MiddlewareHandler<{
  Bindings: Env;
  Variables: {
    authUser: SessionUser;
  };
}> {
  return async (c, next) => {
    const sessionUser = await getSessionUser(c);

    if (!sessionUser) {
      return c.json(
        {
          ok: false,
          errorCode: ErrorCodes.AUTH_SESSION_INVALID,
          error: "Unauthorized",
        } as const,
        401
      );
    }

    c.set("authUser", sessionUser);
    await next();
  };
}
