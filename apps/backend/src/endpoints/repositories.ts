import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import {
  getRepositoriesForUser,
  removeRepositoryFromWorkspace,
} from "../features/repository";
import { requireSession } from "../features/auth/session";

export const repositoriesEndpoint = getHono();

repositoriesEndpoint.use("*", requireSession());

repositoriesEndpoint.get("/", async (c) => {
  const authUser = c.get("authUser");
  const db = connectDb({ env: c.env });
  const repositories = await getRepositoriesForUser({ userId: authUser.id, db });

  return c.json({
    ok: true,
    data: repositories,
  });
});

repositoriesEndpoint.delete("/:repositoryId", async (c) => {
  const authUser = c.get("authUser");
  const repositoryId = c.req.param("repositoryId");
  const db = connectDb({ env: c.env });

  const deleted = await removeRepositoryFromWorkspace({
    repositoryId,
    userId: authUser.id,
    db,
  });

  if (deleted) {
    return c.json({ ok: true, message: "Repository removed from workspace" });
  } else {
    return c.json({ ok: false, error: "Repository not found or unauthorized" }, 404);
  }
});
