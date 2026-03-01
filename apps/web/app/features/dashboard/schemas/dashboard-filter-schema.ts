import { z } from 'zod';

export const DASHBOARD_WINDOW_VALUES = ['7d', '30d', 'all'] as const;

const dashboardWindowSchema = z.enum(DASHBOARD_WINDOW_VALUES);

export const dashboardFilterSchema = z.object({
  repo: z.string().default('all'),
  author: z.string().default('all'),
  window: dashboardWindowSchema.default('7d'),
});

export type DashboardFilters = z.infer<typeof dashboardFilterSchema>;
export type DashboardWindow = z.infer<typeof dashboardWindowSchema>;

export function parseDashboardFilters(searchParams: URLSearchParams): DashboardFilters {
  const candidate = {
    repo: searchParams.get('repo') ?? undefined,
    author: searchParams.get('author') ?? undefined,
    window: searchParams.get('window') ?? undefined,
  };
  const result = dashboardFilterSchema.safeParse(candidate);

  if (result.success) {
    return result.data;
  }

  return dashboardFilterSchema.parse({});
}
