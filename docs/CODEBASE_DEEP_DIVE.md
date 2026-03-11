# Commit Lens Codebase Deep Dive

This document is a code-level walkthrough of the entire repository as it exists now.

## 1. Repository Identity

`commit-lens` is a Turbo monorepo with two apps:

1. `apps/backend`: Cloudflare Worker API that receives GitHub webhooks, syncs repositories, triggers AI PR reviews, and posts GitHub review feedback.
2. `apps/web`: React Router + Cloudflare SSR frontend for login, dashboard, PR activity, and review fix-prompt UX.

Core stack:

1. Runtime: Cloudflare Workers, Cloudflare Queues
2. Backend: Hono, Drizzle ORM, Postgres, Zod, jose/arctic/JWT
3. Frontend: React 19, React Router 7, Tailwind 4
4. AI: `@google/genai` (Gemini model `gemini-3-flash-preview`)

## 2. Monorepo and Build Topology

Top-level files and roles:

1. `README.md`: placeholder title only.
2. `package.json`: root workspace package with `turbo dev --ui tui`.
3. `pnpm-workspace.yaml`: includes `apps/**`.
4. `turbo.json`: defines only persistent, non-cached `dev`.
5. `pnpm-lock.yaml`: consolidated lockfile for root+apps.
6. `gemini-instructions.txt`: temporary note that local Supabase startup was blocking migration work.

## 3. Backend (`apps/backend`) Deep Dive

### 3.1 Backend Runtime and Configuration

1. `apps/backend/package.json`
   - Scripts for Wrangler dev, type generation, Drizzle migration generate/deploy, Supabase lifecycle.
   - Dependencies center on Hono API + GitHub + Gemini + Drizzle.
2. `apps/backend/tsconfig.json`
   - Strict TS, ESNext modules, `moduleResolution: Bundler`.
   - Includes `worker-configuration.d.ts` generated bindings/types.
3. `apps/backend/wrangler.jsonc`
   - Worker entry: `src/index.ts`.
   - CORS-sensitive vars include `FRONTEND_URL`.
   - Declares Cloudflare Queue producer+consumer binding (`PR_REVIEW_QUEUE`) in both `dev` and `production`.
4. `apps/backend/drizzle.config.ts`
   - PostgreSQL dialect, schema source `src/features/db/schema.ts`, migrations output to `migrations`.
5. `apps/backend/worker-configuration.d.ts`
   - Auto-generated runtime and binding types.
   - Contains concrete env binding names/types, then full Cloudflare runtime type surface.
6. `apps/backend/README.md`
   - Template-oriented Cloudflare/Hono OpenAPI quickstart guide.

### 3.2 Backend Entry and Routing

`apps/backend/src/index.ts`

1. Creates app via `getHono()` (typed `OpenAPIHono` with `authUser` variable type).
2. Defines local allowed frontend origins and merges with parsed `FRONTEND_URL`.
3. Applies CORS globally with dynamic origin resolver and credentials enabled.
4. Mounts route modules:
   - `api/v1/auth`
   - `api/v1/github`
   - `api/v1/webhooks`
   - `api/v1/repositories`
   - `api/v1/installations`
   - `api/v1/events`
   - `api/v1/pr-reviews`
5. Exports both `fetch` and `queue` handler in default Worker export.
6. Queue handler loops messages, builds per-message logger context, retries on failures, acknowledges on success.

### 3.3 Endpoint Layer

#### `src/endpoints/auth.ts`

1. Handles GitHub OAuth start/callback, session `/me`, and logout.
2. Uses JWT `state` with 10-minute expiry and optional `redirectTo`.
3. Guards redirect path with leading slash + anti-protocol-relative check.
4. On callback:
   - validates state token + schema,
   - exchanges GitHub auth code,
   - fetches GitHub user and optional verified email,
   - upserts local user,
   - mints session JWT cookie,
   - redirects to dashboard or stored redirect path.
5. `/me` requires session middleware, fetches user + active installations.
6. `/logout` clears cookie for both JSON POST and redirect GET flows.

#### `src/endpoints/github.ts`

1. `/redirect` (session-protected) routes user either to:
   - existing installation manage page, or
   - new install URL with signed state.
2. `/callback`:
   - accepts either JWT `state` or existing session user fallback,
   - validates installation callback params,
   - fetches installation details from GitHub API,
   - creates/updates `repository_installation`,
   - prevents cross-user installation hijack,
   - triggers repository sync,
   - redirects dashboard with status flags (`connected`, `sync`, `reactivated`, errors).

