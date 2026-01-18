import {
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// Stores core user information, independent of any auth provider.
// id is typically set to Clerk's userId when using Clerk authentication
export const UserTable = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Links a user to third-party OAuth accounts (Google for auth, GitHub for data).
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
});
