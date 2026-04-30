"use client";

type ActiveView = "buy" | "sell";

type MobileBottomNavProps = {
  activeView: ActiveView;
  onSelect: (view: ActiveView) => void;
  hidden: boolean;
};

function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0l-7.17-7.17a2 2 0 010-2.83l7.17-7.17a2 2 0 011.41-.59H19a2 2 0 012 2v6.17a2 2 0 01-.59 1.42z" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="9" cy="7" rx="6" ry="2.5" />
      <path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" />
      <path d="M3 11v4c0 1.4 2.7 2.5 6 2.5 1 0 1.96-.1 2.8-.28" />
      <ellipse cx="16" cy="15.5" rx="5" ry="2.2" />
      <path d="M11 15.5v3c0 1.2 2.24 2.2 5 2.2s5-1 5-2.2v-3" />
    </svg>
  );
}

const TABS: {
  id: ActiveView;
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
}[] = [
  { id: "buy", label: "bid", Icon: TagIcon },
  { id: "sell", label: "sell", Icon: CoinsIcon },
];

export default function MobileBottomNav({
  activeView,
  onSelect,
  hidden,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={`fixed bottom-0 left-0 right-0 z-[55] sm:hidden bg-black backdrop-blur-md transition-[opacity,transform] duration-300 ease-out ${
        hidden
          ? "pointer-events-none opacity-0 translate-y-2"
          : "opacity-100 translate-y-0"
      }`}
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex items-stretch">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeView === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex w-full flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset ${
                  isActive ? "text-white" : "text-white/55 hover:text-white/80"
                }`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-6 top-0 h-px transition-opacity duration-200 ${
                    isActive ? "bg-primary opacity-90" : "bg-white/0 opacity-0"
                  }`}
                />
                <Icon className="h-[22px] w-[22px]" />
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase leading-none">
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
