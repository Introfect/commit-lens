import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/landing.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route(
    "dashboard/reviews/:reviewArtifactId/comments/:commentId/fix",
    "routes/review-fix-prompt.tsx"
  ),
  route("logout", "routes/logout.tsx"),
] satisfies RouteConfig;
