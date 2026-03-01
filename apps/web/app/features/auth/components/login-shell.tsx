import { ArrowRight, Github, GitBranch, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/ui/button';

type LoginShellProps = {
  errorMessage: string | null;
  onContinue: () => void;
};

function SecurityFieldIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 640 760"
      className="h-full w-full text-white/70"
      fill="none"
    >
      <defs>
        <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" stroke="currentColor" strokeOpacity="0.045" />
        </pattern>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(360 330) rotate(94) scale(350 280)">
          <stop stopColor="#34d399" stopOpacity="0.25" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="640" height="760" fill="url(#grid)" />
      <rect width="640" height="760" fill="url(#glow)" />

      <g opacity="0.85">
        <path
          d="M365 170L470 215L532 323L509 475L420 606L291 649L222 603L260 506L219 397L263 272L365 170Z"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="4 10"
        />

        <g fill="currentColor">
          {[
            [312, 186], [346, 204], [388, 221], [423, 248], [456, 292], [470, 338],
            [466, 389], [447, 435], [420, 479], [392, 530], [353, 571], [315, 607],
            [282, 588], [284, 540], [300, 499], [278, 457], [267, 407], [279, 353],
            [298, 309], [324, 266], [362, 229], [401, 274], [422, 331], [420, 395],
            [403, 454], [372, 512], [338, 555], [319, 497], [335, 437], [334, 377],
            [350, 326], [375, 289],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" />
          ))}
        </g>
      </g>

      <path
        d="M270 582L325 548L385 468L410 389L404 309L376 252"
        stroke="#a7f3d0"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M438 156v44M438 156h44M512 620v44M512 664h44M112 510v44M68 554h44"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function LoginShell({ errorMessage, onContinue }: LoginShellProps) {
  return (
    <div className="min-h-screen bg-[#0c0f0e] text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,660px)_1fr]">
        <section className="relative flex min-h-screen items-center border-r border-white/6 bg-[#0a0c0c] px-6 py-12 sm:px-10 lg:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#143225_0%,transparent_45%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_14%,transparent_86%,rgba(255,255,255,0.02)_100%)]" />

          <div className="relative z-10 mx-auto w-full max-w-sm">
            <div className="mb-12 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center reeeddddccc-2xl bg-[#13a96b]/15 ring-1 ring-[#13a96b]/30">
                <GitBranch className="h-5 w-5 text-[#2bd98b]" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.26em] text-white/45">Commit Lens</p>
                <p className="text-sm text-white/60">GitHub-native review intelligence</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 reeeddddccc-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/55">
                <ShieldCheck className="h-3.5 w-3.5 text-[#2bd98b]" />
                Single GitHub authentication
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Log into your account
                </h1>
                <p className="max-w-sm text-sm leading-6 text-white/58">
                  One GitHub sign-in for identity, repository access, and review history. No
                  second auth flow, no provider switching.
                </p>
              </div>

              {errorMessage ? (
                <div className="reeeddddccc-2xl border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              <div className="space-y-4 pt-4">
                <Button
                  size="lg"
                  onClick={onContinue}
                  className="h-12 w-full justify-between reeeddddccc-2xl bg-[#16975f] px-5 text-sm font-semibold text-white hover:bg-[#1ab06d]"
                >
                  <span className="flex items-center gap-3">
                    <Github className="h-4 w-4" />
                    Continue with GitHub
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="reeeddddccc-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center reeeddddccc-xl bg-white/5">
                      <ShieldCheck className="h-4 w-4 text-[#7af0b8]" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">Repository authorization stays explicit</p>
                      <p className="text-sm leading-6 text-white/50">
                        After sign-in, you install the GitHub App only if you have not connected repositories yet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative hidden overflow-hidden bg-[#111313] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(44,217,139,0.12),transparent_32%),radial-gradient(circle_at_80%_65%,rgba(255,255,255,0.08),transparent_28%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_38%,rgba(255,255,255,0.025))]" />
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:20px_20px]" />

          <div className="relative flex h-full items-center justify-center px-12 py-12">
            <div className="absolute inset-x-12 top-10 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-white/30">
              <span>Review Surface</span>
              <span>GitHub App Linked</span>
            </div>

            <div className="absolute bottom-10 left-12 right-12 flex items-center justify-between text-sm text-white/38">
              <div className="max-w-xs">
                Code review becomes the primary object in the product once identity and installation are on the same GitHub axis.
              </div>
              <div className="reeeddddccc-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-white/46">
                Session secured
              </div>
            </div>

            <div className="relative h-[620px] w-full max-w-[620px] overflow-hidden reeeddddccc-[32px] border border-white/6 bg-[#141817] shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.04),transparent_50%)]" />
              <SecurityFieldIllustration />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
