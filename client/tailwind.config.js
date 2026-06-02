/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Charte graphique CHD ----
        // Majoritaires : bleu foncé #005586 et rose #E82A63.
        // Accents (petites touches) : teal #46B4B3 et jaune #F4C137.
        canvas: '#eef4f8', // fond très clair bleuté CHD
        primary: {
          DEFAULT: '#005586', // bleu CHD (couleur principale, onglets actifs)
          hover: '#00415f',
          light: '#e1edf3',
        },
        brand: {
          blue: '#005586',
          rose: '#e82a63',
          teal: '#46b4b3',
          yellow: '#f4c137',
          // Alias rétro-compatibles (anciennes références au logo)
          purple: '#005586',
          orange: '#e82a63',
          lilac: '#46b4b3',
        },
        status: {
          progress: '#e8722e', // En cours -> orange
          done: '#00c875', // Fait -> vert
          blocked: '#e2445c', // Bloqué -> rouge
          todo: '#c4c4c4', // À faire -> gris
        },
        group: {
          blue: '#005586',
          green: '#00c875',
        },
      },
      fontFamily: {
        sans: [
          'Figtree',
          'Roboto',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
