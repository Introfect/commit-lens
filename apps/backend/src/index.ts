import { Scalar } from "@scalar/hono-api-reference";
import { getHono } from "./utils/hono";
import { authEndpoint } from "./endpoints/auth";
import { cors } from "hono/cors";

// Start a Hono app
const app = getHono();
// Add CORS middleware
  app.use('*', cors({
    origin: ["*"]   
  }));
app.doc("/doc", {
  info: {
    title: "Partnerhsip navigation API",
    description: "API for the Partnership navigation app",
    version: "0.0.0",
  },
  openapi: "3.0.0",
});

app.route("api/v1/auth", authEndpoint);

app.get("/api", Scalar({ url: "/doc", theme: "elysiajs", layout: "classic" }));

export default app;
