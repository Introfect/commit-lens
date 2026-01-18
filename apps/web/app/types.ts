// Backend API response types

export type RepositoryResponse = {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string | null;
  htmlUrl: string;
};

export type PullRequestEventResponse = {
  id: string;
  repository: RepositoryResponse;
  prNumber: number;
  action: string;
  title: string;
  body: string | null;
  author: {
    username: string;
    avatarUrl: string | null;
  };
  baseBranch: string;
  headBranch: string;
  headSha: string;
  state: string;
  merged: boolean;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  receivedAt: string;
};

// API response wrappers
export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  count?: number;
  message?: string;
  error?: string;
};

// For backward compatibility with existing code
export type Repository = RepositoryResponse;

export type PullRequestEvent = PullRequestEventResponse;
