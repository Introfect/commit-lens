// Cookie utilities for secure API key management

const AUTH_COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
}

export function setAuthCookie(apiKey: string, options: CookieOptions = {}): string {
  const defaultOptions: CookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    ...options,
  };

  let cookieString = `${AUTH_COOKIE_NAME}=${apiKey}`;
  
  if (defaultOptions.maxAge) {
    cookieString += `; Max-Age=${defaultOptions.maxAge}`;
  }
  
  if (defaultOptions.path) {
    cookieString += `; Path=${defaultOptions.path}`;
  }
  
  if (defaultOptions.httpOnly) {
    cookieString += '; HttpOnly';
  }
  
  if (defaultOptions.secure) {
    cookieString += '; Secure';
  }
  
  if (defaultOptions.sameSite) {
    cookieString += `; SameSite=${defaultOptions.sameSite}`;
  }

  return cookieString;
}

export function getAuthCookie(cookieString?: string): string | null {
  if (!cookieString) return null;
  
  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return cookies[AUTH_COOKIE_NAME] || null;
}

export function clearAuthCookie(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=lax`;
}

// Client-side cookie utilities (for fallback when document is available)
export function setClientAuthCookie(apiKey: string): void {
  if (typeof document !== 'undefined') {
    document.cookie = setAuthCookie(apiKey, { httpOnly: false });
  }
}

export function getClientAuthCookie(): string | null {
  if (typeof document !== 'undefined') {
    return getAuthCookie(document.cookie);
  }
  return null;
}

export function clearClientAuthCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = clearAuthCookie().replace('HttpOnly; ', '');
  }
} 