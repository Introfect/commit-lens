import { z } from "zod";
import { ErrorCodes } from "./error";

export function getOpenapiResponse<T>(schema: z.ZodType<T>) {
  return {
    200: {
      description: "Successfull Response",
      content: {
        "application/json": {
          schema,
        },
      },
    },
    500: {
      description: "Something went wrong",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(false), error: z.string() }),
        },
      },
    },
  };
}

export function getAuthOpenApiResponse<T>(schema: z.ZodType<T>) {
  return {
    ...getOpenapiResponse(schema),
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(false),
            errorCode: z.literal(ErrorCodes.INVALID_API_KEY),
            error: z.string(),
          }),
        },
      },
    },
  };
}
export function getOpenApiClientErrorResponse<T>({
  errorCodesSchema,
}: {
  errorCodesSchema: z.ZodType<T>;
}) {
  return {
    description: "Client error",
    content: {
      "application/json": {
        schema: z.object({
          ok: z.literal(false),
          errorCode: errorCodesSchema,
          error: z.string(),
        }),
      },
    },
  };
}
export function getNotFoundErrorResponse<T>({
  errorCodesSchema,
}: {
  errorCodesSchema: z.ZodType<T>;
}) {
  return {
    description: "Not found error",
    content: {
      "application/json": {
        schema: z.object({
          ok: z.literal(false),
          errorCode: errorCodesSchema,
          error: z.string(),
        }),
      },
    },
  };
}

export function jsonContent<T>(schema: z.ZodType<T>) {
  return {
    content: {
      "application/json": {
        schema: schema,
      },
    },
  } as const;
}

export const ApiKeyHeaderSchema = z.object({
  "x-api-key": z.string(),
});
