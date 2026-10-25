import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type Tab = {
  label: string;
  to: string;
};

function matchesPath(path: string, to: string) {
  return path === to || path.startsWith(to + "/");
}

export function TabLayout({ tabs, children }: { tabs: Tab[]; children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });

  const active = tabs.reduce<string | null>((best, tab) => {
    const matches = matchesPath(path, tab.to);
    const moreSpecific = best && tab.to.length > best.length;
    return matches && (best === null || moreSpecific) ? tab.to : best;
  }, null);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const activeTab = active === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
