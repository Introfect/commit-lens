import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { type WithEnv } from "../utils/commonTypes";
import { ErrorCodes, type Result } from "../utils/error";
import { createLogger } from "../utils/logger";

export type PRReviewRequest = {
  title: string;
  description?: string;
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

type ChangedFile = PRReviewRequest["changedFiles"][number];

type ReviewChunk = {
  files: ChangedFile[];
  diff: string;
};

type ReviewAggregate = Omit<PRReviewResponse, "inlineComments">;

const MAX_CHUNK_DIFF_CHARS = 48 * 1024;
const MAX_FILES_PER_CHUNK = 24;
const MAX_INLINE_COMMENTS_PER_PR = 25;
const MAX_INLINE_COMMENTS_PER_FILE = 5;
const MAX_INLINE_COMMENTS_PER_CHUNK = 12;

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

const ReviewAggregateSchema = z.object({
  prSummary: z.string().default("This pull request updates the codebase."),
  confidenceScore: z.coerce.number().int().min(1).max(10).default(5),
  confidenceReason: z
    .string()
    .default("Confidence is moderate because the available context is limited."),
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

const PRReviewResponseSchema = ReviewAggregateSchema.extend({
  inlineComments: z.array(InlineCommentSchema).default([]),
});

function getGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
  });
}

function buildChangedFilesSummary(files: ChangedFile[]): string {
  return files
    .map((file) => {
      const patchState = file.patch ? "patch available" : "patch unavailable";
      return `- ${file.path} (${file.status}, ${patchState})`;
    })
    .join("\n");
}

function formatPatchForPrompt(file: ChangedFile): string {
  if (!file.patch) {
    return [
      `FILE: ${file.path}`,
      `STATUS: ${file.status}`,
      "PATCH:",
      "[GitHub did not include a textual patch for this file. Avoid inline comments for it unless there is enough evidence elsewhere.]",
    ].join("\n");
  }

  return [
    `FILE: ${file.path}`,
    `STATUS: ${file.status}`,
    "PATCH:",
    "```diff",
    file.patch,
    "```",
  ].join("\n");
}

function buildChunkDiff(files: ChangedFile[]): string {
  if (files.length === 0) {
    return "No changed files were provided for this review chunk.";
  }

  return files.map((file) => formatPatchForPrompt(file)).join("\n\n");
}

function splitChangedFilesIntoChunks(files: ChangedFile[]): ReviewChunk[] {
  if (files.length === 0) {
    return [
      {
        files: [],
        diff: "No changed files were provided for this pull request.",
      },
    ];
  }

  const chunks: ReviewChunk[] = [];
  let currentFiles: ChangedFile[] = [];
  let currentSize = 0;

  for (const file of files) {
    const formattedPatch = formatPatchForPrompt(file);
    const nextSize = currentSize + formattedPatch.length;
    const shouldFlush =
      currentFiles.length > 0 &&
      (nextSize > MAX_CHUNK_DIFF_CHARS || currentFiles.length >= MAX_FILES_PER_CHUNK);

    if (shouldFlush) {
      chunks.push({
        files: currentFiles,
        diff: buildChunkDiff(currentFiles),
      });
      currentFiles = [];
      currentSize = 0;
    }

    currentFiles.push(file);
    currentSize += formattedPatch.length;
  }

  if (currentFiles.length > 0) {
    chunks.push({
      files: currentFiles,
      diff: buildChunkDiff(currentFiles),
    });
  }

  return chunks;
}

function getSeverityRank(severity: InlineComment["severity"]): number {
  if (severity === "error") {
    return 0;
  }

  if (severity === "warning") {
    return 1;
  }

  return 2;
}

function limitInlineComments(comments: InlineComment[]): InlineComment[] {
  const seen = new Set<string>();
  const uniqueComments: InlineComment[] = [];
  const commentsPerFile = new Map<string, number>();
  const sortedComments = [...comments].sort((left, right) => {
    const severityDifference =
      getSeverityRank(left.severity) - getSeverityRank(right.severity);

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.file.localeCompare(right.file) || left.line - right.line;
  });

  for (const comment of sortedComments) {
    const key = `${comment.file}:${comment.line}:${comment.side}:${comment.title}`;

    if (seen.has(key)) {
      continue;
    }

    const fileCommentCount = commentsPerFile.get(comment.file) ?? 0;

    if (fileCommentCount >= MAX_INLINE_COMMENTS_PER_FILE) {
      continue;
    }

    seen.add(key);
    uniqueComments.push(comment);

    commentsPerFile.set(comment.file, fileCommentCount + 1);

    if (uniqueComments.length >= MAX_INLINE_COMMENTS_PER_PR) {
      break;
    }
  }

  return uniqueComments;
}

function getUniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  const uniqueItems: string[] = [];

  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }

    seen.add(item);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function buildFallbackAggregate(chunkReviews: PRReviewResponse[]): ReviewAggregate {
  const summaryParts = chunkReviews
    .map((review) => review.prSummary.trim())
    .filter((summary) => summary.length > 0);
  const confidenceScore =
    chunkReviews.length === 0
      ? 5
      : Math.max(
          1,
          Math.min(
            10,
            Math.round(
              chunkReviews.reduce((sum, review) => sum + review.confidenceScore, 0) /
                chunkReviews.length
            )
          )
        );

  return {
    prSummary:
      summaryParts[0] ??
      "This pull request updates the codebase, but the review summary had to fall back to a minimal description.",
    confidenceScore,
    confidenceReason:
      "The overall confidence was derived from chunked review results because the final aggregation step did not return a valid response.",
    generalFeedback: {
      strengths: getUniqueItems(
        chunkReviews.flatMap((review) => review.generalFeedback.strengths)
      ).slice(0, 5),
      risks: getUniqueItems(
        chunkReviews.flatMap((review) => review.generalFeedback.risks)
      ).slice(0, 5),
      recommendations: getUniqueItems(
        chunkReviews.flatMap((review) => review.generalFeedback.recommendations)
      ).slice(0, 5),
    },
  };
}

