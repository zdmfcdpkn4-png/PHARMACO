import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { STATUSES, STATUS_META } from '../lib/constants.js';

// Badge de statut coloré + popover de sélection au clic.
export default function StatusBadge({ status, onChange, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = STATUS_META[status] || STATUS_META['À faire'];

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpen((v) => !v)}
        className="flex h-full min-h-[36px] w-full items-center justify-center gap-1.5 px-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-default"
        style={{ backgroundColor: meta.bg }}
      >
        {status === 'Bloqué' && <AlertCircle size={14} className="shrink-0" />}
        <span className="truncate">{meta.label}</span>
      </button>

      {open && !readOnly && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          {STATUSES.map((s) => {
            const m = STATUS_META[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (s !== status) onChange?.(s);
                }}
                className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-white last:mb-0 hover:opacity-90"
                style={{ backgroundColor: m.bg }}
              >
                <span className="flex items-center gap-1.5">
                  {s === 'Bloqué' && <AlertCircle size={13} />}
                  {m.label}
                </span>
                {s === status && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
