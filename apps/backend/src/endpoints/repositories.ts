import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { getInstallationsForUser, deleteInstallation } from "../features/repository";
import { csrfProtect } from "../middleware/csrf";
import { verifySession } from "../features/auth/session";
import { getCookie } from "hono/cookie";

export const repositoriesEndpoint = getHono();

repositoriesEndpoint.get("/", async (c) => {
  const session = getCookie(c, "session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { ok, payload } = await verifySession({ token: session, secret: c.env.JWT_SECRET });
  if (!ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = connectDb({ env: c.env });
  const installations = await getInstallationsForUser({ userId: payload.userId, db });

  // In a real app, you would use the installation to fetch the repositories
  // from the GitHub API.
  const repositories = installations.map((inst) => ({
    id: inst.installationId,
    name: inst.accountLogin,
    avatarUrl: inst.accountAvatarUrl,
  }));

  return c.json({
    ok: true,
    data: repositories,
  });
});

repositoriesEndpoint.delete("/:installationId", csrfProtect, async (c) => {
  const session = getCookie(c, "session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { ok, payload } = await verifySession({ token: session, secret: c.env.JWT_SECRET });
  if (!ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const installationId = c.req.param("installationId");
  const db = connectDb({ env: c.env });

  const deleted = await deleteInstallation({
    installationId,
    userId: payload.userId,
    db,
  });

  if (deleted) {
    return c.json({ ok: true, message: "Installation deleted" });
  } else {
    return c.json({ ok: false, error: "Installation not found or unauthorized" }, 404);
  }
});


