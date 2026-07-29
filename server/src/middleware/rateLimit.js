// Limitation de débit des tentatives d'authentification.
//
// Objectif : rendre le bourrage de mots de passe impraticable SANS alourdir
// la connexion. Un usage normal n'est jamais pénalisé, car seuls les ÉCHECS
// sont comptés — se connecter dix fois de suite avec le bon mot de passe ne
// déclenche rien.
//
// Deux compteurs indépendants :
//   - par COMPTE (e-mail) : c'est lui qui protège réellement un mot de passe,
//     quelle que soit l'adresse d'où viennent les tentatives ;
//   - par ADRESSE IP : plus large, contre le balayage de nombreux comptes
//     depuis une même machine.
//
// Volontairement en mémoire : aucune dépendance, aucune table. Limites
// assumées — les compteurs repartent de zéro au redémarrage de l'API, et
// chaque instance a les siens. C'est un ralentisseur, pas un pare-feu ; il
// suffit largement face à une attaque automatisée sur un service interne.

const seaux = new Map(); // clé -> { compte, expire }
const MAX_SEAUX = 5000; // garde-fou mémoire (e-mails inventés à la volée)

const purger = () => {
  const t = Date.now();
  for (const [cle, seau] of seaux) if (seau.expire <= t) seaux.delete(cle);
  // Si la purge ne suffit pas, on vide le plus ancien tiers : perdre des
  // compteurs est sans danger, saturer la mémoire ne l'est pas.
  if (seaux.size > MAX_SEAUX) {
    const aRetirer = Math.ceil(seaux.size / 3);
    let i = 0;
    for (const cle of seaux.keys()) {
      seaux.delete(cle);
      if (++i >= aRetirer) break;
    }
  }
};

/**
 * Middleware de limitation des tentatives d'authentification.
 * Répond 429 (+ en-tête Retry-After) quand un compteur est saturé.
 */
export function limiterTentatives({
  fenetreMs = 10 * 60 * 1000, // 10 minutes
  maxParCompte = 8,
  maxParIp = 40,
} = {}) {
  return (req, res, next) => {
    purger();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const cibles = [{ cle: `ip:${req.ip}`, max: maxParIp }];
    if (email) cibles.unshift({ cle: `compte:${email}`, max: maxParCompte });

    for (const { cle, max } of cibles) {
      const seau = seaux.get(cle);
      if (seau && seau.expire > Date.now() && seau.compte >= max) {
        const secondes = Math.ceil((seau.expire - Date.now()) / 1000);
        res.set('Retry-After', String(secondes));
        return res.status(429).json({
          error: `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(
            secondes / 60
          )} minute(s).`,
        });
      }
    }

    // Comptabilise après coup, uniquement en cas d'échec d'authentification.
    res.on('finish', () => {
      if (res.statusCode !== 401) return;
      const t = Date.now();
      for (const { cle } of cibles) {
        const seau = seaux.get(cle);
        if (seau && seau.expire > t) seau.compte += 1;
        else seaux.set(cle, { compte: 1, expire: t + fenetreMs });
      }
    });

    next();
  };
}

// Réservé aux tests : remet les compteurs à zéro.
export function reinitialiserTentatives() {
  seaux.clear();
}
