import * as jose from "jose";
import { WithEnv } from "../utils/commonTypes";
import {
  GitHubInstallation,
  GitHubInstallationAccessTokenSchema,
  GitHubInstallationRepositoriesResponseSchema,
  GitHubInstallationSchema,
  GitHubPullRequestDetails,
  GitHubPullRequestDetailsSchema,
  GitHubPullRequestFile,
  GitHubPullRequestFilesSchema,
  GitHubPullRequestReviewResponseSchema,
  GitHubRepository,
  GitHubRepositoryContentFileSchema,
} from "../types/github";
import { ErrorCodes, Result, getErrorMessage } from "../utils/error";

function convertPKCS1toPKCS8(pkcs1Key: string): string {
  const base64 = pkcs1Key
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, "")
    .replace(/-----END RSA PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  const algorithmIdentifier = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  const pkcs1Length = bytes.length;
  const lengthBytes = encodeDERLength(pkcs1Length);
  const octetString = new Uint8Array(1 + lengthBytes.length + pkcs1Length);
  octetString[0] = 0x04;
  octetString.set(lengthBytes, 1);
  octetString.set(bytes, 1 + lengthBytes.length);

  const contentLength = version.length + algorithmIdentifier.length + octetString.length;
  const pkcs8LengthBytes = encodeDERLength(contentLength);
  const pkcs8 = new Uint8Array(1 + pkcs8LengthBytes.length + contentLength);
  pkcs8[0] = 0x30;
  pkcs8.set(pkcs8LengthBytes, 1);

  let offset = 1 + pkcs8LengthBytes.length;
  pkcs8.set(version, offset);
  offset += version.length;
  pkcs8.set(algorithmIdentifier, offset);
  offset += algorithmIdentifier.length;
  pkcs8.set(octetString, offset);

  const pkcs8Base64 = btoa(String.fromCharCode(...pkcs8));
  const wrappedBase64 = pkcs8Base64.match(/.{1,64}/g)?.join("\n") ?? pkcs8Base64;

  return `-----BEGIN PRIVATE KEY-----\n${wrappedBase64}\n-----END PRIVATE KEY-----`;
}

function encodeDERLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length]);
  }

  const lengthBytes: number[] = [];
  let remainingLength = length;

  while (remainingLength > 0) {
    lengthBytes.unshift(remainingLength & 0xff);
    remainingLength >>= 8;
  }

  return new Uint8Array([0x80 | lengthBytes.length, ...lengthBytes]);
}

async function generateGitHubAppJWT({ env }: WithEnv<{}>): Promise<string> {
  let privateKeyPem = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

  if (
    !privateKeyPem.includes("-----BEGIN PRIVATE KEY-----") &&
    !privateKeyPem.includes("-----BEGIN RSA PRIVATE KEY-----")
  ) {
    return Promise.reject(
      new Error(
        "GITHUB_APP_PRIVATE_KEY appears to be invalid. It is too short or missing the standard PEM header. Make sure you used the contents of the .pem file, not the Client Secret."
      )
    );
  }

  if (privateKeyPem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    privateKeyPem = convertPKCS1toPKCS8(privateKeyPem);
  }

  const privateKey = await jose.importPKCS8(privateKeyPem, "RS256");

  return new jose.SignJWT({
    iss: env.GITHUB_APP_ID,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(privateKey);
}

function buildGitHubHeaders({
  token,
  accept = "application/vnd.github+json",
}: {
  token: string;
  accept?: string;
}): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "User-Agent": "CommitLens-App",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getInstallationToken({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<Result<string>> {
  const accessTokenResult = await getInstallationAccessToken({ env, installationId });

  if (!accessTokenResult.ok) {
    return accessTokenResult;
  }

  return {
    ok: true,
    data: accessTokenResult.data.token,
  } as const;
}

function decodeGitHubFileContent(encodedContent: string, encoding: string): string | null {
  if (encoding !== "base64") {
    return null;
  }

  return atob(encodedContent.replace(/\n/g, ""));
}

export async function getInstallationAccessToken({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<Result<{ token: string; expiresAt: string }>> {
  let appJWT = "";

  try {
    appJWT = await generateGitHubAppJWT({ env });
  } catch (error) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_APP_CONFIGURATION_INVALID,
      error: getErrorMessage(error instanceof Error ? error : null),
    } as const;
  }

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJWT}`,
        "User-Agent": "CommitLens-App",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_ACCESS_TOKEN_FAILED,
      error: `Failed to get installation access token: ${error}`,
    } as const;
  }

  const parsed = GitHubInstallationAccessTokenSchema.safeParse(await response.json());

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_ACCESS_TOKEN_FAILED,
      error: parsed.error.message,
    } as const;
  }

  return {
    ok: true,
    data: {
      token: parsed.data.token,
      expiresAt: parsed.data.expires_at,
    },
  } as const;
}

export async function getInstallationRepositories({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<Result<GitHubRepository[]>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const response = await fetch("https://api.github.com/installation/repositories", {
    headers: buildGitHubHeaders({ token: tokenResult.data }),
  });

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_REPOSITORIES_FETCH_FAILED,
      error: `Failed to fetch installation repositories: ${error}`,
    } as const;
  }

  const parsed = GitHubInstallationRepositoriesResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_REPOSITORIES_FETCH_FAILED,
      error: parsed.error.message,
    } as const;
  }

  return {
    ok: true,
    data: parsed.data.repositories,
  } as const;
}

export async function getInstallation({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<Result<GitHubInstallation>> {
  let appJWT = "";

  try {
    appJWT = await generateGitHubAppJWT({ env });
  } catch (error) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_APP_CONFIGURATION_INVALID,
      error: getErrorMessage(error instanceof Error ? error : null),
    } as const;
  }

  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${appJWT}`,
      "User-Agent": "CommitLens-App",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_INSTALLATION_FETCH_FAILED,
      error: `Failed to get installation: ${error}`,
    } as const;
  }

  const parsed = GitHubInstallationSchema.safeParse(await response.json());

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_INSTALLATION_FETCH_FAILED,
      error: parsed.error.message,
    } as const;
  }

  return {
    ok: true,
    data: parsed.data,
  } as const;
}

