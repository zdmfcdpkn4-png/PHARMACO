import { useState } from 'react';
import { Archive, Palette, Pencil, Trash2 } from 'lucide-react';
import BottomSheet from './BottomSheet.jsx';

// Actions de projet sur mobile — équivalent tactile du menu déroulant de
// BoardHeader, qui n'est rendu que dans la branche bureau d'App.jsx. Sans
// cette feuille, un projet actif ne peut être ni renommé, ni archivé, ni
// supprimé depuis un téléphone.
//
// Les gardes reprennent EXACTEMENT celles du menu bureau (BoardHeader.jsx:126-176),
// elles-mêmes calées sur le serveur : renommer = tout éditeur (`PATCH /boards/:id`
// est sous `requireEditor`), personnaliser = propriétaire ou admin, archiver et
// supprimer = admin seulement.
export default function ProjectActionsSheet({
  open,
  onClose,
  boardName = '',
  canEdit = false,
  canManage = false,
  isAdmin = false,
  onRename,
  onCustomize,
  onArchive,
  onDelete,
}) {
  const [renommage, setRenommage] = useState(false);
  const [nom, setNom] = useState(boardName);

  const fermer = () => {
    setRenommage(false);
    setNom(boardName);
    onClose?.();
  };

  const validerNom = () => {
    const n = nom.trim();
    if (n && n !== boardName) onRename?.(n);
    fermer();
  };

  return (
    <BottomSheet open={open} title={boardName || 'Projet'} onClose={fermer}>
      {renommage ? (
        <div className="space-y-2 p-2">
          <label className="block text-xs font-semibold uppercase text-gray-400">
            Nom du projet
          </label>
          <input
            autoFocus
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') validerNom();
              if (e.key === 'Escape') setRenommage(false);
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={validerNom}
              disabled={!nom.trim()}
              className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setRenommage(false)}
              className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-600"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1 p-2">
          {canEdit && (
            <Action icon={Pencil} onClick={() => setRenommage(true)}>
              Renommer
            </Action>
          )}
          {canManage && onCustomize && (
            <Action
              icon={Palette}
              couleurIcone="text-primary"
              onClick={() => {
                onCustomize();
                fermer();
              }}
            >
              Personnaliser (couleur &amp; vignette)
            </Action>
          )}
          {isAdmin && onArchive && (
            <Action
              icon={Archive}
              couleurIcone="text-brand-orange"
              onClick={() => {
                onArchive();
                fermer();
              }}
            >
              Archiver le projet
            </Action>
          )}
          {isAdmin && onDelete && (
            <Action
              icon={Trash2}
              danger
              onClick={() => {
                onDelete();
                fermer();
              }}
            >
              Supprimer le projet
            </Action>
          )}
          {!isAdmin && (
            <p className="px-3 py-2 text-[11px] text-gray-400">
              {canEdit
                ? 'Archivage et suppression sont réservés aux administrateurs.'
                : "Vous n'avez pas les droits pour modifier ce projet."}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function Action({ icon: Icon, children, onClick, couleurIcone = 'text-gray-400', danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left text-sm ${
        danger ? 'text-status-blocked hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Icon size={17} className={danger ? '' : couleurIcone} />
      {children}
    </button>
  );
}
