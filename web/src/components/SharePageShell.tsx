/* eslint-disable @next/next/no-img-element */

/**
 * Server-rendered shell for the public share pages (/g, /w, /c, /pot).
 * These pages exist mostly for their embed metadata — but anyone who clicks
 * through lands here, so it doubles as a landing page with one job: get the
 * visitor into the app.
 */

type Accent = "primary" | "secondary" | "accent";

const ACCENT_TEXT: Record<Accent, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
};

const ACCENT_BORDER: Record<Accent, string> = {
  primary: "border-primary/40",
  secondary: "border-secondary/40",
  accent: "border-accent/40",
};

const ACCENT_BTN: Record<Accent, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
};

export default function SharePageShell({
  accent,
  kicker,
  headline,
  imageSrc,
  imageLabel,
  rows,
  ctaHref,
  ctaLabel,
  txUrl,
}: {
  accent: Accent;
  kicker: string;
  headline: string;
  imageSrc: string | null;
  imageLabel: string | null;
  rows: Array<{ label: string; value: string }>;
  ctaHref: string;
  ctaLabel: string;
  txUrl?: string | null;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-base-100">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <p className="text-xs uppercase tracking-[0.3em] text-base-content/40">
          {kicker}
        </p>
        <h1
          className={`font-creepster text-5xl sm:text-6xl uppercase leading-none ${ACCENT_TEXT[accent]}`}
        >
          {headline}
        </h1>

        {imageSrc ? (
          <div
            className={`w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden border-2 ${ACCENT_BORDER[accent]} shadow-lg`}
          >
            <img
              src={imageSrc}
              alt={imageLabel ?? ""}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        ) : null}
        {imageLabel ? (
          <p className="font-mono text-sm text-base-content/50 -mt-3">
            {imageLabel}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <dl className="w-full flex flex-col gap-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-base-content/10 pb-2"
              >
                <dt className="text-xs uppercase tracking-wide text-base-content/40">
                  {row.label}
                </dt>
                <dd className="font-mono text-sm text-base-content/90 truncate">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <a href={ctaHref} className={`btn ${ACCENT_BTN[accent]} btn-wide`}>
          {ctaLabel}
        </a>

        {txUrl ? (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-base-content/40 underline underline-offset-4 hover:text-base-content/70"
          >
            verify on BaseScan
          </a>
        ) : null}
      </div>
    </main>
  );
}
