import { useEffect, useRef, useState } from 'react';
import {
  X,
  MessageSquare,
  History,
  Send,
  Flag,
  Calendar,
  CircleDot,
  UserCircle2,
  Loader2,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { api } from '../api/index.js';
import { STATUS_META, PRIORITY_META, formatShortDate } from '../lib/constants.js';

// Formatte un horodatage relatif court ("il y a 2 h", "hier", date sinon).
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Libellé lisible d'une entrée du journal d'activité.
function activityLabel(a) {
  const who = a.user?.name || 'Quelqu’un';
  switch (a.action_type) {
    case 'created':
      return `${who} a créé la tâche « ${a.new_value} »`;
    case 'status':
      return `${who} a changé le statut de « ${a.old_value} » à « ${a.new_value} »`;
    case 'priority':
      return `${who} a changé la priorité de « ${a.old_value} » à « ${a.new_value} »`;
    case 'name':
      return `${who} a renommé la tâche en « ${a.new_value} »`;
    case 'duedate':
      return `${who} a modifié l'échéance (${a.old_value} → ${a.new_value})`;
    case 'admin':
      return `${who} a réassigné : ${a.old_value} → ${a.new_value}`;
    default:
      return `${who} a mis à jour ${a.action_type}`;
  }
}

// Panneau latéral coulissant d'une tâche : Discussion + Historique.
export default function TaskDrawer({ task, currentUser, onClose, onCommentsCountChange }) {
  const [tab, setTab] = useState('discussion');
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.getComments(task.id), api.getActivity(task.id)])
      .then(([c, a]) => {
        if (!active) return;
        setComments(c);
        setActivity(a);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [task.id]);

  // Échap pour fermer
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Auto-scroll vers le dernier message
  useEffect(() => {
    if (tab === 'discussion' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, tab, loading]);

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const created = await api.addComment(task.id, {
        user_id: currentUser.id,
        content,
      });
      setComments((prev) => [...prev, created]);
      setDraft('');
      onCommentsCountChange?.(task.id, comments.length + 1);
    } finally {
      setSending(false);
    }
  };

  const statusMeta = STATUS_META[task.status] || STATUS_META['À faire'];
  const prioMeta = PRIORITY_META[task.priority] || PRIORITY_META['P3 - Normal'];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl animate-[slideIn_.2s_ease-out]">
        {/* En-tête */}
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-800">{task.name}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          {/* Méta */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-white"
              style={{ backgroundColor: statusMeta.bg }}
            >
              <CircleDot size={11} /> {task.status}
            </span>
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-white"
              style={{ backgroundColor: prioMeta.bg }}
            >
              <Flag size={11} /> {prioMeta.label}
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <Calendar size={12} /> {formatShortDate(task.duedate) || '—'}
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              {task.admin ? (
                <>
                  <Avatar name={task.admin.name} src={task.admin.avatar_url} size={18} ring={false} />
                  {task.admin.name}
                </>
              ) : (
                <>
                  <UserCircle2 size={14} /> Non assignée
                </>
              )}
            </span>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-200">
          {[
            { key: 'discussion', label: 'Discussion', icon: MessageSquare, count: comments.length },
            { key: 'historique', label: 'Historique', icon: History, count: activity.length },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm transition ${
                  active
                    ? 'border-primary font-medium text-primary'
                    : 'border-transparent text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} /> {t.label}
                {t.count > 0 && (
                  <span className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-500">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : tab === 'discussion' ? (
          <>
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto p-4">
              {comments.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  Aucun message. Lancez la discussion !
                </p>
              )}
              {comments.map((c) => {
                const mine = c.user?.id === currentUser.id;
                return (
                  <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    <Avatar
                      name={c.user?.name || '?'}
                      src={c.user?.avatar_url}
                      size={32}
                      ring={false}
                    />
                    <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
                      <div className="mb-0.5 flex items-center gap-2 text-xs text-gray-400">
                        <span className="font-medium text-gray-600">{c.user?.name || 'Inconnu'}</span>
                        <span>{timeAgo(c.created_at)}</span>
                      </div>
                      <div
                        className={`inline-block rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {c.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Saisie */}
            <form onSubmit={send} className="border-t border-gray-100 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  rows={1}
                  placeholder="Écrire un message…  (Entrée pour envoyer)"
                  className="max-h-28 flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            {activity.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">Aucune activité</p>
            )}
            <ol className="relative ml-2 border-l border-gray-200">
              {activity.map((a) => (
                <li key={a.id} className="mb-5 ml-4">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm text-gray-700">{activityLabel(a)}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{timeAgo(a.created_at)}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </>
  );
}
