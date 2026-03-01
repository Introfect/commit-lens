import { z } from "zod";

// User model
export const UserSchema = z.object({
  id: z.string(),
  githubLogin: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
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
  installationId: z.string(),
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
  reviewStatus: z.enum(["idle", "reviewing", "reviewed", "failed"]),
});

export type PullRequestEventResponse = z.infer<typeof PullRequestEventResponseSchema>;

export const ReviewInlineCommentResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  body: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  line: z.number().int().positive().nullable(),
  side: z.enum(["LEFT", "RIGHT"]).nullable(),
  startLine: z.number().int().positive().nullable(),
  startSide: z.enum(["LEFT", "RIGHT"]).nullable(),
  subjectType: z.enum(["line", "file"]),
  anchorStatus: z.enum(["anchored", "file_level", "unanchored", "failed"]),
  anchorFailureReason: z.string().nullable(),
  githubReviewCommentId: z.string().nullable(),
});

export type ReviewInlineCommentResponse = z.infer<typeof ReviewInlineCommentResponseSchema>;

export const ReviewArtifactResponseSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  prNumber: z.number(),
  headSha: z.string(),
  prSummary: z.string(),
  confidenceScore: z.number().int().min(1).max(10),
  confidenceReason: z.string(),
  postingStatus: z.enum(["pending", "posted", "partially_posted", "failed"]),
  reviewEvent: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]),
  overallBody: z.string(),
  inlineComments: z.array(ReviewInlineCommentResponseSchema),
});

export type ReviewArtifactResponse = z.infer<typeof ReviewArtifactResponseSchema>;

export const FixPromptResponseSchema = z.object({
  commentId: z.string(),
  reviewArtifactId: z.string(),
  repositoryFullName: z.string(),
  prNumber: z.number(),
  prSummary: z.string(),
  confidenceScore: z.number().int().min(1).max(10),
  confidenceReason: z.string(),
  prompt: z.string(),
  copiedHint: z.string(),
  comment: ReviewInlineCommentResponseSchema,
});

export type FixPromptResponse = z.infer<typeof FixPromptResponseSchema>;
