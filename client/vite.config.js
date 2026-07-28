import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Isole les deux plus grosses dépendances, qui ne servent qu'à des
        // vues secondaires (graphiques du reporting, exports PDF). On
        // n'isole PAS @hello-pangea/dnd : il est nécessaire au premier
        // rendu, un morceau séparé n'ajouterait qu'un aller-retour.
        manualChunks: {
          recharts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
  preview: {
    port: 4173,
    // Autorise les hôtes d'hébergement (Render, etc.). `.onrender.com`
    // couvre tous les sous-domaines Render ; ajoutez ici votre domaine
    // personnalisé si besoin. Mettre `true` autoriserait tous les hôtes.
    allowedHosts: ['.onrender.com'],
  },
});
