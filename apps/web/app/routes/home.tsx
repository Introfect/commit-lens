import type { Route } from "./+types/home";
import { useAuth } from '../lib/auth/hooks';
import { ProtectedRoute } from '../components/ProtectedRoute';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard - Your App" },
    { name: "description", content: "Welcome to your dashboard!" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.cloudflare.env.VALUE_FROM_CLOUDFLARE };
}

function HomePage({ loaderData }: Route.ComponentProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {user?.email} • {user?.company}
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-8">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You have successfully logged in to your account. This is a protected route that requires authentication.
            </p>
            
            {loaderData.message && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
                <p className="text-sm">
                  <strong>Server message:</strong> {loaderData.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home(props: Route.ComponentProps) {
  return (
    <ProtectedRoute>
      <HomePage {...props} />
    </ProtectedRoute>
  );
}
