import { z } from "zod";

// GitHub webhook event types
export const GitHubWebhookHeadersSchema = z.object({
  "x-github-event": z.string(),
  "x-github-delivery": z.string(),
  "x-hub-signature-256": z.string(),
});

export type GitHubWebhookHeaders = z.infer<typeof GitHubWebhookHeadersSchema>;

// Pull Request webhook payload (simplified)
export const GitHubPullRequestWebhookSchema = z.object({
  action: z.enum(["opened", "synchronize", "closed", "reopened", "edited"]),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    state: z.enum(["open", "closed"]),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: z.object({
      login: z.string(),
      avatar_url: z.string(),
    }),
    merged: z.boolean(),
    head: z.object({
      ref: z.string(), // branch name
      sha: z.string(),
    }),
    base: z.object({
      ref: z.string(), // branch name
      sha: z.string(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
    private: z.boolean(),
    html_url: z.string(),
    description: z.string().nullable(),
    default_branch: z.string(),
  }),
  installation: z.object({
    id: z.number(),
  }).optional(),
});

export type GitHubPullRequestWebhook = z.infer<typeof GitHubPullRequestWebhookSchema>;

export const GitHubInstallationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number(),
    account: z.object({
      login: z.string().optional(),
      avatar_url: z.string().optional(),
    }).optional(),
    repository_selection: z.string().optional(),
    permissions: z.record(z.string()).optional(),
  }),
});

export type GitHubInstallationEvent = z.infer<typeof GitHubInstallationEventSchema>;

// GitHub API response types

export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
  }),
  private: z.boolean(),
  description: z.string().nullable(),
  html_url: z.string(),
  default_branch: z.string(),
});

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

export const GitHubInstallationRepositoriesResponseSchema = z.object({
  repositories: z.array(GitHubRepositorySchema),
});

export type GitHubInstallationRepositoriesResponse = z.infer<
  typeof GitHubInstallationRepositoriesResponseSchema
>;

export const GitHubInstallationSchema = z.object({
  id: z.number(),
  account: z.object({
    login: z.string(),
    avatar_url: z.string(),
  }),
});

export type GitHubInstallation = z.infer<typeof GitHubInstallationSchema>;

export const GitHubInstallationAccessTokenSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
});

export type GitHubInstallationAccessToken = z.infer<typeof GitHubInstallationAccessTokenSchema>;

// GitHub App JWT payload
export const GitHubAppJWTPayloadSchema = z.object({
  iat: z.number(), // Issued at
  exp: z.number(), // Expiration
  iss: z.string(), // Issuer (GitHub App ID)
});

export type GitHubAppJWTPayload = z.infer<typeof GitHubAppJWTPayloadSchema>;

const GitHubStateBaseSchema = z.object({
  flow: z.enum(["github_oauth", "github_app_install"]),
  timestamp: z.number(),
  exp: z.number().optional(),
});

export const GitHubOAuthStateSchema = GitHubStateBaseSchema.extend({
  flow: z.literal("github_oauth"),
  redirectTo: z.string().startsWith("/").optional(),
});

export type GitHubOAuthState = z.infer<typeof GitHubOAuthStateSchema>;

export const GitHubAppStateSchema = GitHubStateBaseSchema.extend({
  flow: z.literal("github_app_install"),
  userId: z.string(),
});

export type GitHubAppState = z.infer<typeof GitHubAppStateSchema>;

export const GitHubOAuthUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  email: z.string().email().nullable(),
});

export type GitHubOAuthUser = z.infer<typeof GitHubOAuthUserSchema>;

export const GitHubEmailSchema = z.object({
  email: z.string().email(),
  primary: z.boolean(),
  verified: z.boolean(),
  visibility: z.string().nullable(),
});

export type GitHubEmail = z.infer<typeof GitHubEmailSchema>;

export const GitHubPullRequestDetailsSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  html_url: z.string(),
  state: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changed_files: z.number(),
  user: z.object({
    login: z.string(),
    avatar_url: z.string().nullable(),
  }),
  head: z.object({
    sha: z.string(),
    ref: z.string(),
  }),
  base: z.object({
    sha: z.string(),
    ref: z.string(),
  }),
});

export type GitHubPullRequestDetails = z.infer<typeof GitHubPullRequestDetailsSchema>;

export const GitHubPullRequestFileSchema = z.object({
  sha: z.string().nullable().optional(),
  filename: z.string(),
  status: z.enum(["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"]),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  blob_url: z.string().nullable().optional(),
  raw_url: z.string().nullable().optional(),
  contents_url: z.string().nullable().optional(),
  patch: z.string().nullable().optional(),
  previous_filename: z.string().optional(),
});

export type GitHubPullRequestFile = z.infer<typeof GitHubPullRequestFileSchema>;

export const GitHubPullRequestFilesSchema = z.array(GitHubPullRequestFileSchema);

export const GitHubRepositoryContentFileSchema = z.object({
  type: z.literal("file"),
  encoding: z.string(),
  size: z.number(),
  name: z.string(),
  path: z.string(),
  content: z.string(),
  sha: z.string(),
});

export type GitHubRepositoryContentFile = z.infer<typeof GitHubRepositoryContentFileSchema>;

export const GitHubPullRequestReviewResponseSchema = z.object({
  id: z.number(),
  html_url: z.string().nullable().optional(),
});

export type GitHubPullRequestReviewResponse = z.infer<typeof GitHubPullRequestReviewResponseSchema>;
