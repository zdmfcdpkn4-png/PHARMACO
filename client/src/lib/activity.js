// Journal d'activité d'une tâche : mise en forme partagée.
//
// SOURCE UNIQUE des libellés : la traçabilité de la fiche de tâche
// (`TaskAuditTrail`) et l'onglet « Historique » du tiroir (`TaskDrawer`)
// décrivent les mêmes entrées — elles doivent les décrire avec les mêmes mots.

// Horodatage relatif court ("il y a 2 h", "hier", date sinon).
export function tempsRelatif(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Horodatage complet, pour une trace vérifiable ("27 juil. 2026 à 14:32").
export function horodatage(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// « Quoi » : ce que l'entrée décrit, en un mot, pour la colonne de gauche.
const QUOI = {
  created: 'Création',
  name: 'Nom',
  status: 'Statut',
  priority: 'Priorité',
  duedate: 'Échéance',
  start_date: 'Date de début',
  admin: 'Assignation',
  assignees: 'Assignation',
  group: 'Groupe',
  step: 'Circuit',
  etape_tag: 'Étiquette Étape',
  intervention_tag: 'Étiquette Type',
  archived: 'Archivage',
};

export function quoiActivite(a) {
  return QUOI[a.action_type] || a.action_type;
}

// « Qui » : l'auteur, ou une mention neutre si le compte a été supprimé.
export function quiActivite(a) {
  return a.user?.name || 'Quelqu’un';
}

// Phrase complète décrivant l'entrée (qui + quoi).
export function libelleActivite(a) {
  const who = quiActivite(a);
  const de = a.old_value || '—';
  const vers = a.new_value || '—';
  switch (a.action_type) {
    case 'created':
      return `${who} a créé la tâche « ${a.new_value} »`;
    case 'status':
      return `${who} a changé le statut de « ${de} » à « ${vers} »`;
    case 'priority':
      return `${who} a changé la priorité de « ${de} » à « ${vers} »`;
    case 'name':
      return `${who} a renommé la tâche en « ${a.new_value} »`;
    case 'duedate':
      return `${who} a modifié l'échéance (${de} → ${vers})`;
    case 'start_date':
      return `${who} a modifié la date de début (${de} → ${vers})`;
    case 'admin':
      return `${who} a réassigné : ${de} → ${vers}`;
    case 'assignees':
      return `${who} a modifié l'assignation : ${de} → ${vers}`;
    case 'group':
      return `${who} a déplacé la tâche de « ${de} » vers « ${vers} »`;
    case 'step':
      return `${who} a changé l'étape du circuit : « ${de} » → « ${vers} »`;
    case 'etape_tag':
      return `${who} a changé l'étiquette Étape : « ${de} » → « ${vers} »`;
    case 'intervention_tag':
      return `${who} a changé l'étiquette Type : « ${de} » → « ${vers} »`;
    case 'archived':
      return a.new_value === 'archivée'
        ? `${who} a archivé la tâche`
        : `${who} a sorti la tâche des archives`;
    default:
      return `${who} a mis à jour ${a.action_type}`;
  }
}
