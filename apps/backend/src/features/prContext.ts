import { fetchRepositoryTextContent } from "../services/github";
import { GitHubPullRequestFile } from "../types/github";
import { WithEnv } from "../utils/commonTypes";

type ProjectContextDocument = {
  path: string;
  source: "readme" | "config" | "changed_file";
  content: string;
};

const ROOT_CONTEXT_CANDIDATES = [
  "README.md",
  "README.MD",
  "readme.md",
  "README",
  "package.json",
  "tsconfig.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.cjs",
  "wrangler.jsonc",
  "docker-compose.yml",
  "docker-compose.yaml",
] as const;

const CHANGED_FILE_LIMIT = 6;
const MAX_DOCUMENT_CHARS = 6000;

function trimContent(content: string): string {
  if (content.length <= MAX_DOCUMENT_CHARS) {
    return content;
  }

  const headLength = 3500;
  const tailLength = 2000;
  return `${content.slice(0, headLength)}\n...\n${content.slice(content.length - tailLength)}`;
}

function isLikelyTextContent(content: string): boolean {
  return !content.includes("\u0000");
}

function getChangedFilesForContext(files: GitHubPullRequestFile[]): GitHubPullRequestFile[] {
  return files
    .filter((file) => file.status !== "removed")
    .filter((file) => typeof file.patch === "string" && file.patch.length > 0)
    .slice(0, CHANGED_FILE_LIMIT);
}

async function tryFetchContextDocument({
  env,
  installationId,
  owner,
  repo,
  ref,
  path,
  source,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  source: ProjectContextDocument["source"];
}>): Promise<ProjectContextDocument | null> {
  const contentResult = await fetchRepositoryTextContent({
    env,
    installationId,
    owner,
    repo,
    path,
    ref,
  });

  if (!contentResult.ok || !isLikelyTextContent(contentResult.data)) {
    return null;
  }

  return {
    path,
    source,
    content: trimContent(contentResult.data),
  };
}

export async function buildFocusedProjectContext({
  env,
  installationId,
  owner,
  repo,
  ref,
  changedFiles,
}: WithEnv<{
  installationId: string;
  owner: string;
  repo: string;
  ref: string;
  changedFiles: GitHubPullRequestFile[];
}>): Promise<{ documents: ProjectContextDocument[] }> {
  const documents: ProjectContextDocument[] = [];

  for (const candidate of ROOT_CONTEXT_CANDIDATES) {
    const source: ProjectContextDocument["source"] = candidate.startsWith("README")
      ? "readme"
      : "config";
    const contextDocument = await tryFetchContextDocument({
      env,
      installationId,
      owner,
      repo,
      ref,
      path: candidate,
      source,
    });

    if (contextDocument) {
      documents.push(contextDocument);
    }
  }

  for (const file of getChangedFilesForContext(changedFiles)) {
    const contextDocument = await tryFetchContextDocument({
      env,
      installationId,
      owner,
      repo,
      ref,
      path: file.filename,
      source: "changed_file",
    });

    if (contextDocument) {
      documents.push(contextDocument);
    }
  }

  return { documents };
}

export function formatProjectContextForPrompt(documents: ProjectContextDocument[]): string {
  if (documents.length === 0) {
    return "No additional repository context was available.";
  }

  return documents
    .map(
      (document) =>
        `FILE: ${document.path}\nSOURCE: ${document.source}\n\`\`\`\n${document.content}\n\`\`\``
    )
    .join("\n\n");
}
