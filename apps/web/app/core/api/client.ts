import type {
  ApiResponse,
  AuthStatusResponse,
  PullRequestEventResponse,
  RepositoryResponse,
} from '../../types';

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8787/api/v1';

type RequestOptions = RequestInit;

class ApiClient {
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers);

    headers.set('Content-Type', 'application/json');

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers,
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        typeof errorData === 'object' &&
        errorData !== null &&
        'error' in errorData &&
        typeof errorData.error === 'string'
          ? errorData.error
          : `API Error: ${response.statusText}`;

      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async getCurrentUser(): Promise<ApiResponse<AuthStatusResponse>> {
    return this.get<ApiResponse<AuthStatusResponse>>('/auth/me');
  }

  async getRepositories(): Promise<ApiResponse<RepositoryResponse[]>> {
    return this.get<ApiResponse<RepositoryResponse[]>>('/repositories');
  }

  async getPullRequestEvents(): Promise<ApiResponse<PullRequestEventResponse[]>> {
    return this.get<ApiResponse<PullRequestEventResponse[]>>('/events/pull-requests');
  }

  async removeRepositoryFromWorkspace(
    repositoryId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.delete<ApiResponse<{ message: string }>>(`/repositories/${repositoryId}`);
  }

  async disconnectInstallation(
    installationId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.delete<ApiResponse<{ message: string }>>(`/installations/${installationId}`);
  }

  startGitHubLogin(redirectTo?: string) {
    const url = new URL(`${API_BASE_URL}/auth/github/start`);

    if (redirectTo) {
      url.searchParams.set('redirectTo', redirectTo);
    }

    window.location.href = url.toString();
  }

  manageGitHubRepositories() {
    window.location.href = `${API_BASE_URL}/github/redirect`;
  }

  logout() {
    window.location.href = `${API_BASE_URL}/auth/logout`;
  }
}

export const api = new ApiClient();
