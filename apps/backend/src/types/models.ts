import { z } from "zod";

// User model
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Repository model
export const RepositorySchema = z.object({
  id: z.string(),
  installationId: z.string(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  description: z.string().nullable(),
  isPrivate: z.enum(["true", "false"]),
  defaultBranch: z.string().nullable(),
  htmlUrl: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Repository = z.infer<typeof RepositorySchema>;

// Pull Request Event model
export const PullRequestEventSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  prNumber: z.string(),
  action: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  author: z.string(),
  authorAvatarUrl: z.string().nullable(),
  baseBranch: z.string(),
  headBranch: z.string(),
  headSha: z.string(),
  state: z.string(),
  merged: z.enum(["true", "false"]),
  htmlUrl: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  receivedAt: z.date(),
});

export type PullRequestEvent = z.infer<typeof PullRequestEventSchema>;

// API Response types
export const RepositoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
  defaultBranch: z.string().nullable(),
  htmlUrl: z.string(),
});

export type RepositoryResponse = z.infer<typeof RepositoryResponseSchema>;

export const PullRequestEventResponseSchema = z.object({
  id: z.string(),
  repository: RepositoryResponseSchema,
  prNumber: z.number(),
  action: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  author: z.object({
    username: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  baseBranch: z.string(),
  headBranch: z.string(),
  headSha: z.string(),
  state: z.string(),
  merged: z.boolean(),
  htmlUrl: z.string(),
  createdAt: z.string(), // ISO string
  updatedAt: z.string(), // ISO string
  receivedAt: z.string(), // ISO string
});

export type PullRequestEventResponse = z.infer<typeof PullRequestEventResponseSchema>;
