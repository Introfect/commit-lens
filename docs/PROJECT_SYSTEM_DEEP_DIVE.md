# CommitLens: Comprehensive System Deep Dive

This document explains how the project works end to end, based on the current code.

It is written to answer:
1. How authentication works.
2. How GitHub App installation and repository sync work.
3. How PR webhooks are processed.
4. What data is sent to AI and how it is formatted.
5. How PR reviews and inline comments are posted back to GitHub.
6. How fix prompts are generated for specific inline comments.
7. What exactly is being compared or validated at each stage.

---

## 1) Product Overview

CommitLens is a GitHub-native PR review pipeline with these major responsibilities:
1. Authenticate users via GitHub OAuth.
2. Connect a GitHub App installation to a user workspace.
3. Sync repositories available to that installation.
4. Receive GitHub webhooks for PR and installation events.
5. Queue and run AI PR reviews in the background.
6. Post overall and inline review comments back to GitHub.
7. Generate code-agent fix prompts for specific inline findings.

---

## 2) Runtime Architecture

Core components:
1. **Frontend** (`apps/web`): React Router app that handles login, dashboard, status, and fix-prompt pages.
2. **Backend API Worker** (`apps/backend/src/index.ts`): Hono API routes under `/api/v1/*`.
3. **Queue Worker** (`apps/backend/src/index.ts` default export `queue`): processes background PR review jobs.
4. **Postgres (via Drizzle ORM)**: stores users, installations, repos, PR events, review artifacts, inline comment artifacts.
5. **GitHub APIs**:
   - OAuth endpoints (via `arctic` GitHub OAuth client).
   - GitHub App installation/token/repo/PR/review/comment endpoints.
   - Webhook delivery.
6. **Gemini API** (`services/gemini.ts`): chunked PR review generation and fix prompt generation.

High-level flow:
1. User logs in.
2. User installs/updates GitHub App access.
3. Repositories are synced to workspace.
4. GitHub sends PR webhooks.
5. Backend stores event and queues job.
6. Queue worker builds context, calls Gemini, anchors comments, posts review.
7. User clicks fix link from GitHub inline comment and gets a generated fix prompt.

---

## 3) Important Environment Variables

From current backend runtime usage:
1. `GITHUB_OAUTH_CLIENT_ID`
2. `GITHUB_OAUTH_CLIENT_SECRET`
3. `GITHUB_OAUTH_REDIRECT_URI`
4. `GITHUB_APP_ID`
5. `GITHUB_APP_PRIVATE_KEY`
6. `GITHUB_APP_SLUG`
7. `GITHUB_APP_REDIRECT_URI` (GitHub App callback setting reference)
8. `GITHUB_WEBHOOK_SECRET`
9. `GEMINI_API_KEY`
10. `FRONTEND_URL`
11. `JWT_SECRET`
12. `ENVIRONMENT`

Frontend:
1. `VITE_BACKEND_BASE_URL`

Critical alignment rules:
1. OAuth callback in GitHub settings must exactly match `GITHUB_OAUTH_REDIRECT_URI`.
2. Install URL uses `GITHUB_APP_SLUG` (`https://github.com/apps/{slug}/installations/new`).
3. GitHub webhook secret must match `GITHUB_WEBHOOK_SECRET`.

---

## 4) Data Model (What Is Persisted)

Tables are defined in `apps/backend/src/features/db/schema.ts`.

### 4.1 `user`
Stores GitHub identity and profile:
1. `id` (GitHub user id string)
2. `githubLogin`
3. `name`, `email`, `avatarUrl`

### 4.2 `repository_installation`
Maps GitHub App installations to a user:
1. `installationId`
2. `userId`
3. `accountLogin`, `accountAvatarUrl`
4. `isActive`

### 4.3 `repository`
Current repository view for each installation:
1. `id` (GitHub repo id)
2. `installationId`
3. `name`, `fullName`, `owner`, `description`, `htmlUrl`, `defaultBranch`
4. `isPrivate` (`"true"` or `"false"`)
5. `isActive`
6. `isRemovedFromWorkspace`

