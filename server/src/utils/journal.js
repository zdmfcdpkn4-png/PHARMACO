// Auteur d'une entrée du journal d'activité.
//
// Le client envoie `actor_id` dans le corps de ses requêtes ; c'est pratique,
// mais ce n'est PAS une preuve : n'importe qui peut écrire l'identifiant de
// n'importe qui. Or le journal sert de traçabilité — il est consulté par les
// administrateurs pour savoir qui a fait quoi. L'identité retenue est donc
// celle du JETON (`req.user`, posée par le middleware `authenticate`) ; le
// corps de la requête ne sert que de secours pour les appels d'outillage
// interne qui ne portent pas de jeton.
export function auteurDe(req, actorIdDuCorps) {
  const duJeton = req.user?.id;
  if (duJeton) return duJeton;
  const secours = Number(actorIdDuCorps);
  return Number.isInteger(secours) && secours > 0 ? secours : null;
}
