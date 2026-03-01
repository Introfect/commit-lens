import { GitHubPullRequestFile } from "../types/github";

export type ParsedPatchLine = {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: "add" | "delete" | "context";
};

export type ParsedPatchFile = {
  path: string;
  previousPath: string | null;
  lines: ParsedPatchLine[];
};

export type InlineCommentAnchor = {
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
};

function findMatchingPath(
  parsedFiles: Map<string, ParsedPatchFile>,
  filePath: string
): ParsedPatchFile | null {
  const directMatch = parsedFiles.get(filePath);

  if (directMatch) {
    return directMatch;
  }

  for (const parsedFile of parsedFiles.values()) {
    if (
      parsedFile.path.endsWith(filePath) ||
      filePath.endsWith(parsedFile.path) ||
      (parsedFile.previousPath !== null &&
        (parsedFile.previousPath.endsWith(filePath) || filePath.endsWith(parsedFile.previousPath)))
    ) {
      return parsedFile;
    }
  }

  return null;
}

export function parsePullRequestFileAnchors(
  files: GitHubPullRequestFile[]
): Map<string, ParsedPatchFile> {
  const parsedFiles = new Map<string, ParsedPatchFile>();

  for (const file of files) {
    const patch = file.patch;

    if (!patch) {
      continue;
    }

    const lines = patch.split("\n");
    const parsedLines: ParsedPatchLine[] = [];
    let oldLineNumber = 0;
    let newLineNumber = 0;
    let isInsideHunk = false;

    for (const line of lines) {
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

        if (match) {
          oldLineNumber = parseInt(match[1], 10);
          newLineNumber = parseInt(match[2], 10);
          isInsideHunk = true;
        }

        continue;
      }

      if (!isInsideHunk || line.startsWith("\\ No newline at end of file")) {
        continue;
      }

      if (line.startsWith("+")) {
        parsedLines.push({
          oldLineNumber: null,
          newLineNumber,
          type: "add",
        });
        newLineNumber += 1;
        continue;
      }

      if (line.startsWith("-")) {
        parsedLines.push({
          oldLineNumber,
          newLineNumber: null,
          type: "delete",
        });
        oldLineNumber += 1;
        continue;
      }

      parsedLines.push({
        oldLineNumber,
        newLineNumber,
        type: "context",
      });
      oldLineNumber += 1;
      newLineNumber += 1;
    }

    parsedFiles.set(file.filename, {
      path: file.filename,
      previousPath: file.previous_filename ?? null,
      lines: parsedLines,
    });
  }

  return parsedFiles;
}

export function resolveInlineCommentAnchor({
  parsedFiles,
  filePath,
  line,
  side,
  startLine,
  startSide,
}: {
  parsedFiles: Map<string, ParsedPatchFile>;
  filePath: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
}): InlineCommentAnchor | null {
  const parsedFile = findMatchingPath(parsedFiles, filePath);

  if (!parsedFile) {
    return null;
  }

  const targetLine = parsedFile.lines.find((patchLine) => {
    if (side === "RIGHT") {
      return patchLine.newLineNumber === line && patchLine.type !== "delete";
    }

    return patchLine.oldLineNumber === line && patchLine.type !== "add";
  });

  if (!targetLine) {
    return null;
  }

  const anchor: InlineCommentAnchor = {
    path: parsedFile.path,
    line,
    side,
  };

  if (startLine && startSide) {
    const startPatchLine = parsedFile.lines.find((patchLine) => {
      if (startSide === "RIGHT") {
        return patchLine.newLineNumber === startLine && patchLine.type !== "delete";
      }

      return patchLine.oldLineNumber === startLine && patchLine.type !== "add";
    });

    if (startPatchLine) {
      anchor.startLine = startLine;
      anchor.startSide = startSide;
    }
  }

  return anchor;
}
