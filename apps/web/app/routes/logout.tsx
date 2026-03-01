import { redirect } from 'react-router';
import type { Route } from './+types/logout';
import { getBackendApiBaseUrl } from '../core/api/server';

export async function loader(args: Route.LoaderArgs) {
  const backendUrl = getBackendApiBaseUrl(args.context.cloudflare.env);
  throw redirect(`${backendUrl}/auth/logout`);
}

export default function LogoutPage() {
  return null;
}