#### `src/endpoints/installations.ts`

1. Session-protected.
2. `DELETE /:installationId`: soft-disconnects installation and associated repositories/events.

#### `src/endpoints/repositories.ts`

1. Session-protected.
2. `GET /`: returns user-visible active repositories.
3. `DELETE /:repositoryId`: marks repository removed from workspace; deactivates PR events.

#### `src/endpoints/events.ts`

1. Session-protected.
2. `GET /pull-requests`: resolves user repository IDs, returns recent PR events (up to 50).
3. `GET /repositories`: returns user repositories.

#### `src/endpoints/prReviews.ts`

1. Session-protected.
2. `GET /:repositoryId/:prNumber`: returns latest review status/timestamp for that PR if repo belongs to user.
3. `POST /comments/:commentId/fix-prompt`:
   - verifies comment ownership through installation/user joins,
   - generates a targeted fix prompt through Gemini,
   - returns prompt payload for frontend page.

#### `src/endpoints/webhooks.ts`

1. Public GitHub webhook entry.
2. Validates required headers and HMAC signature.
3. Branches by `x-github-event`:
   - `pull_request`: validates payload, processes review-triggering actions (`opened`, `synchronize`, `reopened`), ensures repository is tracked/active, syncs as fallback, writes PR event, enqueues AI review job.
   - `installation` and `installation_repositories`: reconciles repository selection via sync.
   - other events acknowledged but ignored.
4. Comprehensive structured logging with durations and context.

### 3.4 Feature Layer

#### `src/features/auth/session.ts`

1. Stateless session model in signed JWT cookie `commit_lens_session`.
2. `createSessionToken` embeds `{ userId, githubLogin, exp }`.
3. `verifySessionToken` returns `Result` union.
4. Secure cookie decision derived from `FRONTEND_URL` protocol.
5. `requireSession` middleware injects typed `authUser` into context.

#### `src/features/auth/github.ts`

1. GitHub OAuth config normalization + validity checks.
2. Arctic client setup and authorization URL generation.
3. Code exchange + GitHub `/user` and `/user/emails` retrieval, schema-validated with Zod.
4. Utility URL builders for GitHub App install/manage.

#### `src/features/user.ts`

1. Upsert by user ID (GitHub ID stored as text).
2. Provides lookup by email and by ID.
3. Uses explicit selection objects (`UserSelectInfo`).

#### `src/features/repository.ts`

1. Installation lifecycle:
   - list active/inactive installations,
   - derive primary installation preference,
   - disconnect installation (soft-deactivation).
2. Repository lifecycle:
   - remove from workspace (`isRemovedFromWorkspace = true`),
   - sync from GitHub installation selection.
3. Sync semantics:
   - `mode = "user_manage"` unhides repos,
   - `mode = "background"` preserves hidden repos,
   - deactivates repos no longer returned by GitHub,
   - restores PR event visibility when repo reactivated.
4. Query helpers:
   - `getRepositoriesForUser`
   - `getRepositoryIdsForUser`

#### `src/features/pullRequestEvent.ts`

1. Idempotent-ish event insert/update keyed by `(repositoryId, prNumber, headSha)`.
2. On existing head SHA, updates event metadata and sets `reviewStatus = reviewing`.
3. Fetches events for user repository IDs and enriches with repository info.

#### `src/features/prContext.ts`

1. Builds "focused project context" for Gemini prompts from:
   - root candidates (`README`, package/config files),
   - up to 6 changed files with patch.
2. Trims oversized docs with head/tail retention.
3. Formats documents into prompt blocks.

#### `src/features/reviewArtifact.ts`

1. Persists review artifact summary and inline comments.
2. Tracks posting status (`pending`, `posted`, `partially_posted`, `failed`).
3. Stores anchoring outcomes and fix-prompt generation status.
4. Contains ownership-safe query for comment retrieval by user.

#### `src/features/prReview.ts`

1. Queue entrypoint `queuePullRequestReview` sends job to Cloudflare Queue.
2. `performPullRequestReviewInternal` pipeline:
   - validates repository/event existence,
   - marks review status transitions,
   - fetches PR details/files,
   - builds project context,
   - requests Gemini review,
   - parses/anchors comments against diff,
   - persists artifact/comments,
   - posts GitHub review with inline comments,
   - fallback: retries summary-only review if inline comment post fails,
   - updates posting/review statuses.