### 4.4 `pull_request_event`
Webhook-derived PR state snapshots:
1. `repositoryId`, `prNumber`, `action`
2. PR metadata (title/body/author/branches/headSha/state/merged/url)
3. `receivedAt` (when webhook received)
4. `reviewStatus`: `"idle" | "reviewing" | "reviewed" | "failed"`
5. `isActive`

### 4.5 `pull_request_review_artifact`
Stored AI review output and posting state:
1. `eventId`, `repositoryId`, `prNumber`, `headSha`
2. `overallBody`, `prSummary`, `confidenceScore`, `confidenceReason`
3. `reviewEvent` (`COMMENT` / `APPROVE` / `REQUEST_CHANGES`)
4. `githubReviewId`
5. `postingStatus`: `"pending" | "posted" | "partially_posted" | "failed"`

### 4.6 `pull_request_inline_comment`
Stored inline findings and posting/fix state:
1. `reviewArtifactId`
2. `path`, `title`, `body`, `severity`
3. `line`, `side`, `startLine`, `startSide`, `subjectType`
4. `anchorStatus`: `"anchored" | "file_level" | "unanchored" | "failed"`
5. `anchorFailureReason`
6. `githubReviewCommentId`
7. `fixPromptStatus`: `"not_generated" | "generated"`

---

## 5) Authentication Flow (GitHub OAuth)

Main code:
1. `apps/backend/src/endpoints/auth.ts`
2. `apps/backend/src/features/auth/github.ts`
3. `apps/backend/src/features/auth/session.ts`
4. `apps/web/app/routes/landing.tsx`
5. `apps/web/app/core/api/client.ts`

Sequence:
1. Frontend button calls `api.startGitHubLogin()`.
2. Browser navigates to `GET /api/v1/auth/github/start`.
3. Backend validates OAuth env via `hasGitHubOauthConfiguration`.
4. Backend signs JWT `state` with:
   - `flow: "github_oauth"`
   - `timestamp`
   - `exp` (+10 minutes)
   - optional safe `redirectTo`
5. Backend builds GitHub authorize URL via Arctic client (`createAuthorizationURL`).
6. Browser is redirected to GitHub.
7. GitHub callback hits `GET /api/v1/auth/github/callback?code=...&state=...`.
8. Backend verifies `state` signature/schema.
9. Backend exchanges code for access token.
10. Backend fetches GitHub user and primary verified email.
11. Backend upserts user.
12. Backend signs session JWT cookie `commit_lens_session` (7 days) and sets it.
13. Backend redirects to frontend dashboard (or `redirectTo`).

Session model:
1. Stateless JWT cookie.
2. `requireSession()` middleware validates and injects `authUser`.
3. `/auth/me` returns user and active installation summaries.

Debug endpoint:
1. `GET /api/v1/auth/config-check` (non-production only)
2. Returns generated OAuth URL fields and redirect-uri consistency checks.

---

## 6) GitHub App Installation and Repository Add Flow

Main code:
1. `apps/web/app/routes/dashboard.tsx` (`onPrimaryAction -> api.manageGitHubRepositories()`)
2. `apps/web/app/core/api/client.ts` (`/github/redirect`)
3. `apps/backend/src/endpoints/github.ts`
4. `apps/backend/src/features/repository.ts`

### 6.1 Start install/manage redirect
`GET /api/v1/github/redirect`:
1. Requires session.
2. Validates GitHub App config (`slug`, `app id`, private key).
3. Signs install `state` JWT:
   - `flow: "github_app_install"`
   - `userId`
   - `timestamp`
   - `exp` (+10 minutes)
4. If user has primary installation: redirect to GitHub installation manage URL.
5. Else: redirect to `https://github.com/apps/{GITHUB_APP_SLUG}/installations/new?state=...`.

### 6.2 GitHub callback and installation ownership
`GET /api/v1/github/callback`:
1. Reads `installation_id`, `setup_action`, `state`.
2. Resolves user:
   - Prefer verified signed `state.userId`.
   - Fallback to active session user.
