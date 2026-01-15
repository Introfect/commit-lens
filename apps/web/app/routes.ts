import {
  type RouteConfig,
  index,
  route,
  prefix,
} from "@react-router/dev/routes";

export default [route("/", "routes/home.tsx")] satisfies RouteConfig;
