// Configuration centralisée de l'authentification.
// Le secret signe les jetons (HMAC) : s'il est connu/par défaut, n'importe qui
// peut forger un jeton pour n'importe quel utilisateur (et devenir admin).
// Il DOIT donc être défini, long et aléatoire, en production.

const DEFAULT_SECRET = 'pharmaco-dev-secret';

export const AUTH_SECRET = process.env.AUTH_SECRET || DEFAULT_SECRET;
export const isDefaultSecret = AUTH_SECRET === DEFAULT_SECRET;

// Render définit la variable RENDER ; on considère aussi NODE_ENV=production.
export const isProduction =
  process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// Vérifie la robustesse du secret au démarrage.
//  - Production + secret par défaut/faible  -> arrêt (sauf ALLOW_INSECURE_AUTH=true).
//  - Développement + secret par défaut       -> simple avertissement.
export function assertSecureAuth() {
  const weak = isDefaultSecret || AUTH_SECRET.length < 16;

  if (isProduction && weak) {
    if (process.env.ALLOW_INSECURE_AUTH === 'true') {
      console.warn(
        '⚠️  AUTH_SECRET absent ou faible en PRODUCTION : authentification NON sécurisée ' +
          '(ALLOW_INSECURE_AUTH=true). Les jetons peuvent être forgés.'
      );
      return;
    }
    console.error(
      [
        '',
        '❌  Démarrage refusé : AUTH_SECRET manquant ou trop faible en production.',
        '    Les jetons d’authentification seraient falsifiables (élévation de privilèges).',
        '',
        '    → Définissez une variable d’environnement AUTH_SECRET (≥ 32 caractères aléatoires).',
        '      Générez-en un :',
        '        node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
        '',
        '    (Contournement explicite et déconseillé : ALLOW_INSECURE_AUTH=true)',
        '',
      ].join('\n')
    );
    process.exit(1);
  }

  if (weak) {
    console.warn(
      'ℹ️  AUTH_SECRET non défini : secret de développement utilisé. ' +
        'Définissez AUTH_SECRET (≥ 32 caractères) avant toute mise en production.'
    );
  }
}
