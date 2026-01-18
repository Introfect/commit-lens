import { getHono } from "./utils/hono";
import { clerkMiddleware } from "@hono/clerk-auth";
import { githubEndpoint } from "./endpoints/github";
import { repositoriesEndpoint } from "./endpoints/repositories";
import { webhooksEndpoint } from "./endpoints/webhooks";
import { eventsEndpoint } from "./endpoints/events";
import { cors } from "hono/cors";

// Start a Hono app
const app = getHono();

// Add CORS middleware
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Frontend origins
    allowHeaders: ["Content-Type", "Authorization", "X-GitHub-Event", "X-GitHub-Delivery", "X-Hub-Signature-256"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.use("*", clerkMiddleware());
app.route("api/v1/github", githubEndpoint);
app.route("api/v1/repositories", repositoriesEndpoint);
app.route("api/v1/webhooks", webhooksEndpoint);
app.route("api/v1/events", eventsEndpoint);

export default app;