3. `createFixPromptForInlineComment`:
   - verifies comment ownership,
   - fetches file content/context,
   - asks Gemini for code-agent prompt,
   - marks prompt generated.

#### `src/features/db/schema.ts`

Defines tables:

1. `user`
2. `oauth_account` (legacy)
3. `repository_installation`
4. `repository`
5. `pull_request_event`
6. `pull_request_review_artifact`
7. `pull_request_inline_comment`

Key design details:

1. Boolean-ish states sometimes encoded as text enums (`"true"|"false"`).
2. Soft-deactivation flags (`isActive`, `isRemovedFromWorkspace`) everywhere in repo/event lifecycle.
3. PR review metadata and inline-comment anchoring persisted first-class.

#### `src/features/db/connect.ts`

1. Trims `DATABASE_URL`.
2. Initializes Drizzle with schema map and snake_case mapping.

### 3.5 Service Layer

#### `src/services/github.ts`

1. Generates GitHub App JWT using PKCS8 key; converts PKCS1 PEM when needed.
2. Exchanges installation token and wraps all GitHub API operations in `Result` unions.
3. Supports:
   - installation fetch/list repos
   - PR details/files/diff
   - repository file content fetch
   - PR review post
   - issue comment post
   - webhook signature verification (HMAC-SHA256)
4. Pagination for PR files up to 30 pages x 100 per page.

#### `src/services/gemini.ts`

1. Chunk-aware review design:
   - split changed files by diff size and file count,
   - run per-chunk review with strict JSON schema,
   - aggregate summary across chunks.
2. Enforces max inline comment budgets globally/per-file/per-chunk.
3. Uses deterministic-ish generation settings (`temperature` 0.2-0.3).
4. Generates both PR review objects and fix-prompt free text.

#### `src/services/queue.ts`

1. Defines queue payload schema (`type: "pr_review"`).
2. Adds correlation IDs and logs queue lag.
3. Dynamic imports for review/db in queue processor.

### 3.6 Utility and Type Files

1. `src/utils/error.ts`: global error code enum + `Result<T>` + API 500 helper.
2. `src/utils/logger.ts`: JSON structured logger with child-context support.
3. `src/utils/openapi.ts`: Zod response wrappers and auth header schema.
4. `src/utils/hono.ts`: typed OpenAPI Hono constructor.
5. `src/utils/crypto.ts`: AES-GCM encrypt/decrypt helper.
   - Uses a fixed IV constant, which is cryptographically unsafe for repeated encryption under same key.
6. `src/utils/commonTypes.ts`: composable helper types `WithEnv`, `WithDb`, `WithDbAndEnv`.
7. `src/utils/diffParser.ts`: parses unified patches and resolves inline comment anchors.
8. `src/types/models.ts`: domain and API response schemas.
9. `src/types/github.ts`: webhook/API/state schemas for GitHub interactions.
10. `src/middleware/csrf.ts`: origin/referer guard middleware, currently not wired in route mounting.

### 3.7 Database Migrations

SQL migrations (`apps/backend/migrations/*.sql`):

1. `0000_lumpy_human_fly.sql`: initial `user` table (included later-removed fields).
2. `0001_panoramic_lila_cheney.sql`: partial unique index on user email while active.
3. `0002_slim_spectrum.sql`: adds OAuth and installation tables, user avatar, soft-removal of old user fields.
4. `0003_skinny_deathbird.sql`: adds repository and pull request event tables.
5. `0004_clean_user_table.sql`: explicitly drops legacy user columns.
6. `0005_abnormal_doctor_faustus.sql`: adds `review_status` to PR events.
7. `0006_soft_delete_repository_records.sql`: adds `is_active` flags.
8. `0007_keen_living_mummy.sql`: makes email nullable, adds unique `github_login`.
9. `0008_peaceful_warbird.sql`: adds review artifact and inline comment tables.
10. `0009_slim_tyrannus.sql`: adds `is_removed_from_workspace`.

Meta migration snapshots (`apps/backend/migrations/meta/*.json`):

1. `0000_snapshot.json` ... `0009_snapshot.json`: Drizzle schema snapshots for each migration stage.
2. `_journal.json`: ordered migration application history with timestamp-like `when` values and tags.

### 3.8 Supabase Local Config

`apps/backend/supabase/config.toml`

