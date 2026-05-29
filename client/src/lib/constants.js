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
