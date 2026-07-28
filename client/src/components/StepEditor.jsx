import { useState } from 'react';
import { ChevronDown, ChevronUp, Flag, Plus, Route, Trash2 } from 'lucide-react';
import { PROFONDEUR_MAX, childSteps, rootSteps } from '../lib/steps.js';

// Palette de la charte CHD (design.tokens.js) — volontairement différente de
// celle de TagConfig, qui a hérité des couleurs Monday.
const COULEURS = ['#005586', '#46b4b3', '#f4c137', '#e82a63', '#9aadbd', '#00415f'];

// Libellé du bouton d'ajout selon le niveau de l'enfant à créer.
const LIBELLE_AJOUT = ['Ajouter une étape', 'Ajouter une sous-étape', 'Ajouter une sous-sous-étape'];

/**
 * Configuration du circuit d'intervention d'un projet : étapes ordonnées et
 * leur descendance, sur TROIS niveaux (étape › sous-étape › sous-sous-étape).
 * La profondeur maximale est celle du serveur, via `PROFONDEUR_MAX`.
 */
export default function StepEditor({
  steps = [],
  canManage = true,
  canDelete = false,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}) {
  const racines = rootSteps(steps);

  // Déplace une étape parmi ses frères et sœurs et renvoie le lot au parent.
  const deplacer = (liste, index, sens) => {
    const cible = index + sens;
    if (cible < 0 || cible >= liste.length) return;
    const ordre = [...liste];
    [ordre[index], ordre[cible]] = [ordre[cible], ordre[index]];
    onReorder?.(
      ordre.map((s, i) => ({ id: s.id, parent_id: s.parent_id ?? null, position: i }))
    );
  };

  // Rendu récursif de la descendance d'une étape. `depth` est le niveau des
  // ENFANTS rendus (1 = sous-étape, 2 = sous-sous-étape) : au-delà de
  // PROFONDEUR_MAX, on ne propose plus d'ajout — c'est la limite du serveur.
  const rendreEnfants = (parent, depth) => {
    if (depth > PROFONDEUR_MAX) return null;
    const enfants = childSteps(steps, parent.id);
    return (
      <ul className="ml-3 border-l border-gray-200 pl-2">
        {enfants.map((enfant, j) => (
          <li key={enfant.id}>
            <LigneEditable
              step={enfant}
              canManage={canManage}
              canDelete={canDelete}
              premier={j === 0}
              dernier={j === enfants.length - 1}
              onMonter={() => deplacer(enfants, j, -1)}
              onDescendre={() => deplacer(enfants, j, 1)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
            {rendreEnfants(enfant, depth + 1)}
          </li>
        ))}
        {canManage && (
          <li>
            <FormulaireAjout
              libelle={LIBELLE_AJOUT[depth]}
              parentId={parent.id}
              onCreate={onCreate}
            />
          </li>
        )}
      </ul>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <Route size={13} /> Circuit d'intervention
      </div>

      {racines.length === 0 && (
        <p className="px-1 text-xs text-gray-400">
          Aucune étape. Définissez l'enchaînement du circuit ci-dessous.
        </p>
      )}

      <ul className="space-y-1">
        {racines.map((etape, i) => (
          <li key={etape.id}>
            <LigneEditable
              step={etape}
              canManage={canManage}
              canDelete={canDelete}
              premier={i === 0}
              dernier={i === racines.length - 1}
              onMonter={() => deplacer(racines, i, -1)}
              onDescendre={() => deplacer(racines, i, 1)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
            {rendreEnfants(etape, 1)}
          </li>
        ))}
      </ul>

      {canManage && (
        <FormulaireAjout libelle={LIBELLE_AJOUT[0]} parentId={null} onCreate={onCreate} />
      )}
    </div>
  );
}

function LigneEditable({
  step,
  canManage,
  canDelete,
  premier,
  dernier,
  onMonter,
  onDescendre,
  onUpdate,
  onDelete,
}) {
  const [nom, setNom] = useState(step.name);
  const [edition, setEdition] = useState(false);

  const valider = () => {
    setEdition(false);
    const n = nom.trim();
    if (n && n !== step.name) onUpdate?.(step.id, { name: n });
    else setNom(step.name);
  };

  return (
    <div className="group/step flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-gray-100">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: step.color }}
      />

      {edition && canManage ? (
        <input
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setNom(step.name);
              setEdition(false);
            }
          }}
          className="min-w-0 flex-1 rounded border border-primary px-1.5 py-0.5 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => canManage && setEdition(true)}
          className="min-w-0 flex-1 truncate text-left text-sm text-gray-700"
        >
          {step.name}
        </button>
      )}

      {step.is_terminal && (
        <Flag size={12} className="shrink-0 text-brand-teal" title="Fin de parcours" />
      )}

      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/step:opacity-100">
          <button
            type="button"
            disabled={premier}
            onClick={onMonter}
            title="Monter"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            disabled={dernier}
            onClick={onDescendre}
            title="Descendre"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
          >
            <ChevronDown size={13} />
          </button>
          <button
            type="button"
            onClick={() => onUpdate?.(step.id, { is_terminal: !step.is_terminal })}
            title={step.is_terminal ? 'Ne plus marquer comme fin de parcours' : 'Marquer comme fin de parcours'}
            className={`rounded p-0.5 hover:bg-gray-200 ${
              step.is_terminal ? 'text-brand-teal' : 'text-gray-400'
            }`}
          >
            <Flag size={13} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete?.(step.id)}
              title="Supprimer l'étape (admin)"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-status-blocked"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormulaireAjout({ libelle, parentId, onCreate }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [couleur, setCouleur] = useState(COULEURS[0]);

  const valider = () => {
    const n = nom.trim();
    if (n) onCreate?.(n, couleur, parentId);
    setNom('');
    setOuvert(false);
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-1 flex w-full items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-primary hover:text-primary"
      >
        <Plus size={13} /> {libelle}
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-md border border-gray-200 p-1.5">
      <input
        autoFocus
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') valider();
          if (e.key === 'Escape') setOuvert(false);
        }}
        placeholder="Nom de l'étape…"
        className="mb-1.5 w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
      />
      <div className="mb-1.5 flex flex-wrap gap-1">
        {COULEURS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCouleur(c)}
            className={`h-5 w-5 rounded-full ${
              couleur === c ? 'ring-2 ring-gray-400 ring-offset-1' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={valider}
          disabled={!nom.trim()}
          className="flex-1 rounded-md bg-primary py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Créer
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
