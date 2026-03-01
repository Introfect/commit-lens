import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, ExternalLink, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../shared/components/ui/button';
import type { FixPromptResponse } from '../../../types';

type ClipboardState = 'idle' | 'copied' | 'failed';

type FixPromptPageProps = {
  data: FixPromptResponse;
};

function formatLineLabel(data: FixPromptResponse): string {
  if (data.comment.line === null) {
    return 'File-level note';
  }

  return `Line ${data.comment.line}`;
}

function formatSeverityLabel(data: FixPromptResponse): string {
  if (data.comment.severity === 'error') {
    return 'High priority';
  }

  if (data.comment.severity === 'warning') {
    return 'Review needed';
  }

  return 'Informational';
}

export function FixPromptPage({ data }: FixPromptPageProps) {
  const [clipboardState, setClipboardState] = useState<ClipboardState>('idle');

  useEffect(() => {
    async function copyPrompt(): Promise<void> {
      if (!navigator.clipboard) {
        setClipboardState('failed');
        return;
      }

      try {
        await navigator.clipboard.writeText(data.prompt);
        setClipboardState('copied');
      } catch {
        setClipboardState('failed');
      }
    }

    void copyPrompt();
  }, [data.prompt]);

  async function handleCopyAgain(): Promise<void> {
    if (!navigator.clipboard) {
      setClipboardState('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(data.prompt);
      setClipboardState('copied');
    } catch {
      setClipboardState('failed');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/34">Fix Prompt</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-white">Generate Prompt to Fix This</h1>
            <p className="max-w-3xl text-sm leading-6 text-white/58">
              CommitLens generated a project-aware prompt from the inline review comment and PR
              context. If clipboard access succeeded, it is already ready to paste into your coding
              agent.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleCopyAgain} className="gap-2">
            <Clipboard className="h-4 w-4" />
            Copy again
          </Button>
          <Link
            to="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]">
        <article className="rounded-[28px] border border-white/[0.07] bg-[#0d1114] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#1e9f63]/25 bg-[#1e9f63]/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9cffcb]">
              {formatSeverityLabel(data)}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
              {formatLineLabel(data)}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
              Confidence {data.confidenceScore}/10
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/34">Review Comment</p>
            <h2 className="text-2xl font-semibold text-white">{data.comment.title}</h2>
            <p className="text-sm leading-7 text-white/66">{data.comment.body}</p>
          </div>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <dt className="text-[11px] uppercase tracking-[0.22em] text-white/30">Repository</dt>
              <dd className="mt-2 text-sm font-medium text-white">{data.repositoryFullName}</dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <dt className="text-[11px] uppercase tracking-[0.22em] text-white/30">Pull Request</dt>
              <dd className="mt-2 text-sm font-medium text-white">#{data.prNumber}</dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <dt className="text-[11px] uppercase tracking-[0.22em] text-white/30">File</dt>
              <dd className="mt-2 break-all text-sm font-medium text-white">{data.comment.path}</dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <dt className="text-[11px] uppercase tracking-[0.22em] text-white/30">Anchor status</dt>
              <dd className="mt-2 text-sm font-medium text-white">{data.comment.anchorStatus}</dd>
            </div>
          </dl>

          <div className="mt-8 rounded-[24px] border border-white/[0.06] bg-black/20 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">PR Summary</p>
            <p className="mt-3 text-sm leading-7 text-white/66">{data.prSummary}</p>

            <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-white/30">
              Confidence rationale
            </p>
            <p className="mt-3 text-sm leading-7 text-white/66">{data.confidenceReason}</p>
          </div>
        </article>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-white/[0.07] bg-[#0d1114] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              {clipboardState === 'copied' ? (
                <CheckCircle2 className="h-5 w-5 text-[#9cffcb]" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-[#ffcb75]" />
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">
                  Clipboard status
                </p>
                <p className="mt-2 text-sm leading-6 text-white/66">
                  {clipboardState === 'copied'
                    ? data.copiedHint
                    : 'Clipboard access was not available. The prompt is still shown below for manual copy.'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">How to use it</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-white/62">
                <li>1. Paste the prompt into Cursor, Codex, Claude Code, or a similar coding agent.</li>
                <li>2. Ask it to make the change without broadening scope beyond the flagged issue.</li>
                <li>3. Re-run the relevant tests before pushing the update back to the PR.</li>
              </ol>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/[0.07] bg-[#0d1114] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#9cffcb]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">
                  Generated prompt
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  The prompt includes the inline issue, PR summary, confidence rationale, file target,
                  and focused repository context.
                </p>
              </div>
            </div>

            <pre className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#090b0d] p-4 text-sm leading-7 text-white/78">
              <code>{data.prompt}</code>
            </pre>
          </section>

          <section className="rounded-[28px] border border-white/[0.07] bg-[#0d1114] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">Route info</p>
            <div className="mt-4 space-y-3 text-sm text-white/60">
              <p>This page is designed to be opened directly from an inline GitHub review comment.</p>
              <p>
                Once the fix is prepared, return to the PR and update the affected lines in{' '}
                <span className="font-medium text-white">{data.comment.path}</span>.
              </p>
            </div>

            <Link
              to="/dashboard"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#8dffc7] transition-colors hover:text-[#b9ffde]"
            >
              <ExternalLink className="h-4 w-4" />
              Open dashboard workspace
            </Link>
          </section>
        </aside>
      </section>
    </div>
  );
}
