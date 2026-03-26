/* eslint-disable @next/next/no-img-element */

const STEPS = [
  {
    step: "1",
    title: "Stream",
    description:
      "USDCx streams into the Gobbler pot via Superfluid, filling it continuously.",
    color: "primary" as const,
  },
  {
    step: "2",
    title: "Deposit",
    description:
      "When the pot exceeds floor price, deposit a Warplet NFT and drain the entire balance.",
    color: "primary" as const,
  },
  {
    step: "3",
    title: "Auction",
    description: "Gobbled Warplets go to auction. Bid $STRAT to win.",
    color: "secondary" as const,
  },
  {
    step: "4",
    title: "Earn",
    description:
      "$STRAT from auction proceeds flows to stakers, closing the flywheel.",
    color: "accent" as const,
  },
];

const STEP_COLORS = {
  primary: {
    bg: "bg-primary/10",
    border: "border-primary/20",
    text: "text-primary",
  },
  secondary: {
    bg: "bg-secondary/10",
    border: "border-secondary/20",
    text: "text-secondary",
  },
  accent: {
    bg: "bg-accent/10",
    border: "border-accent/20",
    text: "text-accent",
  },
};

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">W</span>
          </div>
          <span className="font-bold text-lg tracking-tight">
            Warplet<span className="text-primary">Gobbler</span>
          </span>
        </div>
        <button className="btn btn-primary btn-sm" disabled>
          Enter App
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 animate-fade-up">
        <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-6 sm:mb-8">
          <img
            src="/warplet.png"
            alt="Warplet Gobbler"
            className="w-full h-full rounded-full object-cover"
          />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
          The Perpetual
          <br />
          <span className="text-primary">Warplet Machine</span>
        </h1>

        <p className="mt-4 sm:mt-6 text-base sm:text-lg text-base-content/60 max-w-lg mx-auto leading-relaxed">
          An automated flywheel that buys Warplets using Superfluid streams,
          auctions them for $STRAT, and rewards stakers.
        </p>

        <div className="mt-6 sm:mt-8 flex items-center justify-center gap-4">
          <a href="#how-it-works" className="btn btn-primary">
            How it works
          </a>
          <button className="btn btn-ghost text-base-content/60" disabled>
            Enter App
          </button>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="max-w-2xl mx-auto px-6 py-12 sm:py-16 animate-fade-up-delay-1"
      >
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-10 sm:mb-12">
          How the Flywheel Works
        </h2>

        <div className="space-y-6 sm:space-y-8">
          {STEPS.map((item) => {
            const colors = STEP_COLORS[item.color];
            return (
              <div key={item.step} className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center text-sm font-bold ${colors.text} shrink-0`}
                >
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="text-base-content/50 mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-base-content/5 py-6 sm:py-8 px-6 animate-fade-up-delay-2">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-base-content/30">
          <span>WarpletGobbler &mdash; built on Base</span>
          <div className="flex gap-6">
            <a
              href="https://opensea.io/collection/the-warplets-farcaster"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              OpenSea
            </a>
            <span className="hover:text-primary cursor-pointer transition-colors">
              Contracts
            </span>
            <span className="hover:text-primary cursor-pointer transition-colors">
              Docs
            </span>
            <span className="hover:text-primary cursor-pointer transition-colors">
              GitHub
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
