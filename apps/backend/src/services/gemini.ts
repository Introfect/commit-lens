import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { WithEnv } from "../utils/commonTypes";
import { ErrorCodes, Result } from "../utils/error";
import { createLogger } from "../utils/logger";

export type PRReviewRequest = {
  title: string;
  description?: string;
  diff: string;
  projectContext: string;
  changedFiles: Array<{
    path: string;
    status: string;
    patch: string | null;
  }>;
};

export type InlineComment = {
  file: string;
  line: number;
  side: "LEFT" | "RIGHT";
  severity: "error" | "warning" | "info";
  title: string;
  body: string;
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
};

export type PRReviewResponse = {
  prSummary: string;
  confidenceScore: number;
  confidenceReason: string;
  inlineComments: InlineComment[];
  generalFeedback: {
    strengths: string[];
    risks: string[];
    recommendations: string[];
  };
};

export type FixPromptRequest = {
  repositoryFullName: string;
  prNumber: string;
  prSummary: string;
  confidenceScore: number;
  confidenceReason: string;
  comment: {
    path: string;
    title: string;
    body: string;
    severity: "error" | "warning" | "info";
    line: number | null;
    side: "LEFT" | "RIGHT" | null;
  };
  projectContext: string;
  fileContext: string | null;
};

const InlineCommentSchema = z.object({
  file: z.string().default(""),
  line: z.coerce.number().int().positive().default(1),
  side: z.enum(["LEFT", "RIGHT"]).default("RIGHT"),
  severity: z.enum(["error", "warning", "info"]).default("info"),
  title: z.string().default("Code review issue"),
  body: z.string().default("General feedback"),
  startLine: z.coerce.number().int().positive().optional(),
  startSide: z.enum(["LEFT", "RIGHT"]).optional(),
});

const PRReviewResponseSchema = z.object({
  prSummary: z.string().default("This pull request updates the codebase."),
  confidenceScore: z.coerce.number().int().min(1).max(10).default(5),
  confidenceReason: z.string().default("Confidence is moderate because the available context is limited."),
  inlineComments: z.array(InlineCommentSchema).default([]),
  generalFeedback: z
    .object({
      strengths: z.array(z.string()).default([]),
      risks: z.array(z.string()).default([]),
      recommendations: z.array(z.string()).default([]),
    })
    .default({
      strengths: [],
      risks: [],
      recommendations: [],
    }),
});

function getGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
  });
}

function truncateDiff(diff: string): { diff: string; wasTruncated: boolean } {
  const maxDiffLength = 100 * 1024;

  if (diff.length <= maxDiffLength) {
    return {
      diff,
      wasTruncated: false,
    };
  }

  return {
    diff: `${diff.substring(0, maxDiffLength)}\n... [diff truncated due to size]`,
    wasTruncated: true,
  };
}

