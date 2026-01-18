import {
  isRouteErrorResponse,
  useRouteError,
  Outlet,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { RootLayout } from "./layout";
import { ClerkProvider } from "@clerk/react-router";
import { rootAuthLoader, clerkMiddleware } from "@clerk/react-router/server";
import "./app.css";


// @ts-ignore
export const middleware: Route.MiddlewareFunction[] = [clerkMiddleware()];

export async function loader(args: Route.LoaderArgs) {
  return rootAuthLoader(args, {
    secretKey: args.context.cloudflare.env.CLERK_SECRET_KEY,
    publishableKey: args.context.cloudflare.env.CLERK_PUBLISHABLE_KEY,
  });
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ClerkProvider loaderData={loaderData}>
      <RootLayout>
         <Outlet />
      </RootLayout>
    </ClerkProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let status = 500;
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.statusText;
  }

  return (
    <RootLayout>
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h1 className="text-4xl font-bold">{status}</h1>
        <p className="mt-2 text-lg text-gray-600">{message}</p>
      </div>
    </RootLayout>
  );
}
