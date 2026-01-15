import { useAuthContext, type AuthContextValue } from './context';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

// Main auth hook
export function useAuth(): AuthContextValue {
  return useAuthContext();
}

// Hook that requires authentication - redirects to login if not authenticated
export function useRequireAuth(redirectTo: string = '/login'): AuthContextValue {
  const auth = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, navigate, redirectTo]);

  return auth;
}

// Hook for login status only
export function useAuthStatus() {
  const { isLoading, isAuthenticated, user } = useAuthContext();
  return { isLoading, isAuthenticated, user };
}

// Hook for auth actions only
export function useAuthActions() {
  const { login, logout, refreshUser } = useAuthContext();
  return { login, logout, refreshUser };
} 