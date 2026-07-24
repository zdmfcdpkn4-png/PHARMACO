import { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { textColorFor } from '../lib/constants.js';

// Palette de couleurs proposée (charte CHD + teintes complémentaires).
export const PROJECT_COLORS = [
  '#005586', // bleu CHD
  '#e82a63', // rose CHD
  '#46b4b3', // teal CHD
  '#f4c137', // jaune CHD
  '#7b5cd6', // violet
  '#00a35c', // vert
  '#e8722e', // orange
  '#3a7bd5', // bleu clair
  '#d63a4f', // rouge
  '#5b6b7b', // ardoise
];

// Émojis proposés comme vignette de projet.
export const PROJECT_ICONS = [
  '📋', '📦', '🧪', '💊', '🏥', '📊', '🔬', '🩺',
  '🧬', '⚗️', '🗂️', '✅', '📈', '🧴', '🚚', '🧾',
];

// Modale de création / personnalisation d'un projet : nom, couleur, vignette.
export default function ProjectModal({ mode = 'create', project = null, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(project?.name || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  const [icon, setIcon] = useState(project?.icon || PROJECT_ICONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), color, icon });
      onClose();
    } catch (err) {
      setError(err.message || "Échec de l'enregistrement");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl animate-[fadeIn_.15s_ease-out]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Personnaliser le projet' : 'Nouveau projet'}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit}>
          {/* Aperçu de la vignette */}
          <div className="mb-4 flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow"
              style={{ backgroundColor: color, color: textColorFor(color) }}
            >
              {icon || (name || '?').charAt(0).toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">Aperçu de la vignette</span>
          </div>

          <label className="mb-1 block text-xs font-medium text-gray-500">Nom du projet</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du projet"
            required
            className="mb-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <label className="mb-1 block text-xs font-medium text-gray-500">Couleur</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                title={c}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                  color === c ? 'border-gray-800' : 'border-transparent hover:border-gray-300'
                }`}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check size={15} className="text-white" />}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs font-medium text-gray-500">Vignette</label>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setIcon('')}
              title="Initiale du nom"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold text-gray-600 transition ${
                !icon ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 hover:bg-gray-100'
              }`}
            >
              {(name || '?').charAt(0).toUpperCase()}
            </button>
            {PROJECT_ICONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setIcon(em)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                  icon === em ? 'border-primary bg-primary-light' : 'border-gray-200 hover:bg-gray-100'
                }`}
              >
                {em}
              </button>
            ))}
          </div>

          {error && <p className="mb-2 text-sm text-status-blocked">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
