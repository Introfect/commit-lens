export type User = {
  id: string;
  githubLogin: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

export type AuthStatusResponse = {
  user: User;
  activeInstallationCount: number;
  installations: Array<{
    installationId: string;
    accountLogin: string;
    accountAvatarUrl: string | null;
  }>;
};

// Backend API response types

export type RepositoryResponse = {
  id: string;
  installationId: string;
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
  reviewStatus: "idle" | "reviewing" | "reviewed" | "failed";
};

export type ReviewInlineCommentResponse = {
  id: string;
  path: string;
  title: string;
  body: string;
  severity: "error" | "warning" | "info";
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  subjectType: "line" | "file";
  anchorStatus: "anchored" | "file_level" | "unanchored" | "failed";
  anchorFailureReason: string | null;
  githubReviewCommentId: string | null;
};

export type FixPromptResponse = {
  commentId: string;
  reviewArtifactId: string;
  repositoryFullName: string;
  prNumber: number;
  prSummary: string;
  confidenceScore: number;
  confidenceReason: string;
  prompt: string;
  copiedHint: string;
  comment: ReviewInlineCommentResponse;
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
