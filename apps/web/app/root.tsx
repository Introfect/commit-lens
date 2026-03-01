import { isRouteErrorResponse, Outlet, useRouteError } from 'react-router';
import { RootLayout } from './layout';
import './app.css';

export default function App() {
  return (
    <RootLayout>
      <Outlet />
    </RootLayout>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let status = 500;
  let message = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.statusText;
  }

  return (
    <RootLayout>
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-sm uppercase tracking-[0.22em] text-white/35">Application Error</p>
        <h1 className="mt-3 text-5xl font-semibold text-white">{status}</h1>
        <p className="mt-3 max-w-md text-base text-white/55">{message}</p>
      </div>
    </RootLayout>
  );
}
