# GitHub Apps Configuration Guide

This project uses **two separate GitHub applications** for different purposes. It's important to understand the distinction and configure them correctly.

## Two GitHub Applications

### 1. GitHub OAuth App (User Authentication)
**Purpose:** User login and authentication

**Environment Variables:**
- `GITHUB_OAUTH_CLIENT_ID` - OAuth App Client ID (format: `Iv23...`)
- `GITHUB_OAUTH_CLIENT_SECRET` - OAuth App Client Secret
- `GITHUB_OAUTH_REDIRECT_URI` - OAuth callback URL

**Configuration Location:**
- GitHub Settings → Developer settings → OAuth Apps
- https://github.com/settings/developers

**Callback URL Must Be:**
- Development: `http://localhost:8787/api/v1/auth/github/callback`
- Production: `https://your-domain/api/v1/auth/github/callback`

**Used In:**
- `apps/backend/src/features/auth/github.ts`
- `apps/backend/src/endpoints/auth.ts`

### 2. GitHub App (PR Reviews & Repository Access)
**Purpose:** PR reviews, repository access, webhook handling

**Environment Variables:**
- `GITHUB_APP_ID` - GitHub App ID (numeric)
- `GITHUB_APP_SLUG` - GitHub App slug (e.g., `commit-lens-dev`)
- `GITHUB_APP_PRIVATE_KEY` - GitHub App private key (RSA key)
- `GITHUB_APP_REDIRECT_URI` - Installation callback URL
- `GITHUB_WEBHOOK_SECRET` - Webhook secret

**Configuration Location:**
- GitHub Settings → Developer settings → GitHub Apps
- https://github.com/settings/apps

**Callback URL Must Be:**
- Development: `http://localhost:8787/api/v1/github/callback`
- Production: `https://your-domain/api/v1/github/callback`

**Used In:**
- `apps/backend/src/services/github.ts`
- `apps/backend/src/endpoints/github.ts`

## Quick Setup Checklist

### For OAuth App (User Login)
1. Go to https://github.com/settings/developers
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in:
   - **Application name**: commit-lens-oauth (or any name)
   - **Homepage URL**: http://localhost:8787
   - **Authorization callback URL**: `http://localhost:8787/api/v1/auth/github/callback`
4. Register application
5. Copy Client ID and generate Client Secret
6. Update `.dev.vars`:
   ```
   GITHUB_OAUTH_CLIENT_ID=<your_client_id>
   GITHUB_OAUTH_CLIENT_SECRET=<your_client_secret>
   ```

### For GitHub App (PR Reviews)
1. Go to https://github.com/settings/apps
2. Click "New GitHub App"
3. Fill in:
   - **GitHub App name**: commit-lens-dev (or any name)
   - **Homepage URL**: http://localhost:8787
   - **Callback URL**: `http://localhost:8787/api/v1/github/callback`
   - **Webhook URL**: `http://localhost:8787/api/v1/webhooks/github`
   - **Webhook secret**: Generate a random string
4. Set permissions (Repository permissions):
   - Pull requests: Read & write
   - Contents: Read-only
   - Metadata: Read-only
5. Subscribe to events: Pull request
6. Create GitHub App
7. Generate a private key (download the .pem file)
8. Update `.dev.vars`:
   ```
   GITHUB_APP_ID=<app_id>
   GITHUB_APP_SLUG=<app_slug>
   GITHUB_APP_PRIVATE_KEY="<paste_entire_pem_file_contents>"
   GITHUB_WEBHOOK_SECRET=<your_webhook_secret>
   ```

## Troubleshooting

### "Invalid redirect URI" Error
This means the OAuth App callback URL on GitHub doesn't match `GITHUB_OAUTH_REDIRECT_URI`.

**Fix:**
1. Go to your OAuth App settings on GitHub
2. Verify "Authorization callback URL" exactly matches your env variable
3. No trailing slashes, case-sensitive

### OAuth Login Works But PR Reviews Don't
This means the GitHub App is not installed or configured correctly.

**Fix:**
1. Verify `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and `GITHUB_APP_PRIVATE_KEY` are set
2. Install the GitHub App on your repositories
3. Check webhook configuration

### How to Verify Configuration
Run the diagnostics endpoint:
```bash
curl http://localhost:8787/api/v1/auth/config-check | jq
```

Check that:
- `oauth.hasConfiguration` is `true`
- `oauth.redirectUriMatchesConfiguration` is `true`
- `githubApp.hasConfiguration` is `true`

## Environment Variables Summary

```bash
# OAuth App (User Authentication)
GITHUB_OAUTH_CLIENT_ID=Iv23liYAtjd8XpOA2pFK
GITHUB_OAUTH_CLIENT_SECRET=<secret>
GITHUB_OAUTH_REDIRECT_URI=http://localhost:8787/api/v1/auth/github/callback

# GitHub App (PR Reviews)
GITHUB_APP_ID=2661296
GITHUB_APP_SLUG=commit-lens-dev
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_APP_REDIRECT_URI=http://localhost:8787/api/v1/github/callback
GITHUB_WEBHOOK_SECRET=<secret>
```

## Why Two Apps?

**GitHub OAuth Apps** are simpler and designed for user authentication. They use the standard OAuth 2.0 flow.

**GitHub Apps** are more powerful and can:
- Act on behalf of themselves (not just users)
- Have fine-grained permissions
- Receive webhooks
- Access repository content
- Review pull requests

We use OAuth App for login because it's simpler, and GitHub App for PR reviews because it has the necessary permissions and webhook capabilities.