export async function fetchPullRequestDiff({
  env,
  installationId,
  owner,
  repo,
  prNumber,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  prNumber: string;
}>): Promise<Result<string>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: buildGitHubHeaders({
        token: tokenResult.data,
        accept: "application/vnd.github.v3.diff",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_DIFF_FETCH_FAILED,
      error: `Failed to fetch PR diff: ${error}`,
    } as const;
  }

  return {
    ok: true,
    data: await response.text(),
  } as const;
}

export async function fetchPullRequestDetails({
  env,
  installationId,
  owner,
  repo,
  prNumber,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  prNumber: string;
}>): Promise<Result<GitHubPullRequestDetails>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: buildGitHubHeaders({ token: tokenResult.data }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_PR_FETCH_FAILED,
      error: `Failed to fetch PR details: ${error}`,
    } as const;
  }

  const parsed = GitHubPullRequestDetailsSchema.safeParse(await response.json());

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_PR_FETCH_FAILED,
      error: parsed.error.message,
    } as const;
  }

  return {
    ok: true,
    data: parsed.data,
  } as const;
}

export async function fetchPullRequestFiles({
  env,
  installationId,
  owner,
  repo,
  prNumber,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  prNumber: string;
}>): Promise<Result<GitHubPullRequestFile[]>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const files: GitHubPullRequestFile[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      {
        headers: buildGitHubHeaders({ token: tokenResult.data }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        ok: false,
        errorCode: ErrorCodes.GITHUB_PR_FILES_FETCH_FAILED,
        error: `Failed to fetch PR files: ${error}`,
      } as const;
    }

    const parsed = GitHubPullRequestFilesSchema.safeParse(await response.json());

    if (!parsed.success) {
      return {
        ok: false,
        errorCode: ErrorCodes.GITHUB_PR_FILES_FETCH_FAILED,
        error: parsed.error.message,
      } as const;
    }

    files.push(...parsed.data);

    if (parsed.data.length < 100) {
      break;
    }
  }

  return {
    ok: true,
    data: files,
  } as const;
}

export async function fetchRepositoryTextContent({
  env,
  installationId,
  owner,
  repo,
  path,
  ref,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}>): Promise<Result<string>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    {
      headers: buildGitHubHeaders({ token: tokenResult.data }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_CONTENT_FETCH_FAILED,
      error: `Failed to fetch repository content for ${path}: ${error}`,
    } as const;
  }

  const parsed = GitHubRepositoryContentFileSchema.safeParse(await response.json());

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_CONTENT_FETCH_FAILED,
      error: parsed.error.message,
    } as const;
  }

  const decodedContent = decodeGitHubFileContent(parsed.data.content, parsed.data.encoding);

  if (decodedContent === null) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_CONTENT_FETCH_FAILED,
      error: `Unsupported content encoding for ${path}: ${parsed.data.encoding}`,
    } as const;
  }

  return {
    ok: true,
    data: decodedContent,
  } as const;
}

export async function postPullRequestReview({
  env,
  installationId,
  owner,
  repo,
  prNumber,
  reviewData,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  prNumber: string;
  reviewData: {
    commitId: string;
    body: string;
    event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
    comments?: Array<{
      path: string;
      body: string;
      line: number;
      side: "LEFT" | "RIGHT";
      startLine?: number;
      startSide?: "LEFT" | "RIGHT";
    }>;
  };
}>): Promise<Result<{ reviewId: string }>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    {
      method: "POST",
      headers: {
        ...buildGitHubHeaders({ token: tokenResult.data }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commit_id: reviewData.commitId,
        body: reviewData.body,
        event: reviewData.event,
        comments: reviewData.comments?.map((comment) => ({
          path: comment.path,
          body: comment.body,
          line: comment.line,
          side: comment.side,
          start_line: comment.startLine,
          start_side: comment.startSide,
        })),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_REVIEW_POST_FAILED,
      error: `Failed to post PR review: ${error}`,
    } as const;
  }

  const parsed = GitHubPullRequestReviewResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_REVIEW_POST_FAILED,
      error: parsed.error.message,
    } as const;
  }

  return {
    ok: true,
    data: {
      reviewId: parsed.data.id.toString(),
    },
  } as const;
}

export async function postPullRequestComment({
  env,
  installationId,
  owner,
  repo,
  prNumber,
  body,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  prNumber: string;
  body: string;
}>): Promise<Result<null>> {
  const tokenResult = await getInstallationToken({ env, installationId });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: {
        ...buildGitHubHeaders({ token: tokenResult.data }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_COMMENT_POST_FAILED,
      error: `Failed to post PR comment: ${error}`,
    } as const;
  }

  return { ok: true, data: null } as const;
}

export async function verifyWebhookSignature({
  env,
  payload,
  signature,
}: WithEnv<{
  payload: string;
  signature: string;
}>): Promise<boolean> {
  const secret = env.GITHUB_WEBHOOK_SECRET;

  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const signatureHash = signature.slice(7);
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payloadData = encoder.encode(payload);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map((value) => value.toString(16).padStart(2, "0")).join("");

  return hashHex === signatureHash;
}