async function runJsonPrompt<T>({
  ai,
  prompt,
  schema,
}: {
  ai: GoogleGenAI;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<Result<T>> {
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

    const parsed = schema.safeParse(JSON.parse(rawText));

    if (!parsed.success) {
      return {
        ok: false,
        errorCode: ErrorCodes.GEMINI_RESPONSE_INVALID,
        error: parsed.error.message,
      } as const;
    }

    return {
      ok: true,
      data: parsed.data,
    } as const;
  } catch (error) {
    return {
      ok: false,
      errorCode: ErrorCodes.GEMINI_API_FAILED,
      error: error instanceof Error ? error.message : "Gemini request failed",
    } as const;
  }
}

async function reviewChunk({
  ai,
  prData,
  chunk,
  chunkIndex,
  totalChunks,
}: {
  ai: GoogleGenAI;
  prData: PRReviewRequest;
  chunk: ReviewChunk;
  chunkIndex: number;
  totalChunks: number;
}): Promise<Result<PRReviewResponse>> {
  const changedFilesSummary = buildChangedFilesSummary(chunk.files);
  const prompt = `You are reviewing a GitHub pull request as a senior software engineer.

This is chunk ${chunkIndex + 1} of ${totalChunks} from the same pull request.
Only produce inline comments for files that appear in this chunk.

PULL REQUEST TITLE:
${prData.title}

PULL REQUEST DESCRIPTION:
${prData.description ?? "No PR description provided."}

CHANGED FILES IN THIS CHUNK:
${changedFilesSummary || "- No changed files summary available"}

REPOSITORY CONTEXT:
${prData.projectContext}

DIFF CHUNK:
${chunk.diff}

Respond with strict JSON using this shape:
{
  "prSummary": "2-4 sentence summary of what this chunk changes",
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
- Return at most ${MAX_INLINE_COMMENTS_PER_CHUNK} inline comments for this chunk
- The final PR review will keep at most ${MAX_INLINE_COMMENTS_PER_PR} inline comments total and at most ${MAX_INLINE_COMMENTS_PER_FILE} per file, so prioritize the highest-signal findings
- Only comment on changed files from this chunk
- Prefer commenting on lines in the new file (RIGHT side)
- Use LEFT side only when the issue clearly targets a removed line
- If GitHub omitted a file patch, do not invent inline comments for it
- Be specific and technical
- If evidence is weak, lower confidence instead of inventing issues`;

  const reviewResult = await runJsonPrompt({
    ai,
    prompt,
    schema: PRReviewResponseSchema,
  });

  if (!reviewResult.ok) {
    return reviewResult;
  }

  return {
    ok: true,
    data: {
      prSummary: reviewResult.data.prSummary ?? "This pull request updates the codebase.",
      confidenceScore: reviewResult.data.confidenceScore ?? 5,
      confidenceReason:
        reviewResult.data.confidenceReason ??
        "Confidence is moderate because the available context is limited.",
      inlineComments: (reviewResult.data.inlineComments ?? [])
        .slice(0, MAX_INLINE_COMMENTS_PER_CHUNK)
        .map((comment) => ({
        file: comment.file ?? "",
        line: comment.line ?? 1,
        side: comment.side ?? "RIGHT",
        severity: comment.severity ?? "info",
        title: comment.title ?? "Code review issue",
        body: comment.body ?? "General feedback",
        startLine: comment.startLine,
        startSide: comment.startSide,
      })),
      generalFeedback: {
        strengths: reviewResult.data.generalFeedback?.strengths ?? [],
        risks: reviewResult.data.generalFeedback?.risks ?? [],
        recommendations: reviewResult.data.generalFeedback?.recommendations ?? [],
      },
    },
  } as const;
}

async function synthesizeReviewAggregate({
  ai,
  prData,
  chunkReviews,
}: {
  ai: GoogleGenAI;
  prData: PRReviewRequest;
  chunkReviews: PRReviewResponse[];
}): Promise<Result<ReviewAggregate>> {
  const changedFilesSummary = buildChangedFilesSummary(prData.changedFiles);
  const chunkReviewSummary = chunkReviews
    .map(
      (review, index) =>
        [
          `CHUNK ${index + 1}:`,
          `Summary: ${review.prSummary}`,
          `Confidence: ${review.confidenceScore}/10`,
          `Confidence reason: ${review.confidenceReason}`,
          `Strengths: ${review.generalFeedback.strengths.join("; ") || "None"}`,
          `Risks: ${review.generalFeedback.risks.join("; ") || "None"}`,
          `Recommendations: ${review.generalFeedback.recommendations.join("; ") || "None"}`,
        ].join("\n")
    )
    .join("\n\n");

  const prompt = `You are synthesizing chunked review results into one overall GitHub pull request review.

PULL REQUEST TITLE:
${prData.title}

PULL REQUEST DESCRIPTION:
${prData.description ?? "No PR description provided."}

ALL CHANGED FILES:
${changedFilesSummary || "- No changed files summary available"}

CHUNK REVIEWS:
${chunkReviewSummary}

Respond with strict JSON using this shape:
{
  "prSummary": "2-4 sentence overall summary of what the PR changes",
  "confidenceScore": 7,
  "confidenceReason": "1-2 sentence rationale for the overall confidence score",
  "generalFeedback": {
    "strengths": ["positive point"],
    "risks": ["risk or correctness concern"],
    "recommendations": ["actionable next step"]
  }
}

Rules:
- Do not mention chunk numbers in the final summary
- Base the overall confidence on the combined coverage and any uncertainty from the chunk reviews
- Keep strengths, risks, and recommendations concise and technically specific`;

  const aggregateResult = await runJsonPrompt({
    ai,
    prompt,
    schema: ReviewAggregateSchema,
  });

  if (!aggregateResult.ok) {
    return aggregateResult;
  }

  return {
    ok: true,
    data: {
      prSummary: aggregateResult.data.prSummary ?? "This pull request updates the codebase.",
      confidenceScore: aggregateResult.data.confidenceScore ?? 5,
      confidenceReason:
        aggregateResult.data.confidenceReason ??
        "Confidence is moderate because the available context is limited.",
      generalFeedback: {
        strengths: aggregateResult.data.generalFeedback?.strengths ?? [],
        risks: aggregateResult.data.generalFeedback?.risks ?? [],
        recommendations: aggregateResult.data.generalFeedback?.recommendations ?? [],
      },
    },
  } as const;
}

export async function reviewPullRequest({
  env,
  prData,
}: WithEnv<{
  prData: PRReviewRequest;
}>): Promise<Result<PRReviewResponse>> {
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
  const reviewChunks = splitChangedFilesIntoChunks(prData.changedFiles);
  const chunkReviews: PRReviewResponse[] = [];

  for (const [index, chunk] of reviewChunks.entries()) {
    const chunkReview = await reviewChunk({
      ai,
      prData,
      chunk,
      chunkIndex: index,
      totalChunks: reviewChunks.length,
    });

    if (!chunkReview.ok) {
      logger.error("Gemini review chunk failed", {
        chunkIndex: index,
        errorCode: chunkReview.errorCode,
        error: chunkReview.error,
      });
      return chunkReview;
    }

    chunkReviews.push({
      prSummary: chunkReview.data.prSummary,
      confidenceScore: chunkReview.data.confidenceScore,
      confidenceReason: chunkReview.data.confidenceReason,
      inlineComments: chunkReview.data.inlineComments.slice(0, MAX_INLINE_COMMENTS_PER_CHUNK),
      generalFeedback: chunkReview.data.generalFeedback,
    });
  }

  const aggregateResult: Result<ReviewAggregate> =
    chunkReviews.length === 1
      ? {
          ok: true,
          data: {
            prSummary: chunkReviews[0].prSummary,
            confidenceScore: chunkReviews[0].confidenceScore,
            confidenceReason: chunkReviews[0].confidenceReason,
            generalFeedback: chunkReviews[0].generalFeedback,
          },
        } as const
      : await synthesizeReviewAggregate({
          ai,
          prData,
          chunkReviews,
        });

  const aggregate = aggregateResult.ok
    ? aggregateResult.data
    : buildFallbackAggregate(chunkReviews);

  if (!aggregateResult.ok) {
    logger.warn("Gemini review aggregate failed, using fallback summary", {
      errorCode: aggregateResult.errorCode,
      error: aggregateResult.error,
    });
  }

  return {
    ok: true,
    data: {
      prSummary: aggregate.prSummary,
      confidenceScore: aggregate.confidenceScore,
      confidenceReason: aggregate.confidenceReason,
      inlineComments: limitInlineComments(
        chunkReviews.flatMap((review) => review.inlineComments)
      ),
      generalFeedback: aggregate.generalFeedback,
    },
  } as const;
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
