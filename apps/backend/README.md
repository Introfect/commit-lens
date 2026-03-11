# Cloudflare Workers OpenAPI 3.1

This is a Cloudflare Worker with OpenAPI 3.1 using [chanfana](https://github.com/cloudflare/chanfana) and [Hono](https://github.com/honojs/hono).

This is an example project made to be used as a quick start into building OpenAPI compliant Workers that generates the
`openapi.json` schema automatically from code and validates the incoming request to the defined parameters or request body.

## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is more than enough for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler deploy` to publish the API to Cloudflare Workers

## Project structure

1. Your main router is defined in `src/index.ts`.
2. Each endpoint has its own file in `src/endpoints/`.
3. For more information read the [chanfana documentation](https://chanfana.pages.dev/) and [Hono documentation](https://hono.dev/docs).

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
3. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the Swagger interface.

## Local GitHub OAuth Checklist

If GitHub shows `Invalid redirect URI` during login:

1. Ensure backend env uses:
   - `GITHUB_OAUTH_REDIRECT_URI=http://localhost:8787/api/v1/auth/github/callback`
2. Ensure your GitHub OAuth App (same `GITHUB_OAUTH_CLIENT_ID`) has Callback URL set to the exact same value.
3. Ensure frontend is calling the same backend instance:
   - `VITE_BACKEND_BASE_URL=http://localhost:8787/api/v1`
4. Inspect local auth diagnostics:
   - `GET http://localhost:8787/api/v1/auth/config-check`

Note: The codebase uses two separate GitHub applications:
- **GitHub OAuth App** (GITHUB_OAUTH_CLIENT_ID) - for user authentication
- **GitHub App** (GITHUB_APP_ID) - for PR reviews and repository access