3. Fetches installation details from GitHub API.
4. Upserts `repository_installation`:
   - insert if new
   - reject if installation belongs to another user (`installation-conflict`)
   - reactivate/update if same user
5. Triggers `syncRepositoriesForInstallation(..., mode: "user_manage")`.
6. Redirects to dashboard with status query params (`sync`, `connected`, `reactivated`, or error).

### 6.3 Repository sync behavior (core logic)
`syncRepositoriesForInstallation` does:
1. Fetch repositories from GitHub installation API.
2. For each repo:
   - upsert metadata in `repository` table
   - `mode: "user_manage"` restores visibility (`isRemovedFromWorkspace=false`)
   - `mode: "background"` preserves removed-from-workspace hidden state
3. Deactivates repos no longer returned by GitHub.
4. Deactivates PR events for deactivated repos.
5. Reactivates PR events for restored repos.
6. Returns summary counts:
   - `addedCount`
   - `restoredCount`
   - `deactivatedCount`
   - `hiddenCount`

Repository removal vs installation disconnect:
1. Remove repository (`DELETE /repositories/:id`):
   - marks `isRemovedFromWorkspace=true`
   - keeps installation active
2. Disconnect installation (`DELETE /installations/:id`):
   - marks installation inactive
   - deactivates all repos and related PR events

---

## 7) Webhook Ingestion Flow

Main code:
1. `apps/backend/src/endpoints/webhooks.ts`
2. `apps/backend/src/services/github.ts` (`verifyWebhookSignature`)

Endpoint:
1. `POST /api/v1/webhooks/github`

Validation steps:
1. Requires headers:
   - `x-hub-signature-256`
   - `x-github-event`
   - `x-github-delivery`
2. Reads raw request body.
3. Verifies HMAC SHA-256 signature using `GITHUB_WEBHOOK_SECRET`.

Event routing:
1. `pull_request` -> `handlePullRequestEvent`
2. `installation` / `installation_repositories` -> `handleInstallationEvent`
3. Others -> acknowledged but ignored

Supported PR actions for AI review:
1. `opened`
2. `synchronize`
3. `reopened`

Non-supported actions are acknowledged and skipped.

---

## 8) What We Read from GitHub PR Webhook Payload

Schema: `apps/backend/src/types/github.ts` (`GitHubPullRequestWebhookSchema`)

Used fields include:
1. `action`
2. `pull_request.number`
3. `pull_request.state`
4. `pull_request.title`
5. `pull_request.body`
6. `pull_request.html_url`
7. `pull_request.user.login`
8. `pull_request.user.avatar_url`
9. `pull_request.merged`
10. `pull_request.head.ref`
11. `pull_request.head.sha`
12. `pull_request.base.ref`
13. `pull_request.base.sha`
14. `pull_request.created_at`
15. `pull_request.updated_at`
16. `repository.id`
17. `repository.name`
18. `repository.full_name`
19. `repository.owner.login`
20. `repository.private`
21. `repository.html_url`
22. `repository.description`
23. `repository.default_branch`
24. optional `installation.id`

How webhook data is persisted:
1. Insert or update PR event row keyed by `(repositoryId, prNumber, headSha)`.
2. If same head SHA exists, update event details and set status back to `reviewing`.

---

## 9) Queue and Background Review Execution

Main code:
1. `apps/backend/src/features/prReview.ts` (`queuePullRequestReview`)
2. `apps/backend/src/services/queue.ts`
3. `apps/backend/src/index.ts` queue handler

Flow:
1. Webhook handler stores event and calls `queuePullRequestReview`.
2. `sendToQueue` enqueues `type: "pr_review"` with:
   - `repositoryId`
   - `prNumber`
   - `eventId`
   - `correlationId`
3. Worker queue consumer calls `processQueueJob`.
4. Queue processor calls `performPullRequestReviewInternal`.

---

## 10) PR Review Pipeline (Exact Steps)

