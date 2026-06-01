import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  User,
  Filter,
  ArrowUpDown,
  EyeOff,
  Eye,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react';
import { STATUSES } from '../lib/constants.js';

// En-tête du tableau : titre éditable + barre d'outils.
export default function BoardHeader({
  title,
  onRenameBoard,
  search,
  onSearch,
  personFilter,
  onPersonFilter,
  statusFilter,
  onStatusFilter,
  users,
  onAddTaskClick,
  sortBy,
  onToggleSort,
  showDone,
  onToggleShowDone,
  onExportCsv,
  onExportPdf,
  onPrint,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [exportOpen]);

  return (
    <div className="no-print border-b border-gray-200 bg-white px-6 pt-4">
      {/* Titre */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const n = draft.trim();
            if (n && n !== title) onRenameBoard(n);
            else setDraft(title);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="mb-3 rounded border border-primary px-2 py-1 text-2xl font-bold text-gray-800 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800 hover:text-primary"
        >
          {title}
          <ChevronDown size={18} className="text-gray-400" />
        </button>
      )}

      {/* Barre d'outils */}
      <div className="no-print flex flex-wrap items-center gap-1 pb-3">
        <button
          type="button"
          onClick={onAddTaskClick}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover"
        >
          <Plus size={16} /> Ajouter tâche
        </button>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        {/* Recherche */}
        <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Rechercher"
            className="w-28 bg-transparent outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Filtre personne */}
        <label
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
            personFilter ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <User size={16} />
          <select
            value={personFilter || ''}
            onChange={(e) => onPersonFilter(e.target.value ? Number(e.target.value) : null)}
            className="cursor-pointer bg-transparent outline-none"
          >
            <option value="">Personne</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        {/* Filtre statut */}
        <label
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
            statusFilter ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Filter size={16} />
          <select
            value={statusFilter || ''}
            onChange={(e) => onStatusFilter(e.target.value || null)}
            className="cursor-pointer bg-transparent outline-none"
          >
            <option value="">Filtre</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {/* Trier */}
        <button
          type="button"
          onClick={onToggleSort}
          title="Trier par nom / statut / échéance"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
            sortBy ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArrowUpDown size={16} />
          {sortBy ? `Trié : ${sortBy}` : 'Trier'}
        </button>

        {/* Masquer (tâches terminées) */}
        <button
          type="button"
          onClick={onToggleShowDone}
          title="Masquer / afficher les tâches terminées"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
            !showDone ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {showDone ? <EyeOff size={16} /> : <Eye size={16} />}
          {showDone ? 'Masquer' : 'Masqué'}
        </button>

        {/* Exporter (menu déroulant) */}
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
              exportOpen ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Download size={16} /> Exporter
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExportCsv?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <FileSpreadsheet size={16} className="text-status-done" /> Exporter en CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <FileText size={16} className="text-status-blocked" /> Télécharger en PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onPrint?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <Printer size={16} className="text-primary" /> Imprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
