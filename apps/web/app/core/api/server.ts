const FALLBACK_API_BASE_URL = 'http://localhost:8787/api/v1';

type BackendEnvironment = {
  VITE_BACKEND_BASE_URL?: string;
};

type BackendJsonResult<T> = {
  status: number;
  payload: T | null;
};

export function getBackendApiBaseUrl(env?: BackendEnvironment): string {
  return env?.VITE_BACKEND_BASE_URL ?? FALLBACK_API_BASE_URL;
}

export async function fetchBackendJson<T>({
  request,
  env,
  endpoint,
  init,
}: {
  request: Request;
  env?: BackendEnvironment;
  endpoint: string;
  init?: RequestInit;
}): Promise<BackendJsonResult<T>> {
  const headers = new Headers(init?.headers);
  const cookie = request.headers.get('Cookie');

  if (cookie) {
    headers.set('Cookie', cookie);
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getBackendApiBaseUrl(env)}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const payload = (await response.json().catch(() => null)) as T | null;

  return {
    status: response.status,
    payload,
  };
}
