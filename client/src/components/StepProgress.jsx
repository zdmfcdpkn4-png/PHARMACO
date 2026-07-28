import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Flag, MapPin, RotateCcw, X } from 'lucide-react';
import { pastel } from './TagCell.jsx';
import {
  childSteps,
  completedStepIds,
  flattenSteps,
  indexSteps,
  progressEntry,
  rootSteps,
  stepCounts,
  stepPathLabel,
  stepState,
} from '../lib/steps.js';
import { formatShortDate } from '../lib/constants.js';

// Couleurs d'état, alignées sur la charte (design.tokens.js).
const COULEUR_FRANCHI = '#46b4b3'; // status-done
const COULEUR_COURANT = '#005586'; // primary
const COULEUR_A_VENIR = '#e5e7eb'; // gray-200

/**
 * Visualisation de la position d'une tâche dans le circuit d'intervention.
 *
 * - variant="compact" : frise d'une ligne (cellule de tableau, carte mobile).
 * - variant="detail"  : arbre déroulant complet (fiche de tâche).
 *
 * `steps` est la liste plate du projet (board.steps) ; `progress` la liste
 * plate des franchissements (board.stepProgress), filtrée ici sur la tâche.
 */
export default function StepProgress({
  steps = [],
  taskId,
  currentStepId = null,
  progress = [],
  phaseName = null,
  variant = 'compact',
  canEdit = false,
  onSelectStep,
  onToggleStep,
}) {
  const parcours = flattenSteps(steps);
  const completed = completedStepIds(progress, taskId);
  const { done, total, pct } = stepCounts(steps, completed);

  if (!total) return variant === 'compact' ? <span className="text-xs text-gray-300">—</span> : null;

  return variant === 'compact' ? (
    <FriseCompacte
      steps={steps}
      parcours={parcours}
      completed={completed}
      currentStepId={currentStepId}
      done={done}
      total={total}
      canEdit={canEdit}
      onSelectStep={onSelectStep}
    />
  ) : (
    <ArbreDetaille
      steps={steps}
      completed={completed}
      currentStepId={currentStepId}
      progress={progress}
      taskId={taskId}
      phaseName={phaseName}
      done={done}
      total={total}
      pct={pct}
      canEdit={canEdit}
      onSelectStep={onSelectStep}
      onToggleStep={onToggleStep}
    />
  );
}

