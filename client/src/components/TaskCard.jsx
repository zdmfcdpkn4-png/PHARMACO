import { useRef, useState } from 'react';
import { MessageSquare, Check, CheckCircle2, Circle } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { TagPill } from './TagCell.jsx';
import { STATUS_META, PRIORITY_META, formatShortDate } from '../lib/constants.js';

// Carte de tâche mobile avec gestes : swipe droite = commentaires,
// swipe gauche = actions de statut, appui long = sélection multiple.
export default function TaskCard({
  task,
  groupColor,
  tags = [],
  commentCount = 0,
  selectionMode,
  selected,
  onOpenComments,
  onOpenDetail,
  onOpenStatus,
  onMarkDone,
  onOpenStatusSheet,
  onToggleSelect,
  onEnterSelection,
}) {
  const [dx, setDx] = useState(0); // décalage horizontal courant
  const [revealed, setRevealed] = useState(0); // -1 gauche, 0, 1 droite (action figée)
  const start = useRef(null);
  const longPress = useRef(null);
  const moved = useRef(false);

  const meta = STATUS_META[task.status] || STATUS_META['À faire'];
  const prio = PRIORITY_META[task.priority] || PRIORITY_META['P3 - Normal'];

  const onTouchStart = (e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    moved.current = false;
    longPress.current = setTimeout(() => {
      if (!moved.current) {
        onEnterSelection?.();
        if (navigator.vibrate) navigator.vibrate(15);
      }
    }, 500);
  };

  const onTouchMove = (e) => {
    if (!start.current) return;
    const t = e.touches[0];
    const deltaX = t.clientX - start.current.x;
    const deltaY = t.clientY - start.current.y;
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      moved.current = true;
      clearTimeout(longPress.current);
    }
    // Geste horizontal dominant uniquement
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDx(Math.max(-120, Math.min(120, deltaX)));
    }
  };

  const onTouchEnd = () => {
    clearTimeout(longPress.current);
    if (dx > 70) {
      onOpenComments?.();
      setDx(0);
    } else if (dx < -70) {
      setRevealed(-1); // révèle les actions de statut
      setDx(-110);
    } else {
      setDx(revealed === -1 ? -110 : 0);
    }
    start.current = null;
  };

  const resetSwipe = () => {
    setRevealed(0);
    setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Fond gauche (révélé en glissant à droite) : commentaires */}
      <div className="absolute inset-y-0 left-0 flex w-28 items-center gap-1 bg-primary pl-4 text-sm font-medium text-white">
        <MessageSquare size={16} /> Discuter
      </div>
      {/* Fond droit (révélé en glissant à gauche) : actions statut */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
        <button
          onClick={() => {
            onMarkDone?.();
            resetSwipe();
          }}
          className="flex h-9 items-center gap-1 rounded-lg bg-status-done px-3 text-xs font-semibold text-white"
        >
          <Check size={15} /> Fait
        </button>
        <button
          onClick={() => {
            onOpenStatusSheet?.();
            resetSwipe();
          }}
          className="flex h-9 items-center rounded-lg bg-gray-700 px-3 text-xs font-semibold text-white"
        >
          Statut
        </button>
      </div>

      {/* Carte */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (selectionMode) onToggleSelect?.();
          else if (revealed === -1) resetSwipe();
        }}
        className="relative flex h-full gap-3 border-l-4 bg-white p-3 shadow-sm transition-transform"
        style={{
          borderLeftColor: groupColor,
          transform: `translateX(${dx}px)`,
          transition: start.current ? 'none' : 'transform .2s ease-out',
        }}
      >
        {/* Case de sélection en mode multi */}
        {selectionMode && (
          <button onClick={onToggleSelect} className="flex items-center text-primary">
            {selected ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-gray-300" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          {/* Ligne 1 : nom + avatar */}
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!selectionMode) onOpenDetail?.();
              }}
              className="min-w-0 truncate text-left text-base font-semibold text-gray-800"
            >
              {task.name}
            </button>
            {task.admin ? (
              <Avatar name={task.admin.name} src={task.admin.avatar_url} size={30} ring={false} />
            ) : (
              <span className="h-[30px] w-[30px] shrink-0 rounded-full border border-dashed border-gray-300" />
            )}
          </div>

          {/* Ligne 2 : statut + priorité + échéance */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenStatusSheet?.();
              }}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: meta.bg, color: meta.text || '#fff' }}
            >
              {task.status}
            </button>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: prio.bg, color: prio.text || '#fff' }}
            >
              {prio.label}
            </span>
            <span className="ml-auto text-xs text-gray-500">
              {formatShortDate(task.duedate) || '—'}
            </span>
            {commentCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-primary">
                <MessageSquare size={13} /> {commentCount}
              </span>
            )}
          </div>

          {/* Ligne 3 : étiquettes Étape / Type */}
          {(task.etape_tag_id || task.intervention_tag_id) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TagPill tag={tags.find((t) => t.id === task.etape_tag_id)} />
              <TagPill tag={tags.find((t) => t.id === task.intervention_tag_id)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
