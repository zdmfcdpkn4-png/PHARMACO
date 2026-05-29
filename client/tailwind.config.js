/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palette fidèle à Monday.com
        canvas: '#f5f6f8', // fond gris très clair
        primary: {
          DEFAULT: '#0073ea', // bleu vif des boutons principaux
          hover: '#0060b9',
        },
        status: {
          progress: '#fdab3d', // En cours (orange)
          done: '#00c875', // Fait (vert)
          blocked: '#e2445c', // Bloqué (rouge)
          todo: '#c4c4c4', // À faire (gris)
        },
        group: {
          blue: '#579bfc',
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
