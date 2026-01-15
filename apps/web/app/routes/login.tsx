import type { Route } from "./+types/login";
import { Navigate, useNavigate } from 'react-router';
import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../lib/auth/hooks';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign In - Your App" },
    { name: "description", content: "Sign in to your account" },
  ];
}

export default function Login({}: Route.ComponentProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your credentials to access your account
          </p>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign up here
            </button>
          </p>
        </div>
        
        <LoginForm 
          onSuccess={() => {
            // Navigation will happen automatically via auth context
            // The redirect happens in the useAuth effect when isAuthenticated becomes true
          }}
        />
      </div>
    </div>
  );
} 