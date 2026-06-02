import { getInitials } from '../lib/constants.js';

// Avatars inspirés du logo floral PHARMACO, déclinés dans la charte CHD.
// Chaque preset = une couronne de pétales + un cœur coloré portant les
// initiales de l'agent. Stockés via avatar_url = "pharmaco:<index>".
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

// Vrai si avatar_url désigne un avatar PHARMACO généré.
export const isPharmacoAvatar = (src) => typeof src === 'string' && src.startsWith('pharmaco:');
export const pharmacoVariant = (src) =>
  isPharmacoAvatar(src) ? Number(src.slice('pharmaco:'.length)) || 0 : 0;

export default function PharmacoAvatar({ variant = 0, name = '', size = 32, ring = true }) {
  const preset = AVATAR_PRESETS[variant % AVATAR_PRESETS.length];
  const petals = Array.from({ length: 12 }, (_, i) => ({
    angle: (i * 360) / 12,
    color: preset.petals[i % preset.petals.length],
  }));
  const ringClass = ring ? 'ring-2 ring-white' : '';

  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${ringClass}`}
      style={{ width: size, height: size, backgroundColor: preset.ring }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={name}>
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
          <circle cx="0" cy="0" r="22" fill={preset.core} />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Figtree, system-ui, sans-serif"
            fontSize="22"
            fontWeight="700"
            fill="#ffffff"
          >
            {getInitials(name)}
          </text>
        </g>
      </svg>
    </span>
  );
}
