import { useMemo, useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { TrendingUp, CheckCircle2, X, Download, FileText, Loader2 } from 'lucide-react';
import {
  STATUSES,
  STATUS_META,
  PRIORITIES,
  PRIORITY_META,
  formatShortDate,
} from '../lib/constants.js';

// Page "Tableau de bord et reporting" : donut des statuts, barres cumulées
// par groupe, KPI de complétion, et liste interactive filtrée au clic.
export default function ReportingView({ board, users = [] }) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef(null);

  // Toutes les tâches à plat (avec le nom du groupe)
  const allTasks = useMemo(() => {
    const out = [];
    for (const g of board?.groups || []) {
      for (const t of g.tasks) out.push({ ...t, groupName: g.name, groupColor: g.color });
    }
    return out;
  }, [board]);

  const total = allTasks.length;

  // Répartition par statut
  const statusCounts = useMemo(() => {
    const c = { 'À faire': 0, 'En cours': 0, Fait: 0, Bloqué: 0 };
    for (const t of allTasks) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [allTasks]);

  const donutData = STATUSES.map((s) => ({
    name: s,
    value: statusCounts[s],
    color: STATUS_META[s].bg,
  })).filter((d) => d.value > 0);

  // Avancement par groupe (barres cumulées)
  const groupData = useMemo(
    () =>
      (board?.groups || []).map((g) => {
        const row = { name: g.name };
        for (const s of STATUSES) row[s] = 0;
        for (const t of g.tasks) row[t.status] = (row[t.status] || 0) + 1;
        return row;
      }),
    [board]
  );

  // Répartition par priorité
  const priorityData = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        name: PRIORITY_META[p].label,
        full: p,
        value: allTasks.filter((t) => t.priority === p).length,
        color: PRIORITY_META[p].bg,
      })).filter((d) => d.value > 0),
    [allTasks]
  );

  // Charge active par membre (tâches non terminées assignées)
  const memberData = useMemo(() => {
    const counts = new Map();
    for (const u of users) counts.set(u.id, { name: u.name, active: 0, done: 0 });
    for (const t of allTasks) {
      if (!t.admin) continue;
      const entry = counts.get(t.admin.id);
      if (!entry) continue;
      if (t.status === 'Fait') entry.done += 1;
      else entry.active += 1;
    }
    return [...counts.values()]
      .filter((e) => e.active + e.done > 0)
      .sort((a, b) => b.active - a.active);
  }, [allTasks, users]);

  // Évolution sur 14 jours : tâches créées (par created_at) et complétées
  // cumulées (tâches "Fait" par échéance). Échéance utilisée comme proxy de
  // date de complétion faute d'horodatage dédié.
  const timeData = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    const ymd = (d) => d.toISOString().slice(0, 10);
    const buckets = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({ key: ymd(d), date: d, créées: 0, terminées: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));

    for (const t of allTasks) {
      if (t.created_at) {
        const k = t.created_at.slice(0, 10);
        if (idx.has(k)) buckets[idx.get(k)].créées += 1;
      }
      if (t.status === 'Fait' && t.duedate) {
        const k = t.duedate.slice(0, 10);
        if (idx.has(k)) buckets[idx.get(k)].terminées += 1;
      }
    }

    // Cumul des terminées pour une courbe d'avancement croissante
    let cumulDone = 0;
    return buckets.map((b) => {
      cumulDone += b.terminées;
      return {
        label: b.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        créées: b.créées,
        'terminées (cumul)': cumulDone,
      };
    });
  }, [allTasks]);

  // KPI : taux de complétion
  const doneCount = statusCounts['Fait'] || 0;
  const completion = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const blockedCount = statusCounts['Bloqué'] || 0;

  const filteredTasks = selectedStatus
    ? allTasks.filter((t) => t.status === selectedStatus)
    : [];

  // Export PNG du tableau de bord
  const exportPng = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(dashboardRef.current, {
        backgroundColor: '#faf7fb',
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `pharmaco-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (e) {
      console.error('Export PNG échoué', e);
    } finally {
      setExporting(false);
    }
  };

  // Export PDF : capture le tableau de bord et l'insère dans un PDF A4 paysage.
  const exportPdf = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(dashboardRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;

      // En-tête
      pdf.setFontSize(16);
      pdf.setTextColor(59, 31, 122); // violet PHARMACO
      pdf.text('PHARMACO — Tableau de bord', margin, margin + 6);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} · Complétion ${completion}% · ${total} tâche(s)`,
        margin,
        margin + 22
      );

      // Image, mise à l'échelle pour tenir dans la page
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2 - 34;
      const ratio = Math.min(availW / img.width, availH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      pdf.addImage(dataUrl, 'PNG', margin, margin + 34, w, h);

      pdf.save(`pharmaco-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('Export PDF échoué', e);
    } finally {
      setExporting(false);
    }
  };

  const Card = ({ children, className = '' }) => (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6">
      {/* Barre d'actions */}
      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          PNG
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          Exporter en PDF
        </button>
      </div>

      <div ref={dashboardRef} className="bg-canvas">
      {/* ---- Ligne KPI ---- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-light text-primary">
              <TrendingUp size={22} />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-800">{completion}%</div>
              <div className="text-xs text-gray-500">Taux de complétion</div>
            </div>
          </div>
          {/* Barre de progression */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-status-done transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {doneCount} / {total} tâche(s) terminée(s)
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-wide text-gray-400">Total tâches</div>
          <div className="mt-1 text-3xl font-bold text-gray-800">{total}</div>
          <div className="mt-2 text-xs text-gray-400">{board?.groups?.length || 0} groupe(s)</div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-wide text-gray-400">En cours</div>
          <div className="mt-1 text-3xl font-bold text-status-progress">
            {statusCounts['En cours'] || 0}
          </div>
          <div className="mt-2 text-xs text-gray-400">tâche(s) active(s)</div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-wide text-gray-400">Bloquées</div>
          <div className="mt-1 text-3xl font-bold text-status-blocked">{blockedCount}</div>
          <div className="mt-2 text-xs text-gray-400">à débloquer</div>
        </Card>
      </div>

      {/* ---- Graphiques ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donut des statuts */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Répartition des statuts</h3>
          <p className="mb-3 text-xs text-gray-400">
            Cliquez sur un secteur pour lister les tâches concernées.
          </p>
          {total === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">Aucune tâche</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={2}
                  onClick={(d) =>
                    setSelectedStatus((prev) => (prev === d.name ? null : d.name))
                  }
                >
                  {donutData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.color}
                      stroke={selectedStatus === d.name ? '#3b1f7a' : '#fff'}
                      strokeWidth={selectedStatus === d.name ? 3 : 1}
                      className="cursor-pointer outline-none"
                      opacity={selectedStatus && selectedStatus !== d.name ? 0.45 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Barres cumulées par groupe */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Avancement par groupe</h3>
          <p className="mb-3 text-xs text-gray-400">Nombre de tâches par statut et par groupe.</p>
          {groupData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">Aucun groupe</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={groupData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#676879' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#676879' }} />
                <Tooltip />
                <Legend />
                {STATUSES.map((s) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    stackId="a"
                    fill={STATUS_META[s].bg}
                    radius={s === 'Bloqué' ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ---- 2e rangée : priorité + charge par membre ---- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Répartition par priorité */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Répartition par priorité</h3>
          <p className="mb-3 text-xs text-gray-400">Nombre de tâches par niveau de priorité.</p>
          {priorityData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">Aucune tâche</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="full"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {priorityData.map((d) => (
                    <Cell key={d.full} fill={d.color} stroke="#fff" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Charge par membre */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Charge par membre</h3>
          <p className="mb-3 text-xs text-gray-400">Tâches actives vs terminées par agent.</p>
          {memberData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">Aucune assignation</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={memberData}
                margin={{ top: 8, right: 16, left: 24, bottom: 0 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#676879' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12, fill: '#676879' }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="active" name="Actives" stackId="m" fill="#e8722e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="done" name="Terminées" stackId="m" fill="#00c875" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ---- 3e rangée : évolution dans le temps ---- */}
      <Card className="mt-6">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Évolution (14 derniers jours)</h3>
        <p className="mb-3 text-xs text-gray-400">
          Tâches créées par jour et progression cumulée des tâches terminées.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={timeData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#676879' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#676879' }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="créées"
              stroke="#579bfc"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="terminées (cumul)"
              stroke="#00c875"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      </div>
      {/* fin de la zone exportée (dashboardRef) */}

      {/* ---- Liste interactive (filtrée par clic sur le donut) ---- */}
      {selectedStatus && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              Tâches au statut
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: STATUS_META[selectedStatus].bg }}
              >
                {selectedStatus}
              </span>
              <span className="text-gray-400">({filteredTasks.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setSelectedStatus(null)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              <X size={14} /> Effacer le filtre
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Aucune tâche</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <CheckCircle2
                    size={15}
                    className={t.status === 'Fait' ? 'text-status-done' : 'text-gray-300'}
                  />
                  <span className="flex-1 truncate text-sm text-gray-800">{t.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: PRIORITY_META[t.priority]?.bg || '#579bfc' }}
                  >
                    {PRIORITY_META[t.priority]?.label || 'P3'}
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: t.groupColor }}
                  >
                    {t.groupName}
                  </span>
                  {t.admin && (
                    <span className="text-xs text-gray-500">{t.admin.name}</span>
                  )}
                  <span className="w-16 text-right text-xs text-gray-400">
                    {formatShortDate(t.duedate) || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
