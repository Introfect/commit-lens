import React, { createContext, useContext, useEffect, useState } from 'react';
import type { paths } from '../api/types';
import { client } from '../api/client';
import { getClientAuthCookie, setClientAuthCookie, clearClientAuthCookie } from './cookies';

// Type definitions from API
type LoginResponse = paths['/api/v1/auth/login']['post']['responses']['200']['content']['application/json'];
type SignupResponse = paths['/api/v1/auth/signup']['post']['responses']['200']['content']['application/json'];
type UserInfoResponse = paths['/api/v1/auth/info']['post']['responses']['200']['content']['application/json'];
type User = UserInfoResponse['data'];

interface AuthState {
  user: User | null;
  apiKey: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, name: string, company: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface AuthContextValue extends AuthState, AuthActions {}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  initialApiKey?: string | null;
}

export function AuthProvider({ children, initialApiKey }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    apiKey: initialApiKey || null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load user data when apiKey is available
  useEffect(() => {
    const loadUser = async () => {
      const apiKey = authState.apiKey || getClientAuthCookie();
      
      if (!apiKey) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
        }));
        return;
      }

      try {
        const response = await client.POST('/api/v1/auth/info', {
          params: {
            header: {
              'x-api-key': apiKey,
            },
          },
        });

        if (response.data?.ok) {
          setAuthState(prev => ({
            ...prev,
            user: response.data.data,
            apiKey,
            isLoading: false,
            isAuthenticated: true,
          }));
        } else {
          // Invalid token, clear it
          clearClientAuthCookie();
          setAuthState(prev => ({
            ...prev,
            user: null,
            apiKey: null,
            isLoading: false,
            isAuthenticated: false,
          }));
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        clearClientAuthCookie();
        setAuthState(prev => ({
          ...prev,
          user: null,
          apiKey: null,
          isLoading: false,
          isAuthenticated: false,
        }));
      }
    };

    loadUser();
  }, [authState.apiKey]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await client.POST('/api/v1/auth/login', {
        body: {
          email,
          plainTextPassword: password,
        },
      });

      if (response.data?.ok) {
        const apiKey = response.data.data.apiKey;
        setClientAuthCookie(apiKey);
        
        setAuthState(prev => ({
          ...prev,
          apiKey,
          isLoading: true, // Will trigger user loading
        }));

        return { success: true };
      } else {
        const errorMessage = response.error?.error || 'Login failed';
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    clearClientAuthCookie();
    setAuthState({
      user: null,
      apiKey: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  const signup = async (email: string, name: string, company: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await client.POST('/api/v1/auth/signup', {
        body: {
          email,
          name,
          company,
          plainTextPassword: password,
        },
      });

      if (response.data?.ok) {
        const apiKey = response.data.data.apiKey;
        setClientAuthCookie(apiKey);
        
        setAuthState(prev => ({
          ...prev,
          apiKey,
          isLoading: true, // Will trigger user loading
        }));

        return { success: true };
      } else {
        const errorMessage = response.error?.error || 'Signup failed';
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const refreshUser = async () => {
    const apiKey = authState.apiKey || getClientAuthCookie();
    if (!apiKey) return;

    try {
      const response = await client.POST('/api/v1/auth/info', {
        params: {
          header: {
            'x-api-key': apiKey,
          },
        },
      });

      if (response.data?.ok) {
        setAuthState(prev => ({
          ...prev,
          user: response.data.data,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const contextValue: AuthContextValue = {
    ...authState,
    login,
    signup,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
} 