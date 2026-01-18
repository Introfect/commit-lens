import { Context } from "hono";

export async function handleApiErrors(c: Context, err: unknown) {
  if (err instanceof Error) {
    return c.json({ ok: false, error: err.message } as const, 500);
  }

  throw err;
}

export const ErrorCodes = {} as const;

export type ErrorCodes = (typeof ErrorCodes)[keyof typeof ErrorCodes];
