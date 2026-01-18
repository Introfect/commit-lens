import { getHono } from "../utils/hono";
import { getGoogleOauthClient } from "../features/auth/google";
import { generateState, generateCodeVerifier } from "arctic";
import { OAuth2RequestError } from "arctic";
import { connectDb } from "../features/db/connect";
import { createUser, getUserByEmail } from "../features/user";
import { OAuthAccountTable } from "../features/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { encrypt, decrypt } from "../utils/crypto";
import { csrfProtect } from "../middleware/csrf";
import { createSession, verifySession } from "../features/auth/session";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

export const authEndpoint = getHono();

const GOOGLE_OAUTH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  path: "/",
  maxAge: 60 * 10,
};

authEndpoint.get("/google/redirect", async (c) => {
  const googleOauthClient = getGoogleOauthClient({ env: c.env });
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = await googleOauthClient.createAuthorizationURL(state, codeVerifier, {
    scopes: ["profile", "email"],
  });

  setCookie(c, "google_oauth_state", state, GOOGLE_OAUTH_COOKIE_CONFIG);
  setCookie(
    c,
    "google_oauth_code_verifier",
    codeVerifier,
    GOOGLE_OAUTH_COOKIE_CONFIG
  );

  return c.redirect(url.toString());
});

authEndpoint.get("/google/callback", async (c) => {
  const googleOauthClient = getGoogleOauthClient({ env: c.env });
  const db = connectDb({ env: c.env });

  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, "google_oauth_state");
  const storedCodeVerifier = getCookie(c, "google_oauth_code_verifier");

  if (!code || !state || !storedState || state !== storedState) {
    return c.json({ error: "Invalid request" }, 400);
  }

  try {
    const tokens = await googleOauthClient.validateAuthorizationCode(
      code,
      storedCodeVerifier!
    );
    const googleUserResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );
    const googleUser = (await googleUserResponse.json()) as {
      sub: string;
      name: string;
      email: string;
      picture: string;
    };

    let user = await getUserByEmail({ email: googleUser.email, db });

    const encryptedAccessToken = await encrypt(tokens.accessToken, c.env);
    const encryptedRefreshToken = tokens.refreshToken
      ? await encrypt(tokens.refreshToken, c.env)
      : undefined;

    if (user) {
      const [oauthAccount] = await db
        .select()
        .from(OAuthAccountTable)
        .where(
          and(
            eq(OAuthAccountTable.providerId, "google"),
            eq(OAuthAccountTable.providerUserId, googleUser.sub)
          )
        );

      if (!oauthAccount) {
        // Link account
        await db.insert(OAuthAccountTable).values({
          userId: user.id,
          providerId: "google",
          providerUserId: googleUser.sub,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
        });
      }
    } else {
      const userRes = await createUser({
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        db,
      });

      if (!userRes.ok) {
        return c.json(userRes, 500);
      }
      user = userRes.user;
      await db.insert(OAuthAccountTable).values({
        userId: user.id,
        providerId: "google",
        providerUserId: googleUser.sub,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
      });
    }

    const session = await createSession({ userId: user.id, secret: c.env.JWT_SECRET });
    setCookie(c, "session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return c.redirect("/"); // Redirect to frontend
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      return c.json({ error: "Invalid OAuth request" }, 400);
    }
    return c.json({ error: "An unknown error occurred" }, 500);
  }
});

authEndpoint.get("/me", async (c) => {
  const session = getCookie(c, "session");
  if (!session) {
    return c.json({ user: null });
  }
  const { ok, payload } = await verifySession({ token: session, secret: c.env.JWT_SECRET });
  if (!ok) {
    return c.json({ user: null });
  }

  const db = connectDb({ env: c.env });
  const user = await db.query.UserTable.findFirst({
    where: (users, { eq }) => eq(users.id, payload.userId),
  });

  return c.json({
    ok: true,
    data: user,
  });
});

authEndpoint.post("/logout", csrfProtect, async (c) => {
  deleteCookie(c, "session", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    path: "/",
  });
  return c.json({ ok: true });
});