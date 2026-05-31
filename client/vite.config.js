import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    // Autorise les hôtes d'hébergement (Render, etc.). `.onrender.com`
    // couvre tous les sous-domaines Render ; ajoutez ici votre domaine
    // personnalisé si besoin. Mettre `true` autoriserait tous les hôtes.
    allowedHosts: ['.onrender.com'],
  },
});
