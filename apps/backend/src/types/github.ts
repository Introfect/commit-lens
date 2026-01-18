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
