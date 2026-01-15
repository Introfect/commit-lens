import type { MetaFunction } from 'react-router';
import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth/hooks';
import { SignupForm } from '../components/SignupForm';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sign Up - Your App' },
    { name: 'description', content: 'Create a new account' },
  ];
};

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated) {
      navigate('/home');
    }
  }, [mounted, isLoading, isAuthenticated, navigate]);

  const handleSignupSuccess = () => {
    navigate('/home');
  };

  // Don't render anything until mounted and auth state is determined
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If already authenticated, don't show signup form
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Sign in here
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <SignupForm onSuccess={handleSignupSuccess} />
        </div>
      </div>
    </div>
  );
} 