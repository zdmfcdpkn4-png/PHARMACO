import { colors, fontFamily } from './design.tokens.js';

// Le thème (couleurs, polices) provient de `design.tokens.js` — source unique
// de l'apparence. Éditer ce fichier-là pour retravailler le design.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors,
      fontFamily,
    },
  },
  plugins: [],
};
