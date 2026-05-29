import { STATUS_META, formatShortDate } from '../lib/constants.js';

// Barre de progression au prorata des statuts + plage de dates globale.
export default function GroupSummary({ tasks }) {
  const total = tasks.length;

  // Répartition par statut
  const counts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  const segments = Object.entries(counts).map(([status, n]) => ({
    status,
    pct: (n / total) * 100,
    color: STATUS_META[status]?.bg || '#c4c4c4',
  }));

  // Plage de dates
  const dates = tasks.map((t) => t.duedate).filter(Boolean).sort();
  const range =
    dates.length > 0
      ? dates.length === 1
        ? formatShortDate(dates[0])
        : `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])
            .replace(/^[a-zéû.]+\s/i, '')}`
      : null;

  return (
    <div className="flex items-stretch bg-white text-sm">
      <div className="w-1 shrink-0 bg-transparent" />
      <div className="w-10 shrink-0" />
      <div className="flex-1" />

      {/* Colonne Admin (vide) */}
      <div className="w-32 shrink-0 border-l border-transparent" />

      {/* Barre statut */}
      <div className="flex w-40 shrink-0 items-center justify-center border-l border-gray-100 px-2 py-2">
        {total > 0 ? (
          <div className="flex h-5 w-full overflow-hidden rounded-full" title={`${total} tâche(s)`}>
            {segments.map((s) => (
              <div
                key={s.status}
                style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                title={`${s.status} : ${Math.round(s.pct)}%`}
              />
            ))}
          </div>
        ) : (
          <div className="h-5 w-full rounded-full bg-gray-100" />
        )}
      </div>

      {/* Plage de dates */}
      <div className="flex w-36 shrink-0 items-center justify-center border-l border-gray-100 px-2 py-2">
        {range && (
          <span className="rounded-full bg-[#cce5ff] px-3 py-1 text-xs font-medium text-[#0073ea]">
            {range}
          </span>
        )}
      </div>

      <div className="w-10 shrink-0 border-l border-gray-100" />
    </div>
  );
}
