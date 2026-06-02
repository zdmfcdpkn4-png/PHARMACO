import {
  Pill,
  Plus,
  FlaskConical,
  Stethoscope,
  Syringe,
  Leaf,
  HeartPulse,
  Microscope,
} from 'lucide-react';
import { getInitials } from '../lib/constants.js';

// Avatars inspirés du logo floral PHARMACO, déclinés dans la charte CHD.
// Chaque preset = une couronne de pétales + un cœur coloré portant soit les
// initiales de l'agent, soit un motif (icône). Stockés via avatar_url :
//   "pharmaco:<paletteIndex>"            -> initiales au centre
//   "pharmaco:<paletteIndex>:<iconKey>"  -> icône au centre
export const AVATAR_PRESETS = [
  { petals: ['#005586', '#3b7ba5', '#005586', '#3b7ba5'], core: '#005586', ring: '#e1edf3' }, // bleu CHD
  { petals: ['#e82a63', '#f06a90', '#e82a63', '#f06a90'], core: '#e82a63', ring: '#fbe1e9' }, // rose CHD
  { petals: ['#46b4b3', '#7ccbca', '#46b4b3', '#7ccbca'], core: '#2f8f8e', ring: '#e2f3f3' }, // teal CHD
  { petals: ['#f4c137', '#f7d570', '#f4c137', '#f7d570'], core: '#c9962a', ring: '#fdf3d9' }, // jaune CHD
  { petals: ['#005586', '#e82a63', '#005586', '#e82a63'], core: '#005586', ring: '#e6edf2' }, // bleu + rose
  { petals: ['#46b4b3', '#f4c137', '#46b4b3', '#f4c137'], core: '#2f8f8e', ring: '#eaf4ed' }, // teal + jaune
  { petals: ['#005586', '#e82a63', '#46b4b3', '#f4c137'], core: '#005586', ring: '#eef2f5' }, // multicolore (logo)
  { petals: ['#e82a63', '#f4c137', '#46b4b3', '#005586'], core: '#e82a63', ring: '#fbe9ea' }, // multicolore 2
];

export const AVATAR_PRESET_COUNT = AVATAR_PRESETS.length;

// Motifs disponibles au centre (thème pharmacie / santé).
export const AVATAR_ICONS = {
  pill: Pill,
  cross: Plus,
  flask: FlaskConical,
  stetho: Stethoscope,
  syringe: Syringe,
  leaf: Leaf,
  heart: HeartPulse,
  micro: Microscope,
};
export const AVATAR_ICON_KEYS = Object.keys(AVATAR_ICONS);

// Vrai si avatar_url désigne un avatar PHARMACO généré.
export const isPharmacoAvatar = (src) => typeof src === 'string' && src.startsWith('pharmaco:');
export const pharmacoVariant = (src) => {
  if (!isPharmacoAvatar(src)) return 0;
  return Number(src.slice('pharmaco:'.length).split(':')[0]) || 0;
};
export const pharmacoIcon = (src) => {
  if (!isPharmacoAvatar(src)) return null;
  return src.slice('pharmaco:'.length).split(':')[1] || null;
};

export default function PharmacoAvatar({ variant = 0, icon = null, name = '', size = 32, ring = true }) {
  const preset = AVATAR_PRESETS[variant % AVATAR_PRESETS.length];
  const Icon = icon ? AVATAR_ICONS[icon] : null;
  const petals = Array.from({ length: 12 }, (_, i) => ({
    angle: (i * 360) / 12,
    color: preset.petals[i % preset.petals.length],
  }));
  const ringClass = ring ? 'ring-2 ring-white' : '';

  return (
    <span
      title={name}
      aria-label={name}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${ringClass}`}
      style={{ width: size, height: size, backgroundColor: preset.ring }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0">
        <g transform="translate(50 50)">
          {petals.map((p, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-30"
              rx="8"
              ry="18"
              fill={p.color}
              transform={`rotate(${p.angle})`}
              opacity="0.92"
            />
          ))}
          <circle cx="0" cy="0" r="23" fill={preset.core} />
        </g>
      </svg>
      <span className="relative flex items-center justify-center text-white">
        {Icon ? (
          <Icon size={Math.round(size * 0.4)} strokeWidth={2.4} />
        ) : (
          <span style={{ fontSize: Math.round(size * 0.32), fontWeight: 700 }}>
            {getInitials(name)}
          </span>
        )}
      </span>
    </span>
  );
}
