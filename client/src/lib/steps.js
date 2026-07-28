// Helpers du circuit d'intervention.
//
// Le serveur renvoie `board.steps` sous forme de LISTE PLATE ordonnée
// (position, id) : une étape a `parent_id === null`, une sous-étape porte
// l'id de son étape. La profondeur est donc déduite, jamais stockée.
//
// Ces fonctions sont la source unique de l'ordre du parcours : elles servent
// à la fois au stepper, au regroupement en accordéon et aux compteurs.

// Étapes de premier niveau, triées.
export function rootSteps(steps = []) {
  return steps
    .filter((s) => s.parent_id == null)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

// Sous-étapes d'une étape donnée, triées.
export function childSteps(steps = [], parentId) {
  if (parentId == null) return [];
  return steps
    .filter((s) => s.parent_id === parentId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

// Parcours complet à plat, dans l'ordre de lecture, avec la profondeur.
// -> [{ ...step, depth: 0 | 1 }]
export function flattenSteps(steps = []) {
  const out = [];
  for (const racine of rootSteps(steps)) {
    out.push({ ...racine, depth: 0 });
    for (const enfant of childSteps(steps, racine.id)) {
      out.push({ ...enfant, depth: 1 });
    }
  }
  return out;
}

// Index id -> étape, pour les résolutions ponctuelles.
export function indexSteps(steps = []) {
  const map = new Map();
  for (const s of steps) map.set(s.id, s);
  return map;
}

// Étape de premier niveau dont dépend une étape (elle-même si c'en est une).
// C'est la clé de regroupement de l'accordéon.
export function rootStepOf(steps = [], stepId) {
  if (stepId == null) return null;
  const map = indexSteps(steps);
  const step = map.get(stepId);
  if (!step) return null;
  return step.parent_id == null ? step : map.get(step.parent_id) || null;
}

// Libellé hiérarchique : « Production › Logistique ».
export function stepPathLabel(steps = [], stepId) {
  if (stepId == null) return '';
  const map = indexSteps(steps);
  const step = map.get(stepId);
  if (!step) return '';
  const parent = step.parent_id == null ? null : map.get(step.parent_id);
  return parent ? `${parent.name} › ${step.name}` : step.name;
}

// Identifiants des étapes franchies par une tâche.
export function completedStepIds(stepProgress = [], taskId) {
  const ids = new Set();
  for (const p of stepProgress) {
    if (p.task_id === taskId && p.completed_at) ids.add(p.step_id);
  }
  return ids;
}

// Ligne de franchissement d'un couple (tâche, étape), ou null.
export function progressEntry(stepProgress = [], taskId, stepId) {
  return (
    stepProgress.find((p) => p.task_id === taskId && p.step_id === stepId && p.completed_at) || null
  );
}

// État d'une étape vis-à-vis d'une tâche : franchie, courante, ou à venir.
export function stepState(step, { currentStepId, completed }) {
  if (completed.has(step.id)) return 'franchi';
  if (step.id === currentStepId) return 'en-cours';
  return 'a-venir';
}

// Avancement global d'une tâche sur le circuit.
export function stepCounts(steps = [], completed = new Set()) {
  const parcours = flattenSteps(steps);
  const total = parcours.length;
  const done = parcours.filter((s) => completed.has(s.id)).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
