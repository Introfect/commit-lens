import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// Stores core user information keyed by the GitHub OAuth identity.
export const UserTable = pgTable("user", {
  id: text("id").primaryKey(),
  githubLogin: text("github_login").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Legacy OAuth account linkage table kept for compatibility with older data.
export const OAuthAccountTable = pgTable(
  "oauth_account",
  {
    providerId: text("provider_id").notNull(), // 'google' or 'github'
    providerUserId: text("provider_user_id").notNull(), // The user's ID from the provider
    userId: text("user_id")
      .notNull()
      .references(() => UserTable.id),
    // Sensitive tokens should be encrypted before being stored here.
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.providerId, t.providerUserId] }),
  })
);

// Stores information about repositories a user has connected via a GitHub App installation.
export const RepositoryInstallationTable = pgTable(
  "repository_installation",
  {
    installationId: text("installation_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => UserTable.id),
    // Could also store account login (user or org name)
    accountLogin: text("account_login").notNull(),
    accountAvatarUrl: text("account_avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// Stores actual repository information fetched from GitHub
export const RepositoryTable = pgTable("repository", {
  id: text("id").primaryKey(), // GitHub repository ID
  installationId: text("installation_id")
    .notNull()
    .references(() => RepositoryInstallationTable.installationId),
  name: text("name").notNull(), // e.g., "commit-lens"
  fullName: text("full_name").notNull(), // e.g., "username/commit-lens"
  owner: text("owner").notNull(), // GitHub username or org
  description: text("description"),
  isPrivate: text("is_private").notNull().$type<"true" | "false">().default("false"),
  isActive: boolean("is_active").notNull().default(true),
  isRemovedFromWorkspace: boolean("is_removed_from_workspace").notNull().default(false),
  defaultBranch: text("default_branch"),
  htmlUrl: text("html_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Stores pull request events received from GitHub webhooks
export const PullRequestEventTable = pgTable("pull_request_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => RepositoryTable.id),
  prNumber: text("pr_number").notNull(), // Using text for consistency
  action: text("action").notNull(), // 'opened', 'synchronize', 'closed', etc.
  title: text("title").notNull(),
  body: text("body"), // PR description
  author: text("author").notNull(), // GitHub username
  authorAvatarUrl: text("author_avatar_url"),
  baseBranch: text("base_branch").notNull(),
  headBranch: text("head_branch").notNull(),
  headSha: text("head_sha").notNull(), // Commit SHA of the PR head
  state: text("state").notNull(), // 'open', 'closed'
  merged: text("merged").notNull().$type<"true" | "false">().default("false"),
  htmlUrl: text("html_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(), // When PR was created on GitHub
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(), // When PR was last updated on GitHub
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(), // When we received the webhook
  isActive: boolean("is_active").notNull().default(true),
  reviewStatus: text("review_status").notNull().$type<"idle" | "reviewing" | "reviewed" | "failed">().default("idle"),
});

export const PullRequestReviewArtifactTable = pgTable("pull_request_review_artifact", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => PullRequestEventTable.id),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => RepositoryTable.id),
  prNumber: text("pr_number").notNull(),
  headSha: text("head_sha").notNull(),
  overallBody: text("overall_body").notNull(),
  prSummary: text("pr_summary").notNull(),
  confidenceScore: integer("confidence_score").notNull(),
  confidenceReason: text("confidence_reason").notNull(),
  githubReviewId: text("github_review_id"),
  reviewEvent: text("review_event")
    .notNull()
    .$type<"COMMENT" | "APPROVE" | "REQUEST_CHANGES">(),
  postingStatus: text("posting_status")
    .notNull()
    .$type<"pending" | "posted" | "partially_posted" | "failed">()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const PullRequestInlineCommentTable = pgTable("pull_request_inline_comment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reviewArtifactId: text("review_artifact_id")
    .notNull()
    .references(() => PullRequestReviewArtifactTable.id),
  path: text("path").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  severity: text("severity")
    .notNull()
    .$type<"error" | "warning" | "info">(),
  line: integer("line"),
  side: text("side").$type<"LEFT" | "RIGHT">(),
  startLine: integer("start_line"),
  startSide: text("start_side").$type<"LEFT" | "RIGHT">(),
  subjectType: text("subject_type")
    .notNull()
    .$type<"line" | "file">()
    .default("line"),
  githubReviewCommentId: text("github_review_comment_id"),
  anchorStatus: text("anchor_status")
    .notNull()
    .$type<"anchored" | "file_level" | "unanchored" | "failed">()
    .default("unanchored"),
  anchorFailureReason: text("anchor_failure_reason"),
  fixPromptStatus: text("fix_prompt_status")
    .notNull()
    .$type<"not_generated" | "generated">()
    .default("not_generated"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
