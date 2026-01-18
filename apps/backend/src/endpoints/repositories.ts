import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { getInstallationsForUser, deleteInstallation, getRepositoriesForUser } from "../features/repository";
import { csrfProtect } from "../middleware/csrf";
import { getAuth } from "@hono/clerk-auth";

export const repositoriesEndpoint = getHono();

repositoriesEndpoint.get("/", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = connectDb({ env: c.env });
  const repositories = await getRepositoriesForUser({ userId: auth.userId, db });

  return c.json({
    ok: true,
    data: repositories,
  });
});

repositoriesEndpoint.delete("/:installationId", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const installationId = c.req.param("installationId");
  const db = connectDb({ env: c.env });

  const deleted = await deleteInstallation({
    installationId,
    userId: auth.userId,
    db,
    env: c.env,
  });

  if (deleted) {
    return c.json({ ok: true, message: "Installation deleted" });
  } else {
    return c.json({ ok: false, error: "Installation not found or unauthorized" }, 404);
  }
});


