import type { Route } from "./+types/home";
import { useAuth } from "../lib/auth/hooks";
import { ProtectedRoute } from "../components/ProtectedRoute";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard - Your App" },
    { name: "description", content: "Welcome to your dashboard!" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: "Hello from Cloudflare Workers" };
}

export default function Home(props: Route.ComponentProps) {
  return <div>Home</div>;
}
