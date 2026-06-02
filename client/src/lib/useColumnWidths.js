import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_COL_WIDTHS } from './constants.js';

// Persiste les largeurs de colonnes du tableau par projet (localStorage), et
// fournit un getter résolu (avec valeurs par défaut) + un setter.
const storageKey = (boardId) => `pharmaco_colwidths_${boardId ?? 'default'}`;

function load(boardId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(boardId))) || {};
  } catch {
    return {};
  }
}

export function useColumnWidths(boardId) {
  const [widths, setWidths] = useState(() => load(boardId));

  // Recharge les largeurs au changement de projet.
  useEffect(() => {
    setWidths(load(boardId));
  }, [boardId]);

  const persist = (next) => {
    try {
      localStorage.setItem(storageKey(boardId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setWidth = useCallback(
    (key, px) => {
      setWidths((prev) => {
        const next = { ...prev, [key]: Math.round(px) };
        persist(next);
        return next;
      });
    },
    [boardId]
  );

  // Réinitialise une colonne à sa largeur par défaut (supprime la valeur stockée).
  const resetWidth = useCallback(
    (key) => {
      setWidths((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        persist(next);
        return next;
      });
    },
    [boardId]
  );

  // Largeur résolue : valeur stockée, sinon défaut de la colonne, sinon défaut
  // « category » (pour les clés "cat-<id>").
  const getWidth = useCallback(
    (key) => widths[key] ?? DEFAULT_COL_WIDTHS[key] ?? DEFAULT_COL_WIDTHS.category,
    [widths]
  );

  return { getWidth, setWidth, resetWidth };
}