1. Local ports in `5732x` range.
2. DB seed enabled (`./seed.sql` path referenced).
3. Includes many default auth/storage/realtime stanzas, mostly disabled or default.
4. `project_id = "commit-less-dev"` (note naming mismatch vs repo `commit-lens`).

## 4. Frontend (`apps/web`) Deep Dive

### 4.1 Frontend Runtime and Configuration

1. `apps/web/package.json`
   - React Router build/dev scripts, Cloudflare deploy scripts, OpenAPI type generation command.
2. `apps/web/tsconfig.json`, `tsconfig.node.json`, `tsconfig.cloudflare.json`
   - strict mode split by node/cloudflare targets.
3. `apps/web/vite.config.ts`
   - `/api` proxy to backend localhost.
   - plugins: cloudflare, tailwind, react-router, tsconfig-paths.
4. `apps/web/react-router.config.ts`
   - SSR enabled.
   - future flags include `v8_middleware`.
5. `apps/web/wrangler.jsonc`
   - Worker entry `workers/app.ts`.
   - static assets binding `ASSETS`.
6. `apps/web/components.json`
   - shadcn config and path aliases.
7. `apps/web/tailwind.config.ts`
   - mint/teal palette extension and custom animations.
8. `apps/web/vite-env.d.ts`
   - typed `VITE_BACKEND_BASE_URL`.
9. `apps/web/worker-configuration.d.ts`
   - generated binding/runtime types for frontend worker.
10. `apps/web/README.md`
   - mostly React Router starter template content.

### 4.2 Frontend Worker + Root App Shell

1. `workers/app.ts`
   - wraps React Router request handler for Cloudflare worker.
   - injects Cloudflare env/context into `AppLoadContext`.
2. `app/root.tsx`
   - renders `RootLayout` and route outlet.
   - provides error boundary with generic status display.
3. `app/layout.tsx`
   - HTML document shell (`Meta`, `Links`, `Scripts`, `ScrollRestoration`).
4. `app/entry.server.tsx`
   - SSR stream renderer.
   - waits `allReady` for bots or SPA mode.
5. `app/app.css`
   - Tailwind theme tokens and dark atmospheric background styling.
   - custom utility classes for float animation and dashboard grid surface.
6. `app/routes.ts`
   - route mapping:
     - index landing
     - `/dashboard`
     - `/dashboard/reviews/:reviewArtifactId/comments/:commentId/fix`
     - `/logout`

### 4.3 Frontend API Layer

1. `app/core/api/client.ts`
   - browser fetch client with credentials and error handling.
   - methods for auth/repositories/events/installation operations and redirect actions.
2. `app/core/api/server.ts`
   - server-side fetch helper that forwards cookies to backend.
3. `app/lib/api/client.ts`
   - `openapi-fetch` client wrapper using generated `paths`.
4. `app/lib/api/types.ts`
   - auto-generated OpenAPI TS types.
   - currently appears stale and contains old auth endpoints (`/auth/signup`, `/auth/login`, `/auth/info`) not present in active backend routing.
5. `app/lib/auth/cookies.ts`
   - cookie helpers for `auth_token`; appears legacy and not part of current session-cookie flow.
6. `app/lib/utils.ts` and `app/shared/utils/cn.ts`
   - class merge helper wrappers (`clsx` + `tailwind-merge`).

### 4.4 Frontend Route Modules

#### `app/routes/landing.tsx`

1. Loader checks session via backend `/auth/me`.
2. Redirects authenticated users to dashboard.
3. Maps backend error query params to human-readable login error messages.
4. Renders `LoginShell`, triggering backend OAuth start.

#### `app/routes/dashboard.tsx`

1. Loader enforces auth by backend session check.
2. Fetches repositories and PR events in parallel.
3. Reads query filters (`repo`, `author`, `window`) through schema parser.
4. Builds dashboard view model and notice banners from callback query params.
5. Revalidates every 8s while any review is `reviewing`.
6. Actions available:
   - remove repository from workspace
   - disconnect full installation
   - open GitHub App manage/install flow

#### `app/routes/review-fix-prompt.tsx`

1. Auth-gated loader with redirect-back-to-requested-path behavior.
2. Calls backend `POST /pr-reviews/comments/:commentId/fix-prompt`.
3. Guards that returned `reviewArtifactId` matches URL param.
4. Renders prompt page inside dashboard shell.

#### `app/routes/logout.tsx`

