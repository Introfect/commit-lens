import { OpenAPIHono } from "@hono/zod-openapi";
import type { SessionUser } from "../features/auth/session";

export function getHono() {
  const app = new OpenAPIHono<{
    Bindings: Env;
    Variables: {
      authUser: SessionUser;
    };
  }>();
  
  return app;
}
