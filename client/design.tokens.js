// =============================================================================
//  PHARMACO — Jetons de design (source unique de l'apparence)
// -----------------------------------------------------------------------------
//  Ce fichier centralise les COULEURS, POLICES, RAYONS et OMBRES de l'app.
//  Il est consommé par `tailwind.config.js`. Modifier les valeurs ici re-thème
//  toute l'interface SANS impact fonctionnel (les noms de classes ne changent
//  pas). C'est le fichier à éditer pour retravailler l'apparence (ex. depuis un
//  outil de design) puis réimporter dans le code.
//
//  Charte CHD : bleu #005586 + rose #E82A63 (majoritaires), teal #46B4B3 +
//  jaune #F4C137 (accents).
// =============================================================================

export const colors = {
  // Fond général de l'application.
  canvas: '#eef4f8',

  // Couleur principale (boutons, onglets actifs, liens).
  primary: {
    DEFAULT: '#005586',
    hover: '#00415f',
    light: '#e1edf3',
  },

  // Couleurs de marque (charte CHD) + alias rétro-compatibles.
  brand: {
    blue: '#005586',
    rose: '#e82a63',
    teal: '#46b4b3',
    yellow: '#f4c137',
    purple: '#005586', // alias -> bleu
    orange: '#e82a63', // alias -> rose
    lilac: '#46b4b3', // alias -> teal
  },

  // Statuts (fonctionnels) — gardés lisibles via une couleur de texte dédiée
  // côté `STATUS_META` dans src/lib/constants.js.
  status: {
    progress: '#f4c137', // En cours
    done: '#46b4b3', // Fait
    blocked: '#e82a63', // Bloqué
    todo: '#9aadbd', // À faire
  },

  // Couleurs par défaut des groupes.
  group: {
    blue: '#005586',
    green: '#00c875',
  },
};

export const fontFamily = {
  sans: ['Figtree', 'Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
};