1. Redirects directly to backend logout endpoint.

### 4.5 Feature Modules

#### Auth feature (`app/features/auth`)

1. `login-shell.tsx`: branded login page with GitHub CTA and optional error message.
2. `session-user-summary.tsx`: compact user display with logout button.
3. `index.ts`: re-export barrel.

#### Dashboard feature (`app/features/dashboard`)

1. `schemas/dashboard-filter-schema.ts`
   - validates default filter values (`window` default `7d`).
2. `lib/dashboard-metrics.ts`
   - central transformation engine:
     - event filtering by repo/author/window,
     - option generation,
     - status and metric rollups,
     - greeting and relative-time helpers.
3. `components/dashboard-frame.tsx`
   - desktop sidebar + mobile topbar shell.
4. `components/dashboard-sidebar-nav.tsx`
   - nav item rendering for active/link/disabled states.
5. `components/dashboard-toolbar.tsx`
   - filter controls + primary action.
6. `components/metric-card.tsx`
   - summary KPI card.
7. `components/recent-review-activity.tsx`
   - recent PR list + review status badges.
8. `components/workspace-status-panel.tsx`
   - guidance and status progress bars.
9. `components/repository-summary-panel.tsx`
   - repository table with remove/disconnect/manage actions.
10. `components/dashboard-overview.tsx`
   - orchestration component combining all dashboard sections.
11. `index.ts`
   - exports `DashboardFrame`, `DashboardOverview`, filter parser, and metrics builder helpers.

#### PR Reviews feature (`app/features/pr-reviews`)

1. `components/fix-prompt-page.tsx`
   - copies generated prompt to clipboard on load,
   - presents inline comment context and prompt usage instructions,
   - supports manual recopy fallback.
2. `index.ts`: re-export barrel.

### 4.6 Shared and Legacy UI Components

1. `app/shared/components/ui/button.tsx`: cva variants + loading state.
2. `app/shared/components/ui/panel.tsx`: common container style primitive.
3. `app/components/ui/button.tsx`: re-export wrapper to shared button.
4. `app/components/ui/card.tsx`: card primitives.
5. `app/components/layout/dashboard-layout.tsx`: one-line re-export default.
6. `app/components/repository-card.tsx`
7. `app/components/pr-event-card.tsx`
8. `app/components/loading-skeleton.tsx`
9. `app/components/empty-state.tsx`
   - These appear older/parallel UI components, largely unused by current dashboard layout composition.

### 4.7 Static Assets

1. `app/welcome/logo-light.svg`
2. `app/welcome/logo-dark.svg`
3. `public/favicon.ico`

## 5. Cross-Cutting Behavioral Flow

### 5.1 End-to-End PR Review Lifecycle

1. User signs in through GitHub OAuth (`/auth/github/start` -> callback).
2. User installs/updates GitHub App access (`/github/redirect` -> `/github/callback`).
3. Backend syncs active repositories for installation.
4. GitHub PR webhook arrives (`/webhooks/github` with `pull_request` event).
5. Backend validates signature, upserts PR event, enqueues queue job.
6. Queue consumer runs `performPullRequestReviewInternal`.
7. Backend fetches PR details/files + project context + calls Gemini.
8. Review artifact and inline comment artifacts are persisted.
9. Backend posts review to GitHub; fallback to summary-only if inline comments fail.
10. Dashboard polls review status and renders live updates.
11. User opens fix-prompt page from generated comment CTA link.

### 5.2 Data Ownership and Access Control

1. Session cookie identifies user.
2. User-ownership checks are performed through installation linkage.
3. Comment fix-prompt access joins: comment -> artifact -> repository -> installation -> user.
4. Repository/installation removals are soft deactivations, not hard deletes.

## 6. Notable Implementation Details and Risks

1. `apps/web/app/lib/api/types.ts` is stale relative to current backend API routes.
2. Many frontend class names use `reeeddddccc-*` (looks like accidental corruption of `rounded-*` style classes). These classes are not valid Tailwind defaults and likely break intended visual styling.
3. `apps/backend/src/utils/crypto.ts` uses a fixed AES-GCM IV, unsafe for repeated encryption.
4. `apps/backend/src/middleware/csrf.ts` exists but is not mounted anywhere in `src/index.ts`.
5. Lockfile drift exists:
   - Root lockfile aligns with current packages.
   - App-local lockfiles show older template dependencies (`chanfana`, `@clerk/*`) not reflected in active package manifests/code.
