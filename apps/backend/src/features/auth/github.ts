import { WithEnv } from "../../utils/commonTypes";

export function getGitHubAppInstallationUrl({ env, state }: WithEnv<{ state?: string }>) {
  // Construct the URL to initiate a GitHub App installation.
  // The 'state' parameter can be used for CSRF protection and to redirect back to the correct page.
  const appSlug = "commit-lens"; // Replace with your GitHub App's slug
  
  // If state is provided, use it; otherwise use redirect URI as fallback
  const stateParam = state || env.GITHUB_APP_REDIRECT_URI;
  
  // This URL directs the user to install your GitHub App.
  // The 'state' parameter is important for redirecting back to the correct frontend page
  // and for CSRF protection.
  return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(stateParam)}`;
}