// ---------------------------------------------------------------------------
//  Variante compacte : pastilles reliées + compteur, avec sélecteur optionnel.
// ---------------------------------------------------------------------------
function FriseCompacte({
  steps,
  parcours,
  completed,
  currentStepId,
  done,
  total,
  canEdit,
  onSelectStep,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Au-delà de 7 pastilles, on centre une fenêtre sur l'étape courante pour
  // que la frise reste lisible dans une colonne redimensionnable.
  const MAX = 7;
  let visibles = parcours;
  if (parcours.length > MAX) {
    const i = Math.max(0, parcours.findIndex((s) => s.id === currentStepId));
    const debut = Math.min(Math.max(0, i - 2), parcours.length - MAX);
    visibles = parcours.slice(debut, debut + MAX);
  }

  const selectionnable = canEdit && typeof onSelectStep === 'function';
  const titre = currentStepId
    ? stepPathLabel(steps, currentStepId)
    : 'Aucune étape définie';

  const frise = (
    <span className="flex min-w-0 items-center gap-1">
      {visibles.map((s) => {
        const etat = stepState(s, { currentStepId, completed });
        const couleur =
          etat === 'franchi'
            ? COULEUR_FRANCHI
            : etat === 'en-cours'
            ? COULEUR_COURANT
            : COULEUR_A_VENIR;
        return (
          <span
            key={s.id}
            title={`${s.name} — ${etat === 'franchi' ? 'franchie' : etat === 'en-cours' ? 'en cours' : 'à venir'}`}
            className={`h-2 rounded-full ${s.depth === 1 ? 'w-2' : 'w-3.5'} ${
              etat === 'en-cours' ? 'ring-2 ring-primary/30' : ''
            }`}
            style={{ backgroundColor: couleur }}
          />
        );
      })}
      <span className="ml-1 shrink-0 text-[10px] text-gray-400">
        {done}/{total}
      </span>
    </span>
  );

  if (!selectionnable) {
    return (
      <span className="flex min-w-0 items-center justify-center truncate" title={titre}>
        {frise}
      </span>
    );
  }

  return (
    <div className="relative flex min-w-0 items-center justify-center" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={titre}
        className="flex min-w-0 items-center rounded px-1 py-1 hover:bg-gray-100"
      >
        {frise}
      </button>
      {open && (
        <SelecteurEtape
          steps={steps}
          currentStepId={currentStepId}
          completed={completed}
          onSelect={(id) => {
            onSelectStep(id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Popover de choix de l'étape courante (même structure que TagCell).
function SelecteurEtape({ steps, currentStepId, completed, onSelect }) {
  return (
    <div className="absolute left-1/2 top-full z-30 mt-1 max-h-64 w-60 -translate-x-1/2 overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase text-gray-400">
        Étape courante
      </div>
      {flattenSteps(steps).map((s) => {
        const c = pastel(s.color);
        const actif = s.id === currentStepId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(actif ? null : s.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:opacity-90 ${
              s.depth === 1 ? 'pl-5' : ''
            }`}
            style={{ backgroundColor: actif ? c.bg : 'transparent', color: c.text }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {completed.has(s.id) && <Check size={13} className="shrink-0 text-status-done" />}
            {actif && <MapPin size={13} className="shrink-0" />}
          </button>
        );
      })}
      {currentStepId != null && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100"
        >
          <X size={12} /> Retirer l'étape
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Variante détaillée : arbre Phase > Étape > Sous-étape, avec franchissement.
// ---------------------------------------------------------------------------
function ArbreDetaille({
  steps,
  completed,
  currentStepId,
  progress,
  taskId,
  phaseName,
  done,
  total,
  pct,
  canEdit,
  onSelectStep,
  onToggleStep,
}) {
  const map = indexSteps(steps);
  // L'étape courante est dépliée d'office ; les autres suivent le clic.
  const racineCourante =
    currentStepId != null
      ? map.get(currentStepId)?.parent_id ?? currentStepId
      : null;
  const [ouverts, setOuverts] = useState(() =>
    racineCourante != null ? { [racineCourante]: true } : {}
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      {/* En-tête : phase courante + avancement */}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-gray-400">
          {phaseName || 'Circuit'}
        </span>
        <span className="shrink-0 text-[11px] text-gray-500">
          {done}/{total} étape(s) franchie(s)
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-status-done transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-0.5">
        {rootSteps(steps).map((racine, i) => {
          const enfants = childSteps(steps, racine.id);
          const ouvert = !!ouverts[racine.id];
          return (
            <li key={racine.id}>
              <LigneEtape
                step={racine}
                numero={i + 1}
                etat={stepState(racine, { currentStepId, completed })}
                entree={progressEntry(progress, taskId, racine.id)}
                canEdit={canEdit}
                pliable={enfants.length > 0}
                ouvert={ouvert}
                onTogglePli={() => setOuverts((o) => ({ ...o, [racine.id]: !o[racine.id] }))}
                onSelectStep={onSelectStep}
                onToggleStep={onToggleStep}
              />
              {ouvert && enfants.length > 0 && (
                <ul className="ml-4 border-l border-gray-200 pl-2">
                  {enfants.map((enfant) => (
                    <li key={enfant.id}>
                      <LigneEtape
                        step={enfant}
                        etat={stepState(enfant, { currentStepId, completed })}
                        entree={progressEntry(progress, taskId, enfant.id)}
                        canEdit={canEdit}
                        onSelectStep={onSelectStep}
                        onToggleStep={onToggleStep}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LigneEtape({
  step,
  numero = null,
  etat,
  entree,
  canEdit,
  pliable = false,
  ouvert = false,
  onTogglePli,
  onSelectStep,
  onToggleStep,
}) {
  const franchi = etat === 'franchi';
  const courant = etat === 'en-cours';
  return (
    <div
      className={`group/etape flex items-center gap-1.5 rounded-md px-1 py-1 ${
        courant ? 'bg-primary-light' : 'hover:bg-gray-100'
      }`}
    >
      {pliable ? (
        <button
          type="button"
          onClick={onTogglePli}
          title={ouvert ? 'Replier les sous-étapes' : 'Déplier les sous-étapes'}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200"
        >
          {ouvert ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      ) : (
        <span className="w-[19px] shrink-0" />
      )}

      {/* Pastille d'état */}
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          courant ? 'ring-2 ring-primary/30' : ''
        }`}
        style={{
          backgroundColor: franchi
            ? COULEUR_FRANCHI
            : courant
            ? COULEUR_COURANT
            : COULEUR_A_VENIR,
          color: franchi || courant ? '#fff' : '#6b7280',
        }}
      >
        {franchi ? <Check size={11} /> : numero ?? '·'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-gray-700">{step.name}</span>
          {step.is_terminal && (
            <Flag size={11} className="shrink-0 text-brand-teal" title="Fin de parcours" />
          )}
        </div>
        {entree && (
          <div className="truncate text-[11px] text-gray-400">
            Franchie le {formatShortDate(entree.completed_at) || '—'}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/etape:opacity-100">
          {!courant && onSelectStep && (
            <button
              type="button"
              onClick={() => onSelectStep(step.id)}
              title="Définir comme étape courante"
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-primary"
            >
              <MapPin size={13} />
            </button>
          )}
          {onToggleStep && (
            <button
              type="button"
              onClick={() => onToggleStep(step.id, !franchi)}
              title={franchi ? 'Annuler le franchissement' : "Marquer l'étape franchie"}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-status-done"
            >
              {franchi ? <RotateCcw size={13} /> : <Check size={13} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
