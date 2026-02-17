interface TopEarningsEntry {
  tag: string;
  displayName: string;
  team: string;
  earningsUsd: number;
  matcherinoUrl: string | null;
}

interface TopEarningsBoardProps {
  entries: TopEarningsEntry[];
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function TopEarningsBoard({ entries }: TopEarningsBoardProps) {
  if (entries.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-5">
        <h2 className="text-lg font-bold text-white">Top Earnings Matcherino</h2>
        <p className="mt-2 text-sm text-slate-300">Aucune donnée earnings en base `pro_players`.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neon-cyan/40 bg-surface-900/80 p-5">
      <h2 className="text-lg font-bold text-white">Top Earnings Matcherino</h2>
      <div className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <article key={`${entry.tag}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-700 bg-surface-900 px-3 py-2">
            <div>
              <p className="text-xs text-neon-cyan">#{index + 1}</p>
              <p className="font-semibold text-white">{entry.displayName}</p>
              <p className="text-xs text-slate-400">
                {entry.team} • {entry.tag}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-neon-cyan">{money(entry.earningsUsd)}</p>
              {entry.matcherinoUrl ? (
                <a href={entry.matcherinoUrl} target="_blank" rel="noreferrer" className="text-xs text-neon-lime underline">
                  Matcherino
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
