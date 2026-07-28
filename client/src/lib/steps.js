// Helpers du circuit d'intervention.
//
// Le serveur renvoie `board.steps` sous forme de LISTE PLATE ordonnée
// (position, id) : une étape a `parent_id === null`, une sous-étape porte
// l'id de son étape. La profondeur est donc déduite, jamais stockée.
//
// Le circuit compte TROIS niveaux : étape › sous-étape › sous-sous-étape.
// La profondeur est bornée par le serveur (steps.controller.js), mais toutes
// les fonctions ci-dessous s'arrêtent d'elles-mêmes en cas de donnée
// aberrante (cycle) : elles ne doivent jamais figer l'interface.
//
// Ces fonctions sont la source unique de l'ordre du parcours : elles servent
// à la fois au stepper, au regroupement en accordéon et aux compteurs.

// Profondeur maximale autorisée, en index (0 = étape, 2 = sous-sous-étape).
export const PROFONDEUR_MAX = 2;

// Étapes de premier niveau, triées.
export function rootSteps(steps = []) {
  return steps
    .filter((s) => s.parent_id == null)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

// Sous-étapes directes d'une étape donnée, triées.
export function childSteps(steps = [], parentId) {
  if (parentId == null) return [];
  return steps
    .filter((s) => s.parent_id === parentId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

// Parcours complet à plat, dans l'ordre de lecture, avec la profondeur.
// -> [{ ...step, depth: 0 | 1 | 2 }]
export function flattenSteps(steps = []) {
  const out = [];
  const vus = new Set(); // garde-fou : une étape n'est visitée qu'une fois
  const descendre = (liste, depth) => {
    for (const s of liste) {
      if (vus.has(s.id)) continue;
      vus.add(s.id);
      out.push({ ...s, depth });
      descendre(childSteps(steps, s.id), depth + 1);
    }
  };
  descendre(rootSteps(steps), 0);
  return out;
}

// Index id -> étape, pour les résolutions ponctuelles.
export function indexSteps(steps = []) {
  const map = new Map();
  for (const s of steps) map.set(s.id, s);
  return map;
}

// Chaîne des ancêtres, de la racine jusqu'à l'étape elle-même (incluse).
// -> [racine, …, étape]. Tableau vide si l'étape est inconnue.
export function stepPath(steps = [], stepId) {
  if (stepId == null) return [];
  const map = indexSteps(steps);
  const chaine = [];
  const vus = new Set();
  let courant = map.get(stepId);
  while (courant && !vus.has(courant.id)) {
    vus.add(courant.id);
    chaine.unshift(courant);
    courant = courant.parent_id == null ? null : map.get(courant.parent_id);
  }
  return chaine;
}

// Profondeur d'une étape : 0 pour une étape de premier niveau.
export function stepDepth(steps = [], stepId) {
  const chaine = stepPath(steps, stepId);
  return chaine.length ? chaine.length - 1 : 0;
}

// Étape de premier niveau dont dépend une étape (elle-même si c'en est une).
// C'est la clé de regroupement de l'accordéon : elle remonte TOUTE la chaîne,
// pas seulement d'un cran — sans quoi une sous-sous-étape serait rattachée à
// sa sous-étape et non à son étape racine.
export function rootStepOf(steps = [], stepId) {
  const chaine = stepPath(steps, stepId);
  return chaine[0] || null;
}

// Libellé hiérarchique complet : « Production › Conditionnement › Étiquetage ».
export function stepPathLabel(steps = [], stepId) {
  return stepPath(steps, stepId)
    .map((s) => s.name)
    .join(' › ');
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
