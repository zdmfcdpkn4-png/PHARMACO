import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  EyeOff,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { STATUS_META } from '../lib/constants.js';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const SATURATION_THRESHOLD = 3; // > 3 tâches actives le même jour => saturé

// Renvoie le lundi de la semaine contenant `ref` (00:00).
function startOfWeek(ref = new Date()) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  return d;
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// Vue "Charge de travail de l'équipe" : une ligne par agent, frise des
// 7 jours de la semaine en cours, indicateur de saturation.
export default function TeamWorkloadView({ board, users, onOpenTask }) {
  const [agentFilter, setAgentFilter] = useState(null);
  const [hideDone, setHideDone] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = semaine en cours

  // Bornes de la semaine affichée (décalée de weekOffset semaines)
  const weekStart = useMemo(() => {
    const base = startOfWeek();
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );
  const weekKeys = useMemo(() => weekDays.map(ymd), [weekDays]);

  // Toutes les tâches à plat
  const allTasks = useMemo(() => {
    const out = [];
    for (const g of board?.groups || []) {
      for (const t of g.tasks) out.push(t);
    }
    return out;
  }, [board]);

  const todayKey = ymd(new Date());

  // Construit la charge par agent : { [userId]: { [dayKey]: tasks[] } }
  const workload = useMemo(() => {
    const map = new Map();
    for (const u of users) map.set(u.id, {});
    for (const t of allTasks) {
      if (!t.admin || !t.duedate) continue;
      if (hideDone && t.status === 'Fait') continue;
      const key = t.duedate.slice(0, 10);
      if (!weekKeys.includes(key)) continue;
      const byDay = map.get(t.admin.id);
      if (!byDay) continue;
      (byDay[key] ||= []).push(t);
    }
    return map;
  }, [allTasks, users, weekKeys, hideDone]);

  const visibleUsers = agentFilter ? users.filter((u) => u.id === agentFilter) : users;

  // Une tâche est "active" si non terminée
  const isActive = (t) => t.status !== 'Fait';

  // Charge max (tâches actives sur un même jour) d'un agent dans la semaine
  const maxActivePerDay = (uid) => {
    const byDay = workload.get(uid) || {};
    return weekKeys.reduce(
      (m, k) => Math.max(m, (byDay[k] || []).filter(isActive).length),
      0
    );
  };
  const totalForUser = (uid) => {
    const byDay = workload.get(uid) || {};
    return weekKeys.reduce((s, k) => s + (byDay[k] || []).length, 0);
  };

  // ---- Récapitulatif global (sur les agents visibles) ----
  const summary = useMemo(() => {
    let totalTasks = 0;
    let overloaded = 0;
    let atLimit = 0;
    let optimal = 0;
    for (const u of visibleUsers) {
      totalTasks += totalForUser(u.id);
      const mx = maxActivePerDay(u.id);
      if (mx > SATURATION_THRESHOLD) overloaded += 1;
      else if (mx === SATURATION_THRESHOLD) atLimit += 1;
      else optimal += 1;
    }
    return { totalTasks, overloaded, atLimit, optimal, agents: visibleUsers.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleUsers, workload, weekKeys]);

  // ---- Export CSV de la charge affichée ----
  const exportCsv = () => {
    const header = ['Agent', 'Email', 'Total semaine', 'Max actives/jour', 'Capacité', ...weekDays.map((d, i) => `${DAY_LABELS[i]} ${d.getDate()}`)];
    const rows = visibleUsers.map((u) => {
      const byDay = workload.get(u.id) || {};
      const mx = maxActivePerDay(u.id);
      const capacite = mx > SATURATION_THRESHOLD ? 'Surchargé' : mx === SATURATION_THRESHOLD ? 'Limite' : 'Optimale';
      const perDay = weekKeys.map((k) =>
        (byDay[k] || []).map((t) => `${t.name} (${t.status})`).join(' | ')
      );
      return [u.name, u.email, totalForUser(u.id), mx, capacite, ...perDay];
    });
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map((r) => r.map(escape).join(';')).join('\n');
    // BOM pour Excel + accents
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charge-equipe-${weekKeys[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Export PDF direct de la charge affichée ----
  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 28;

    doc.setFontSize(16);
    doc.setTextColor(59, 31, 122);
    doc.text("PHARMACO — Charge de travail de l'équipe", margin, margin);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `Semaine du ${weekDays[0].toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })} · Seuil de saturation : ${SATURATION_THRESHOLD} tâches actives/jour`,
      margin,
      margin + 16
    );

    const head = [['Agent', 'Capacité', 'Total', ...weekDays.map((d, i) => `${DAY_LABELS[i]} ${d.getDate()}`)]];
    const body = visibleUsers.map((u) => {
      const byDay = workload.get(u.id) || {};
      const mx = maxActivePerDay(u.id);
      const capacite = mx > SATURATION_THRESHOLD ? 'Surchargé' : mx === SATURATION_THRESHOLD ? 'Limite' : 'Optimale';
      const perDay = weekKeys.map((k) => (byDay[k] || []).map((t) => t.name).join('\n') || '');
      return [u.name, capacite, String(totalForUser(u.id)), ...perDay];
    });

    autoTable(doc, {
      startY: margin + 28,
      margin: { left: margin, right: margin },
      head,
      body,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [59, 31, 122], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 247, 251] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      // Colore la cellule "Capacité"
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const v = data.cell.raw;
          const color =
            v === 'Surchargé' ? [226, 68, 92] : v === 'Limite' ? [232, 114, 46] : [0, 200, 117];
          data.cell.styles.fillColor = color;
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    doc.save(`charge-equipe-${weekKeys[0]}.pdf`);
  };

  const StatCard = ({ label, value, color }) => (
    <div className="flex min-w-[120px] flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Barre de filtres rapides */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
          <Filter size={15} /> Filtres :
        </span>

        <label className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-600">
          Agent
          <select
            value={agentFilter || ''}
            onChange={(e) => setAgentFilter(e.target.value ? Number(e.target.value) : null)}
            className="cursor-pointer bg-transparent outline-none"
          >
            <option value="">Tous</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setHideDone((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
            hideDone ? 'bg-primary-light text-primary' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {hideDone ? <EyeOff size={15} /> : <Eye size={15} />}
          {hideDone ? 'Tâches « Fait » masquées' : 'Tâches « Fait » affichées'}
        </button>

        {/* Export CSV */}
        <button
          type="button"
          onClick={exportCsv}
          title="Exporter la charge affichée en CSV"
          className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          <FileSpreadsheet size={15} /> CSV
        </button>

        {/* Export PDF */}
        <button
          type="button"
          onClick={exportPdf}
          title="Télécharger la charge affichée en PDF"
          className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          <FileText size={15} /> PDF
        </button>

        {/* Navigation de semaine */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v - 1)}
            title="Semaine précédente"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
              weekOffset === 0
                ? 'bg-primary-light text-primary'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {weekOffset === 0
              ? "Semaine en cours"
              : `Semaine du ${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v + 1)}
            title="Semaine suivante"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Frise */}
      <div className="flex-1 overflow-auto p-6">
        {/* Récapitulatif global */}
        <div className="mb-5 flex flex-wrap gap-3">
          <StatCard label="Agents" value={summary.agents} color="#3b1f7a" />
          <StatCard label="Tâches (semaine)" value={summary.totalTasks} color="#579bfc" />
          <StatCard label="Capacité optimale" value={summary.optimal} color="#00c875" />
          <StatCard label="À la limite" value={summary.atLimit} color="#e8722e" />
          <StatCard label="Surchargés" value={summary.overloaded} color="#e2445c" />
        </div>

        <div className="min-w-[760px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* En-tête : jours */}
          <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <div className="w-56 shrink-0 px-4 py-3">Agent</div>
            {weekDays.map((d, i) => (
              <div
                key={weekKeys[i]}
                className={`flex-1 border-l border-gray-100 px-2 py-3 text-center ${
                  weekKeys[i] === todayKey ? 'bg-primary-light text-primary' : ''
                }`}
              >
                {DAY_LABELS[i]} {d.getDate()}
              </div>
            ))}
            <div className="w-44 shrink-0 border-l border-gray-100 px-3 py-3 text-center">
              Capacité
            </div>
          </div>

          {/* Lignes agents */}
          {visibleUsers.map((u) => {
            const byDay = workload.get(u.id) || {};
            // jour le plus chargé en tâches actives
            const maxActive = weekKeys.reduce((m, k) => {
              const active = (byDay[k] || []).filter(isActive).length;
              return Math.max(m, active);
            }, 0);
            const totalWeek = weekKeys.reduce((s, k) => s + (byDay[k] || []).length, 0);
            const saturated = maxActive > SATURATION_THRESHOLD;
            const warning = maxActive === SATURATION_THRESHOLD; // pile au seuil = orange

            return (
              <div
                key={u.id}
                className={`flex items-stretch border-b border-gray-100 last:border-b-0 ${
                  saturated ? 'bg-red-50' : warning ? 'bg-orange-50/60' : ''
                }`}
              >
                {/* Agent */}
                <div className="flex w-56 shrink-0 items-center gap-2 px-4 py-3">
                  <Avatar name={u.name} src={u.avatar_url} size={32} ring={false} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-800">{u.name}</div>
                    <div className="text-xs text-gray-400">{totalWeek} tâche(s)</div>
                  </div>
                </div>

                {/* Jours */}
                {weekKeys.map((k) => {
                  const dayTasks = byDay[k] || [];
                  const activeCount = dayTasks.filter(isActive).length;
                  const dayOver = activeCount > SATURATION_THRESHOLD;
                  return (
                    <div
                      key={k}
                      className={`flex flex-1 flex-col gap-1 border-l border-gray-100 p-1.5 ${
                        k === todayKey ? 'bg-primary-light/40' : ''
                      }`}
                    >
                      {dayTasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onOpenTask?.(t)}
                          title={`${t.name} — ${t.status} · ouvrir la fiche`}
                          className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium hover:opacity-80"
                          style={{
                            backgroundColor: STATUS_META[t.status]?.bg || '#9aadbd',
                            color: STATUS_META[t.status]?.text || '#fff',
                          }}
                        >
                          {t.name}
                        </button>
                      ))}
                      {dayOver && (
                        <div className="flex items-center justify-center gap-0.5 text-[10px] font-bold text-status-blocked">
                          <AlertTriangle size={11} /> {activeCount}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Indicateur de capacité */}
                <div className="flex w-44 shrink-0 items-center justify-center border-l border-gray-100 px-3 py-3">
                  {saturated ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-status-blocked px-2.5 py-1 text-xs font-semibold text-white">
                      <AlertTriangle size={13} /> Surchargé
                    </span>
                  ) : warning ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-status-progress px-2.5 py-1 text-xs font-semibold text-white">
                      <AlertTriangle size={13} /> Limite
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-status-done px-2.5 py-1 text-xs font-semibold text-white">
                      <CheckCircle2 size={13} /> Capacité optimale
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {visibleUsers.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-400">Aucun agent</div>
          )}
        </div>

        {/* Légende */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-status-done" /> Capacité optimale (≤ {SATURATION_THRESHOLD})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-status-progress" /> Limite ({SATURATION_THRESHOLD} tâches/jour)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-status-blocked" /> Surchargé (&gt; {SATURATION_THRESHOLD}/jour)
          </span>
        </div>
      </div>
    </div>
  );
}
