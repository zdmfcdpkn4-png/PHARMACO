import { useState } from 'react';
import { colorFromString, getInitials } from '../lib/constants.js';

// Pastille d'avatar : utilise l'image si elle est fournie ET se charge,
// sinon (ou en cas d'erreur réseau) affiche les initiales sur fond coloré
// déterministe. Aucune dépendance réseau requise par défaut.
export default function Avatar({ name = '', src = null, size = 32, ring = true }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  const dimension = { width: size, height: size };
  const ringClass = ring ? 'ring-2 ring-white' : '';

  if (showImage) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ${ringClass}`}
        style={dimension}
      />
    );
  }

  return (
    <span
      title={name}
      aria-label={name}
      className={`flex items-center justify-center rounded-full font-semibold text-white ${ringClass}`}
      style={{
        ...dimension,
        backgroundColor: colorFromString(name),
        fontSize: Math.round(size * 0.4),
      }}
    >
      {getInitials(name)}
    </span>
  );
}
