import { getHono } from "./utils/hono";
import { authEndpoint } from "./endpoints/auth";
import { githubEndpoint } from "./endpoints/github";
import { repositoriesEndpoint } from "./endpoints/repositories";
import { cors } from "hono/cors";

// Start a Hono app
const app = getHono();
// Add CORS middleware
app.use(
  "*",
  cors({
    origin: ["*"],
  })
);
app.doc("/doc", {
  info: {
    title: "CommitLens Backend API",
    description: "API for CommitLens, a frontend-focused code review platform.",
    version: "0.0.1",
  },
  openapi: "3.0.0",
});

app.route("api/v1/auth", authEndpoint);
app.route("api/v1/github", githubEndpoint);
app.route("api/v1/repositories", repositoriesEndpoint);

export default app;
