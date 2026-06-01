// Logo PHARMACO : marque florale (pétales colorés) avec un "P" central.
// Inspiré du logo "pharmacotechnie". Rendu en SVG, sans dépendance image.
const PETAL_COLORS = ['#3b1f7a', '#e8722e', '#f2c94c', '#d9a7e0'];

export default function Logo({ size = 40, withRing = false, className = '' }) {
  // 12 pétales disposés en couronne autour du centre.
  const petals = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 360) / 12;
    const color = PETAL_COLORS[i % PETAL_COLORS.length];
    return { angle, color };
  });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="PHARMACO"
    >
      {withRing && (
        <circle cx="50" cy="50" r="48" fill="none" stroke="#e8722e" strokeWidth="1.2" />
      )}
      <g transform="translate(50 50)">
        {petals.map((p, i) => (
          <ellipse
            key={i}
            cx="0"
            cy="-22"
            rx="7"
            ry="17"
            fill={p.color}
            transform={`rotate(${p.angle})`}
            opacity="0.92"
          />
        ))}
      </g>
      {/* Lettre P centrale */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="42"
        fontWeight="700"
        fill="#3b1f7a"
      >
        P
      </text>
    </svg>
  );
}