6. Root README is non-descriptive and does not reflect current product architecture.
7. There are two API client layers in web (`core/api/*` and `lib/api/*`), with only one actively used in route code.

## 7. Complete File Inventory (All Tracked Files)

Root:

1. `README.md`: placeholder project title.
2. `package.json`: root scripts + turbo dev dependency.
3. `pnpm-workspace.yaml`: workspace package inclusion.
4. `turbo.json`: dev task config.
5. `pnpm-lock.yaml`: root lockfile for workspace.
6. `gemini-instructions.txt`: temporary environment note.

Backend config and docs:

1. `apps/backend/README.md`: starter docs.
2. `apps/backend/AGENTS.md`: TypeScript/Drizzle coding policy.
3. `apps/backend/package.json`: backend scripts/dependencies.
4. `apps/backend/package-lock.json`: npm lockfile (large, generated).
5. `apps/backend/pnpm-lock.yaml`: app-local pnpm lockfile (stale vs current package).
6. `apps/backend/tsconfig.json`: backend TS config.
7. `apps/backend/drizzle.config.ts`: migration generator config.
8. `apps/backend/wrangler.jsonc`: backend worker config.
9. `apps/backend/worker-configuration.d.ts`: generated worker and env typings.
10. `apps/backend/supabase/config.toml`: local Supabase config.

Backend migrations:

1. `apps/backend/migrations/0000_lumpy_human_fly.sql`
2. `apps/backend/migrations/0001_panoramic_lila_cheney.sql`
3. `apps/backend/migrations/0002_slim_spectrum.sql`
4. `apps/backend/migrations/0003_skinny_deathbird.sql`
5. `apps/backend/migrations/0004_clean_user_table.sql`
6. `apps/backend/migrations/0005_abnormal_doctor_faustus.sql`
7. `apps/backend/migrations/0006_soft_delete_repository_records.sql`
8. `apps/backend/migrations/0007_keen_living_mummy.sql`
9. `apps/backend/migrations/0008_peaceful_warbird.sql`
10. `apps/backend/migrations/0009_slim_tyrannus.sql`
11. `apps/backend/migrations/meta/0000_snapshot.json`
12. `apps/backend/migrations/meta/0001_snapshot.json`
13. `apps/backend/migrations/meta/0002_snapshot.json`
14. `apps/backend/migrations/meta/0003_snapshot.json`
15. `apps/backend/migrations/meta/0004_snapshot.json`
16. `apps/backend/migrations/meta/0005_snapshot.json`
17. `apps/backend/migrations/meta/0006_snapshot.json`
18. `apps/backend/migrations/meta/0007_snapshot.json`
19. `apps/backend/migrations/meta/0008_snapshot.json`
20. `apps/backend/migrations/meta/0009_snapshot.json`
21. `apps/backend/migrations/meta/_journal.json`

Backend source:

1. `apps/backend/src/index.ts`
2. `apps/backend/src/endpoints/auth.ts`
3. `apps/backend/src/endpoints/events.ts`
4. `apps/backend/src/endpoints/github.ts`
5. `apps/backend/src/endpoints/installations.ts`
6. `apps/backend/src/endpoints/prReviews.ts`
7. `apps/backend/src/endpoints/repositories.ts`
8. `apps/backend/src/endpoints/webhooks.ts`
9. `apps/backend/src/features/auth/github.ts`
10. `apps/backend/src/features/auth/session.ts`
11. `apps/backend/src/features/db/connect.ts`
12. `apps/backend/src/features/db/schema.ts`
13. `apps/backend/src/features/prContext.ts`
14. `apps/backend/src/features/prReview.ts`
15. `apps/backend/src/features/pullRequestEvent.ts`
16. `apps/backend/src/features/repository.ts`
17. `apps/backend/src/features/reviewArtifact.ts`
18. `apps/backend/src/features/user.ts`
19. `apps/backend/src/middleware/csrf.ts`
20. `apps/backend/src/services/gemini.ts`
21. `apps/backend/src/services/github.ts`
22. `apps/backend/src/services/queue.ts`
23. `apps/backend/src/types/github.ts`
24. `apps/backend/src/types/models.ts`
25. `apps/backend/src/utils/commonTypes.ts`
26. `apps/backend/src/utils/crypto.ts`
27. `apps/backend/src/utils/diffParser.ts`
28. `apps/backend/src/utils/error.ts`
29. `apps/backend/src/utils/hono.ts`
30. `apps/backend/src/utils/logger.ts`
31. `apps/backend/src/utils/openapi.ts`

