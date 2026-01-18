import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/landing.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("github/callback", "routes/github.callback.tsx"),
  route("logout", "routes/logout.tsx"),
] satisfies RouteConfig;
