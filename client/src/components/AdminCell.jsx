import { useEffect, useRef, useState } from 'react';
import { UserCircle2, Check, X } from 'lucide-react';

// Avatar de l'admin assigné + menu déroulant pour changer/retirer.
export default function AdminCell({ admin, users, onAssign }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative flex items-center justify-center" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={admin ? admin.name : 'Assigner'}
        className="flex items-center justify-center rounded-full transition-transform hover:scale-105"
      >
        {admin?.avatar_url ? (
          <img
            src={admin.avatar_url}
            alt={admin.name}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
          />
        ) : (
          <UserCircle2 size={28} className="text-gray-300" strokeWidth={1.5} />
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-1 max-h-72 w-56 -translate-x-1/2 overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-gray-400">
            Assigner à
          </div>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onAssign?.(u.id);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100"
            >
              <img src={u.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              <span className="flex-1 truncate text-gray-700">{u.name}</span>
              {admin?.id === u.id && <Check size={14} className="text-primary" />}
            </button>
          ))}
          {admin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAssign?.(null);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-gray-100 px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-100"
            >
              <X size={14} /> Retirer l'assignation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