Main code:
1. `apps/backend/src/features/prReview.ts`
2. `apps/backend/src/services/github.ts`
3. `apps/backend/src/features/prContext.ts`
4. `apps/backend/src/services/gemini.ts`
5. `apps/backend/src/utils/diffParser.ts`
6. `apps/backend/src/features/reviewArtifact.ts`

Detailed execution:
1. Validate repository exists and is active.
2. Validate PR event exists.
3. Set PR event `reviewStatus = "reviewing"`.
4. Fetch PR details from GitHub.
5. Fetch PR files from GitHub (paginated up to 30 pages x 100 files/page).
6. Build focused project context:
   - read root docs/config candidates (`README`, `package.json`, `tsconfig`, `wrangler`, etc.)
   - include up to 6 changed files with available patch
   - trim documents > 6000 chars (head+tail strategy)
7. Build AI review request:
   - title
   - description (`pullRequestDetails.body` fallback to webhook body)
   - formatted project context block
   - changed file list (`path`, `status`, `patch`)
8. Run chunked Gemini review:
   - split files by max diff chars and file count
   - prompt each chunk
   - gather inline comments + chunk summaries
   - aggregate overall summary across chunks
   - apply dedupe + per-file and global comment limits
9. Decide GitHub review event:
   - `REQUEST_CHANGES` if any inline comment severity is `error`/`warning` or aggregate risks exist
   - otherwise `COMMENT`
10. Parse patch anchors and map model comments to real patch lines.
11. Persist review artifact (`pull_request_review_artifact`) with posting status `pending`.
12. Persist inline comment artifacts (`pull_request_inline_comment`) with anchor status per comment.
13. Build GitHub review payload (overall body + anchored inline comments).
14. Post GitHub review.
15. If inline posting fails and inline comments were included:
   - mark inline comments `failed` with reason
   - retry posting summary-only review
   - mark posting as `partially_posted`
16. Update final artifact posting status:
   - `posted`, `partially_posted`, or `failed`
17. Update PR event status:
   - `reviewed` on success
   - `failed` on failure

---

## 11) What Is Sent to AI and How It Is Formatted

Main code: `apps/backend/src/services/gemini.ts`

### 11.1 PR review request payload
Structure:
1. `title`
2. `description`
3. `projectContext` (large formatted text from focused docs)
4. `changedFiles[]`:
   - `path`
   - `status`
   - `patch` (nullable)

Formatting details:
1. Each file patch is formatted like:
   - `FILE: <path>`
   - `STATUS: <status>`
   - fenced `diff` block if patch exists
2. If patch missing:
   - explicit warning text says no patch available
3. Context docs formatted as:
   - `FILE: ...`
   - `SOURCE: readme|config|changed_file`
   - fenced code block with trimmed content

### 11.2 Review prompt behavior
Chunk prompt instructs model to:
1. Only comment on files in that chunk.
2. Prefer RIGHT side lines.
3. Avoid inventing comments when patch is missing.
4. Return strict JSON with:
   - `prSummary`
   - `confidenceScore`
   - `confidenceReason`
   - `inlineComments[]`
   - `generalFeedback` (`strengths`, `risks`, `recommendations`)

### 11.3 Aggregation prompt behavior
When more than one chunk:
1. Sends chunk summaries to Gemini.
2. Requests single final PR summary and feedback block.
3. Falls back to deterministic aggregate if synthesis fails.

### 11.4 Limits and sanitization
Key limits:
1. Max chunk diff chars: `48 * 1024`
2. Max files per chunk: `24`
3. Max inline comments per PR: `25`
4. Max inline comments per file: `5`
5. Max inline comments per chunk: `12`

Post-processing:
1. Severity-sorted dedupe.
2. Cap per file and overall.
3. Schema-validated JSON parsing with Zod.

---

## 12) How Inline Anchoring Works (What Is Compared)

Main code: `apps/backend/src/utils/diffParser.ts`

Algorithm:
1. Parse each patch hunk (`@@ -old,+new @@`) into line records:
   - add/context/delete
   - oldLineNumber/newLineNumber
