import { useCallback, useEffect, useState } from 'react';

// Préférences d'affichage du tableau, persistées par projet (localStorage),
// sur le même modèle que useColumnWidths.
//
// Ne contient que des choix de LECTURE (pas de donnée métier) : leur perte
// est sans conséquence, ce qui justifie le stockage local. Une persistance
// serveur partageable est une évolution distincte.
const storageKey = (boardId) => `pharmaco_viewprefs_${boardId ?? 'default'}`;

const DEFAUTS = { groupByStep: false };

function load(boardId) {
  try {
    return { ...DEFAUTS, ...(JSON.parse(localStorage.getItem(storageKey(boardId))) || {}) };
  } catch {
    return { ...DEFAUTS };
  }
}

export function useViewPreferences(boardId) {
  const [prefs, setPrefs] = useState(() => load(boardId));

  // Recharge au changement de projet.
  useEffect(() => {
    setPrefs(load(boardId));
  }, [boardId]);

  const setPref = useCallback(
    (key, value) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(storageKey(boardId), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [boardId]
  );

  return { prefs, setPref };
}
