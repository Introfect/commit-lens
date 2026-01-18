import { useNavigate } from "react-router-dom";
import { GoogleIcon } from "~/components/icons";
import { useAuth } from "~/lib/auth/context";
import { useEffect } from "react";

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
          Focus on what matters.
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Commit-lens helps you review code with more context and less noise.
        </p>
        <div className="mt-10">
          <a
            href="/api/auth/google" // Assumes backend has a Google OAuth endpoint
            className="inline-flex items-center justify-center gap-3 rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white shadow-soft-lg transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <GoogleIcon className="h-5 w-5" />
            <span>Login with Google</span>
          </a>
        </div>
      </div>
    </div>
  );
}