Web config and docs:

1. `apps/web/README.md`: React Router starter docs.
2. `apps/web/AGENTS.md`: frontend engineering guide.
3. `apps/web/package.json`: web scripts/dependencies.
4. `apps/web/package-lock.json`: npm lockfile (generated).
5. `apps/web/pnpm-lock.yaml`: app-local pnpm lockfile (generated, likely stale).
6. `apps/web/tsconfig.json`
7. `apps/web/tsconfig.node.json`
8. `apps/web/tsconfig.cloudflare.json`
9. `apps/web/vite.config.ts`
10. `apps/web/react-router.config.ts`
11. `apps/web/tailwind.config.ts`
12. `apps/web/components.json`
13. `apps/web/wrangler.jsonc`
14. `apps/web/vite-env.d.ts`
15. `apps/web/worker-configuration.d.ts`
16. `apps/web/public/favicon.ico`

Web worker and app source:

1. `apps/web/workers/app.ts`
2. `apps/web/app/app.css`
3. `apps/web/app/entry.server.tsx`
4. `apps/web/app/layout.tsx`
5. `apps/web/app/root.tsx`
6. `apps/web/app/routes.ts`
7. `apps/web/app/types.ts`
8. `apps/web/app/welcome/logo-dark.svg`
9. `apps/web/app/welcome/logo-light.svg`
10. `apps/web/app/core/api/client.ts`
11. `apps/web/app/core/api/server.ts`
12. `apps/web/app/lib/api/client.ts`
13. `apps/web/app/lib/api/types.ts`
14. `apps/web/app/lib/auth/cookies.ts`
15. `apps/web/app/lib/utils.ts`
16. `apps/web/app/routes/dashboard.tsx`
17. `apps/web/app/routes/landing.tsx`
18. `apps/web/app/routes/logout.tsx`
19. `apps/web/app/routes/review-fix-prompt.tsx`
20. `apps/web/app/components/empty-state.tsx`
21. `apps/web/app/components/loading-skeleton.tsx`
22. `apps/web/app/components/pr-event-card.tsx`
23. `apps/web/app/components/repository-card.tsx`
24. `apps/web/app/components/layout/dashboard-layout.tsx`
25. `apps/web/app/components/ui/button.tsx`
26. `apps/web/app/components/ui/card.tsx`
27. `apps/web/app/shared/components/ui/button.tsx`
28. `apps/web/app/shared/components/ui/panel.tsx`
29. `apps/web/app/shared/utils/cn.ts`
30. `apps/web/app/features/auth/index.ts`
31. `apps/web/app/features/auth/components/login-shell.tsx`
32. `apps/web/app/features/auth/components/session-user-summary.tsx`
33. `apps/web/app/features/dashboard/index.ts`
34. `apps/web/app/features/dashboard/lib/dashboard-metrics.ts`
35. `apps/web/app/features/dashboard/schemas/dashboard-filter-schema.ts`
36. `apps/web/app/features/dashboard/components/dashboard-frame.tsx`
37. `apps/web/app/features/dashboard/components/dashboard-overview.tsx`
38. `apps/web/app/features/dashboard/components/dashboard-sidebar-nav.tsx`
39. `apps/web/app/features/dashboard/components/dashboard-toolbar.tsx`
40. `apps/web/app/features/dashboard/components/metric-card.tsx`
41. `apps/web/app/features/dashboard/components/recent-review-activity.tsx`
42. `apps/web/app/features/dashboard/components/repository-summary-panel.tsx`
43. `apps/web/app/features/dashboard/components/workspace-status-panel.tsx`
44. `apps/web/app/features/pr-reviews/index.ts`
45. `apps/web/app/features/pr-reviews/components/fix-prompt-page.tsx`

## 8. Summary

The codebase is structurally coherent around one central product loop: GitHub App integration + webhook-driven PR ingestion + Gemini-assisted review + dashboard visibility + fix-prompt generation. The backend is the operational core and is mostly built with explicit result unions and strongly typed schemas. The frontend uses route loaders and feature-level composition to visualize pipeline state. The most notable technical debt areas are stale/generated artifacts (OpenAPI types and lockfiles), CSS class corruption strings in many components, and a cryptography IV misuse in `utils/crypto.ts`.
