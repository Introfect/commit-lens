import {
  getOpenApiClientErrorResponse,
  jsonContent,
  getOpenapiResponse,
  getAuthOpenApiResponse,
  ApiKeyHeaderSchema,
} from "../utils/openapi";
import { ErrorCodes, handleApiErrors } from "../utils/error";
import { getHono } from "../utils/hono";
import { z } from "@hono/zod-openapi";
import { connectDb } from "../features/db/connect";
import { createUser } from "../features/user";
import {
  createApiKey,
  getUserFromApiKey,
  verifyEmailAndPassword,
} from "../features/auth";

export const authEndpoint = getHono();

authEndpoint.openapi(
  {
    method: "get",
    path: "/test",
    tags: ["auth"],
    responses: {
      ...getOpenapiResponse(
        z.object({
          message: z.string(),
        })
      ),
    },
  },
  async (c) => {
    return c.json({ message: "Hello, world!" }, 200);
  }
);

authEndpoint.openapi(
  {
    method: "post",
    path: "/signup",
    tags: ["auth"],
    summary: "Sign up for a new account",
    request: {
      body: jsonContent(
        z.object({
          email: z.string().email(),
          name: z.string().min(1).max(100),
          company: z.string().min(1).max(100),
          plainTextPassword: z.string().min(8).max(72),
        })
      ),
    },
    responses: {
      ...getOpenapiResponse(
        z.object({
          ok: z.literal(true),
          data: z.object({
            apiKey: z.string(),
          }),
        })
      ),
      400: getOpenApiClientErrorResponse({
        errorCodesSchema: z.literal(ErrorCodes.EMAIL_ALREADY_IN_USE),
      }),
    },
  },
  async (c) => {
    try {
      const db = connectDb({ env: c.env });
      const { email, name, company, plainTextPassword } = c.req.valid("json");

      const userRes = await createUser({
        email,
        name,
        company,
        plainTextPassword,
        db,
      });

      if (!userRes.ok) {
        return c.json(userRes, 400);
      }

      const user = userRes.user;

      const apiKey = await createApiKey({
        env: c.env,
        userId: user.id,
      });

      return c.json({ ok: true, data: { apiKey } } as const, 200);
    } catch (err) {
      return handleApiErrors(c, err);
    }
  }
);

authEndpoint.openapi(
  {
    method: "post",
    path: "/login",
    tags: ["auth"],
    summary: "Login to the application",
    request: {
      body: jsonContent(
        z.object({
          email: z.string(),
          plainTextPassword: z.string(),
        })
      ),
    },
    responses: {
      ...getOpenapiResponse(
        z.object({
          ok: z.literal(true),
          data: z.object({
            apiKey: z.string(),
          }),
        })
      ),
      401: getOpenApiClientErrorResponse({
        errorCodesSchema: z.literal(ErrorCodes.INVALID_EMAIL_OR_PASSWORD),
      }),
    },
  },
  async (c) => {
    try {
      const db = connectDb({ env: c.env });
      const { email, plainTextPassword } = c.req.valid("json");

      const apiKeyRes = await verifyEmailAndPassword({
        email,
        plainTextPassword,
        db,
        env: c.env,
      });

      if (!apiKeyRes.ok) {
        return c.json(apiKeyRes, 401);
      }

      return c.json(
        { ok: true, data: { apiKey: apiKeyRes.data.apiKey } } as const,
        200
      );
    } catch (err) {
      return handleApiErrors(c, err);
    }
  }
);

authEndpoint.openapi(
  {
    method: "post",
    path: "/info",
    tags: ["auth"],
    summary: "Get information about the current user",
    responses: {
      ...getAuthOpenApiResponse(
        z.object({
          ok: z.literal(true),
          data: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
            company: z.string(),
          }),
        })
      ),
    },
    request: {
      headers: ApiKeyHeaderSchema,
    },
  },
  async (c) => {
    try {
      const db = connectDb({ env: c.env });
      const apiKey = c.req.valid("header")["x-api-key"];

      const userRes = await getUserFromApiKey({ apiKey, db, env: c.env });

      if (!userRes.ok) {
        return c.json(userRes, 401);
      }

      return c.json({ ok: true, data: userRes.user } as const, 200);
    } catch (err) {
      return handleApiErrors(c, err);
    }
  }
);