export async function reviewPullRequest({
  env,
  prData,
}: WithEnv<{ prData: PRReviewRequest }>): Promise<Result<PRReviewResponse>> {
  if (!env.GEMINI_API_KEY) {
    return {
      ok: false,
      errorCode: ErrorCodes.GEMINI_API_KEY_MISSING,
      error: "GEMINI_API_KEY not configured",
    } as const;
  }

  const logger = createLogger({
    correlationId: `gemini_${Date.now()}`,
    operation: "gemini_review",
    prNumber: "unknown",
  });
  const ai = getGeminiClient(env.GEMINI_API_KEY);
  const truncatedDiff = truncateDiff(prData.diff);
  const changedFilesSummary = prData.changedFiles
    .map((file) => `- ${file.path} (${file.status})`)
    .join("\n");

  const prompt = `You are reviewing a GitHub pull request as a senior software engineer.

PULL REQUEST TITLE:
${prData.title}

PULL REQUEST DESCRIPTION:
${prData.description ?? "No PR description provided."}

CHANGED FILES:
${changedFilesSummary || "- No changed files summary available"}

REPOSITORY CONTEXT:
${prData.projectContext}

UNIFIED DIFF:
\`\`\`diff
${truncatedDiff.diff}
\`\`\`

${truncatedDiff.wasTruncated ? "NOTE: The diff was truncated. Lower your confidence if the missing diff materially affects judgment." : ""}

Respond with strict JSON using this shape:
{
  "prSummary": "2-4 sentence summary of what the PR changes",
  "confidenceScore": 7,
  "confidenceReason": "1-2 sentence rationale for the confidence score",
  "inlineComments": [
    {
      "file": "src/file.ts",
      "line": 42,
      "side": "RIGHT",
      "severity": "warning",
      "title": "Why this is a problem",
      "body": "Concrete recommendation tied to the changed code"
    }
  ],
  "generalFeedback": {
    "strengths": ["positive point"],
    "risks": ["risk or correctness concern"],
    "recommendations": ["actionable next step"]
  }
}

Rules:
- Return at most 5 inline comments
- Only comment on changed files
- Prefer commenting on lines in the new file (RIGHT side)
- Use LEFT side only when the issue clearly targets a removed line
- Be specific and technical
- If evidence is weak, lower confidence instead of inventing issues`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return {
        ok: false,
        errorCode: ErrorCodes.GEMINI_RESPONSE_EMPTY,
        error: "No text content in Gemini response",
      } as const;
    }

    const parsed = PRReviewResponseSchema.safeParse(JSON.parse(rawText));

    if (!parsed.success) {
      logger.error("Failed to validate Gemini review response", {
        error: parsed.error.message,
      });
      return {
        ok: false,
        errorCode: ErrorCodes.GEMINI_RESPONSE_INVALID,
        error: "Invalid response format from Gemini API",
      } as const;
    }

    return {
      ok: true,
      data: {
        prSummary: parsed.data.prSummary,
        confidenceScore: parsed.data.confidenceScore,
        confidenceReason: parsed.data.confidenceReason,
        inlineComments: parsed.data.inlineComments.slice(0, 5),
        generalFeedback: parsed.data.generalFeedback,
      },
    } as const;
  } catch (error) {
    logger.error("Gemini review call failed", error instanceof Error ? error : null);
    return {
      ok: false,
      errorCode: ErrorCodes.GEMINI_API_FAILED,
      error: error instanceof Error ? error.message : "Gemini review failed",
    } as const;
  }
}

export async function generateFixPrompt({
  env,
  request,
}: WithEnv<{ request: FixPromptRequest }>): Promise<Result<string>> {
  if (!env.GEMINI_API_KEY) {
    return {
      ok: false,
      errorCode: ErrorCodes.GEMINI_API_KEY_MISSING,
      error: "GEMINI_API_KEY not configured",
    } as const;
  }

  const logger = createLogger({
    correlationId: `gemini_fix_${Date.now()}`,
    operation: "gemini_fix_prompt",
    prNumber: request.prNumber,
  });
  const ai = getGeminiClient(env.GEMINI_API_KEY);

  const prompt = `Write a prompt for a code-editing agent to fix a pull request review issue.

Repository: ${request.repositoryFullName}
PR Number: ${request.prNumber}
PR Summary: ${request.prSummary}
Review Confidence: ${request.confidenceScore}/10
Confidence Reason: ${request.confidenceReason}

Review Comment:
- File: ${request.comment.path}
- Line: ${request.comment.line ?? "Unknown"}
- Side: ${request.comment.side ?? "Unknown"}
- Severity: ${request.comment.severity}
- Title: ${request.comment.title}
- Body: ${request.comment.body}

Focused Project Context:
${request.projectContext}

Target File Context:
${request.fileContext ?? "No file content available."}

Return plain text only.
The prompt must:
- explain the bug or code-quality issue clearly
- identify the exact file and line area to inspect
- describe the expected fix
- mention project conventions inferred from context
- warn the editor not to change unrelated code
- suggest validation or tests to run after the change`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      return {
        ok: false,
        errorCode: ErrorCodes.GEMINI_RESPONSE_EMPTY,
        error: "No fix prompt returned from Gemini",
      } as const;
    }

    return {
      ok: true,
      data: rawText,
    } as const;
  } catch (error) {
    logger.error("Gemini fix prompt call failed", error instanceof Error ? error : null);
    return {
      ok: false,
      errorCode: ErrorCodes.PR_REVIEW_FIX_PROMPT_FAILED,
      error: error instanceof Error ? error.message : "Fix prompt generation failed",
    } as const;
  }
}