2. For each model comment (`file`, `line`, `side`):
   - find matching parsed file by direct path or suffix/previous path heuristic
   - if `side=RIGHT`, line must map to a non-delete patch line by `newLineNumber`
   - if `side=LEFT`, line must map to a non-add patch line by `oldLineNumber`
3. Optional start-range anchor (`startLine`/`startSide`) is validated similarly.
4. If no valid patch anchor found:
   - comment is stored as unanchored artifact
   - not sent as inline GitHub review comment

This is the most concrete "comparison" in inline posting:
1. **Model-proposed line anchors** are compared against **actual patch-derived line maps**.

---

## 13) How PR Reviews Are Posted Back to GitHub

Main code:
1. `apps/backend/src/features/prReview.ts`
2. `apps/backend/src/services/github.ts` (`postPullRequestReview`)

Review body:
1. PR summary
2. confidence score + reason
3. strengths
4. risks
5. recommendations
6. footer warning to validate feedback

Inline comments:
1. Only anchored comments are included.
2. Each inline comment body includes:
   - severity label
   - title/body
   - "Generate Prompt to Fix This" link to frontend route:
     `/dashboard/reviews/{reviewArtifactId}/comments/{commentId}/fix`

GitHub API call:
1. `POST /repos/{owner}/{repo}/pulls/{prNumber}/reviews`
2. Sends:
   - `commit_id`
   - `body`
   - `event` (`COMMENT`/`REQUEST_CHANGES`/`APPROVE`)
   - optional `comments[]` with path/line/side/range

Fallback behavior:
1. If posting with inline comments fails:
   - mark inline comment artifacts failed
   - retry with summary-only review

---

## 14) Fix Prompt Generation Flow (Inline Comment -> Agent Prompt)

Main code:
1. `apps/backend/src/endpoints/prReviews.ts`
2. `apps/backend/src/features/prReview.ts` (`createFixPromptForInlineComment`)
3. `apps/backend/src/services/gemini.ts` (`generateFixPrompt`)
4. `apps/web/app/routes/review-fix-prompt.tsx`

Sequence:
1. User opens fix link from GitHub inline comment.
2. Frontend route loader calls backend `POST /api/v1/pr-reviews/comments/:commentId/fix-prompt`.
3. Backend validates ownership and active installation/repo via join query.
4. Backend builds context:
   - focused project docs at PR head SHA
   - full target file content at same SHA
5. Backend builds `FixPromptRequest`:
   - repository + PR identity
   - stored PR summary/confidence from artifact
   - exact inline comment (file/title/body/severity/line/side)
   - project context
   - target file context
6. Gemini returns plain-text coding-agent prompt.
7. Backend marks comment `fixPromptStatus="generated"`.
8. Frontend displays and auto-copies prompt to clipboard.

---

## 15) What Exactly Is Compared During Fix Prompt Generation

For fix prompt generation, there is no new diff anchor comparison. Instead, the system composes context by combining:
1. Stored inline review finding (what issue was identified).
2. Stored PR-level summary/confidence (why issue matters in broader PR context).
3. Focused repository context documents (conventions/config/relevant docs).
4. Current file content at PR head SHA (exact code snapshot for that comment path).

The Gemini prompt instructs:
1. explain issue clearly,
2. identify exact file/line area,
3. propose expected fix,
4. follow project conventions,
5. avoid unrelated edits,
6. suggest validation/tests.

---

## 16) API Surface (Operationally Important Endpoints)

Public:
1. `GET /api/v1/auth/github/start`
2. `GET /api/v1/auth/github/callback`
3. `GET /api/v1/github/callback`
4. `POST /api/v1/webhooks/github`
5. `GET /api/v1/auth/config-check` (dev only; 404 in production)

