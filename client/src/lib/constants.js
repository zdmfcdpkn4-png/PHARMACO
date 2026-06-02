// Référentiel des statuts : libellé, couleur de fond, et clé.
// Les couleurs correspondent à la palette Monday.com.
export const STATUSES = ['À faire', 'En cours', 'Fait', 'Bloqué'];

// Couleurs alignées sur la charte CHD (bleu #005586, rose #E82A63,
// teal #46B4B3, jaune #F4C137). `text` garantit la lisibilité (texte foncé
// sur le jaune clair).
export const STATUS_META = {
  'À faire': { label: 'À faire', bg: '#9aadbd', text: '#ffffff' }, // gris bleuté
  'En cours': { label: 'En cours', bg: '#f4c137', text: '#4a3a00' }, // jaune CHD
  Fait: { label: 'Fait', bg: '#46b4b3', text: '#ffffff' }, // teal CHD
  Bloqué: { label: 'Bloqué', bg: '#e82a63', text: '#ffffff' }, // rose CHD
};

// Référentiel des priorités : libellé court, couleur, et ordre de tri.
export const PRIORITIES = ['P1 - Urgent', 'P2 - Élevé', 'P3 - Normal'];

export const PRIORITY_META = {
  'P1 - Urgent': { label: 'P1', full: 'Urgent', bg: '#e82a63', text: '#ffffff', order: 0 }, // rose CHD
  'P2 - Élevé': { label: 'P2', full: 'Élevé', bg: '#f4c137', text: '#4a3a00', order: 1 }, // jaune CHD
  'P3 - Normal': { label: 'P3', full: 'Normal', bg: '#005586', text: '#ffffff', order: 2 }, // bleu CHD
};

// Palette de couleurs proposée pour les groupes.
export const GROUP_COLORS = [
  '#579bfc',
  '#00c875',
  '#fdab3d',
  '#e2445c',
  '#a25ddc',
  '#037f4c',
  '#ff642e',
  '#9aadbd',
];

// Formatte une date ISO (YYYY-MM-DD) en libellé court "mai 28".
export function formatShortDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}

// ---- Helpers de dates pour le Gantt ----
// Convertit une date (Date|string) en clé YYYY-MM-DD locale.
export function toYmd(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse une clé YYYY-MM-DD en Date locale (minuit).
export function parseYmd(s) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Nombre de jours (entiers) entre deux dates YYYY-MM-DD (b - a).
export function daysBetween(a, b) {
  const da = parseYmd(a);
  const db = parseYmd(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
}

// Ajoute n jours à une clé YYYY-MM-DD et renvoie une clé.
export function addDays(s, n) {
  const d = parseYmd(s);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

// Palette utilisée pour colorer les pastilles d'avatar (initiales).
export const AVATAR_COLORS = [
  '#0073ea',
  '#00c875',
  '#a25ddc',
  '#ff642e',
  '#e2445c',
  '#037f4c',
  '#9d50dd',
  '#fdab3d',
];

// Extrait jusqu'à 2 initiales d'un nom ("Erwin Raingeard" -> "ER").
export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Couleur déterministe à partir d'une chaîne (même nom -> même couleur).
export function colorFromString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
