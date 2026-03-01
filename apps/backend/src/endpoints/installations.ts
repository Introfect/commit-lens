import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { requireSession } from "../features/auth/session";
import { disconnectInstallation } from "../features/repository";

export const installationsEndpoint = getHono();

installationsEndpoint.use("*", requireSession());

installationsEndpoint.delete("/:installationId", async (c) => {
  const authUser = c.get("authUser");
  const installationId = c.req.param("installationId");
  const db = connectDb({ env: c.env });

  const disconnected = await disconnectInstallation({
    installationId,
    userId: authUser.id,
    db,
  });

  if (disconnected) {
    return c.json({
      ok: true,
      message: "GitHub App installation disconnected",
    });
  }

  return c.json(
    {
      ok: false,
      error: "Installation not found or unauthorized",
    },
    404
  );
});
