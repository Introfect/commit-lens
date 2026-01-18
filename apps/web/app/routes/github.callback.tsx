import { redirect, type LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get('installation_id');
  const setupAction = url.searchParams.get('setup_action');

  if (!installationId || !setupAction) {
    return redirect('/dashboard');
  }

  // Backend already handled storing the installation
  // Just redirect back to dashboard with success message
  return redirect('/dashboard?connected=true');
}

// This route only has a loader, no component needed
// It's just for handling the GitHub callback redirect
export default function GitHubCallback() {
  return null;
}
