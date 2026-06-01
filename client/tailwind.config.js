/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Charte graphique PHARMACO (dérivée du logo floral) ----
        canvas: '#faf7fb', // fond très clair teinté lilas
        primary: {
          DEFAULT: '#3b1f7a', // violet profond (lettre P du logo)
          hover: '#2e1860',
          light: '#ece6f6',
        },
        brand: {
          purple: '#3b1f7a',
          orange: '#e8722e', // orange (pétales + "pharmacotechnie")
          yellow: '#f2c94c', // jaune
          lilac: '#d9a7e0', // lilas
        },
        status: {
          progress: '#e8722e', // En cours -> orange du logo
          done: '#00c875', // Fait -> vert
          blocked: '#e2445c', // Bloqué -> rouge
          todo: '#c4c4c4', // À faire -> gris
        },
        group: {
          blue: '#3b1f7a',
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
