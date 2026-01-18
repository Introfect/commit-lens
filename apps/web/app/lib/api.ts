import type { RepositoryResponse, PullRequestEventResponse, ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api/v1';

interface RequestOptions extends RequestInit {
  token?: string | null;
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    // Add Authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...fetchOptions,
      headers,
      credentials: 'include', // Important for cookies
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || `API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Typed API methods
  async getRepositories(token?: string | null): Promise<ApiResponse<RepositoryResponse[]>> {
    return this.get<ApiResponse<RepositoryResponse[]>>('/repositories', { token });
  }

  async getPullRequestEvents(token?: string | null): Promise<ApiResponse<PullRequestEventResponse[]>> {
    return this.get<ApiResponse<PullRequestEventResponse[]>>('/events/pull-requests', { token });
  }

  async disconnectRepository(installationId: string, token?: string | null): Promise<ApiResponse<{ message: string }>> {
    return this.delete<ApiResponse<{ message: string }>>(`/repositories/${installationId}`, { token });
  }

  // GitHub connection
  connectGitHub() {
    window.location.href = `${API_BASE_URL}/github/redirect`;
  }
}

export const api = new ApiClient();
