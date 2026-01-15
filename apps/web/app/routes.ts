import { type RouteConfig, index, route, prefix } from "@react-router/dev/routes";

export default [
  // ...prefix("/home", [
    index("routes/home.tsx"),
    route("/login", "routes/login.tsx"),
    route("/signup", "routes/signup.tsx"),

  // ]),
] satisfies RouteConfig;
