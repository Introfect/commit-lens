import { OpenAPIHono } from "@hono/zod-openapi";

export function getHono() {
  const app = new OpenAPIHono<{ Bindings: Env }>();
  
  return app;
}