Session-protected:
1. `GET /api/v1/auth/me`
2. `GET /api/v1/auth/logout`
3. `GET /api/v1/github/redirect`
4. `GET /api/v1/repositories`
5. `DELETE /api/v1/repositories/:repositoryId`
6. `DELETE /api/v1/installations/:installationId`
7. `GET /api/v1/events/pull-requests`
8. `GET /api/v1/events/repositories`
9. `GET /api/v1/pr-reviews/:repositoryId/:prNumber`
10. `POST /api/v1/pr-reviews/comments/:commentId/fix-prompt`

---

## 17) Logging and Observability

Current logging patterns:
1. Structured JSON logs with:
   - `timestamp`
   - `level`
   - `message`
   - `correlationId`
   - `operation`
   - optional context data
2. Webhook route logs:
   - headers
   - signature verification status
   - event routing decisions
3. OAuth logs:
   - authorization URL generation details
   - code exchange timing
4. GitHub API logs:
   - request start/completion/failure
   - endpoint path
   - status
   - duration
   - metadata (`installationId`, `owner`, `repo`, `prNumber`)
5. Queue logs:
   - enqueue and processing lifecycle

---

## 18) Common Failure Modes and Their Meanings

OAuth:
1. `github-auth-config`: missing OAuth env.
2. `github-auth-state`: invalid/expired state token.
3. `github-auth-token`: code exchange failure.
4. `github-auth-user`: GitHub user fetch failure.
5. `Invalid redirect_uri` at GitHub page: callback mismatch in GitHub settings vs backend redirect URI.

Installation/repo sync:
1. `github-app-config`: missing app slug/id/private key.
2. `installation-conflict`: installation already mapped to another user.
3. `repo-sync-failed`: installation callback succeeded but repo sync failed.

Review pipeline:
1. PR webhook ignored if repo not active in workspace after background sync attempt.
2. Review may become `partially_posted` when inline posting fails or comments are unanchored.
3. Fix prompt unavailable if comment not owned by user or comment id invalid.

---

## 19) How to Move Forward Safely

When extending this app:
1. Keep all auth and callback URLs config-driven.
2. Keep webhook signature verification strict and always use raw payload text.
3. Avoid posting inline comments without patch-based anchor validation.
4. Version prompts deliberately and log prompt version id with artifacts.
5. Add automated tests for:
   - webhook routing and signature checks
   - repository sync modes (`background` vs `user_manage`)
   - inline anchor resolution edge cases
   - review posting fallback behavior
   - fix prompt ownership checks

High-impact next improvements:
1. Add retry/backoff around non-2xx GitHub API responses with rate-limit awareness.
2. Persist model input/output snapshots for auditability (with sensitive redaction).
3. Add deterministic tests around `limitInlineComments` and severity ranking.
4. Expose artifact and inline comment history in dashboard UI.
5. Add per-repository model configuration and rule presets.

---

## 20) Source Map (Where to Read in Code)

Auth and session:
1. `apps/backend/src/endpoints/auth.ts`
2. `apps/backend/src/features/auth/github.ts`
3. `apps/backend/src/features/auth/session.ts`

GitHub App install/sync:
1. `apps/backend/src/endpoints/github.ts`
2. `apps/backend/src/features/repository.ts`

Webhook ingestion:
1. `apps/backend/src/endpoints/webhooks.ts`
2. `apps/backend/src/types/github.ts`

PR review pipeline:
1. `apps/backend/src/features/prReview.ts`
2. `apps/backend/src/services/gemini.ts`
3. `apps/backend/src/services/github.ts`
4. `apps/backend/src/utils/diffParser.ts`
5. `apps/backend/src/features/prContext.ts`
6. `apps/backend/src/features/reviewArtifact.ts`
7. `apps/backend/src/features/pullRequestEvent.ts`

Queue:
1. `apps/backend/src/services/queue.ts`
2. `apps/backend/src/index.ts`

Frontend integration:
1. `apps/web/app/core/api/client.ts`
2. `apps/web/app/routes/landing.tsx`
3. `apps/web/app/routes/dashboard.tsx`
4. `apps/web/app/routes/review-fix-prompt.tsx`
5. `apps/web/app/features/pr-reviews/components/fix-prompt-page.tsx`

