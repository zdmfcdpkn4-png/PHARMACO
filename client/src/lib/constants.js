// Référentiel des statuts : libellé, couleur de fond, et clé.
// Les couleurs correspondent à la palette Monday.com.
export const STATUSES = ['À faire', 'En cours', 'Fait', 'Bloqué'];

export const STATUS_META = {
  'À faire': { label: 'À faire', bg: '#c4c4c4', text: '#ffffff' },
  'En cours': { label: 'En cours', bg: '#fdab3d', text: '#ffffff' },
  Fait: { label: 'Fait', bg: '#00c875', text: '#ffffff' },
  Bloqué: { label: 'Bloqué', bg: '#e2445c', text: '#ffffff' },
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
