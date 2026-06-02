import { useEffect, useRef, useState } from 'react';
import { Check, Flag } from 'lucide-react';
import { PRIORITIES, PRIORITY_META } from '../lib/constants.js';

// Badge de priorité coloré + popover de sélection au clic.
export default function PriorityBadge({ priority, onChange, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = PRIORITY_META[priority] || PRIORITY_META['P3 - Normal'];

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
        disabled={readOnly}
        onClick={() => setOpen((v) => !v)}
        title={priority}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-opacity hover:opacity-90 disabled:cursor-default"
        style={{ backgroundColor: meta.bg, color: meta.text || '#fff' }}
      >
        <Flag size={11} className="shrink-0" />
        {meta.label}
      </button>

      {open && !readOnly && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          {PRIORITIES.map((p) => {
            const m = PRIORITY_META[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (p !== priority) onChange?.(p);
                }}
                className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold last:mb-0 hover:opacity-90"
                style={{ backgroundColor: m.bg, color: m.text || '#fff' }}
              >
                <span className="flex items-center gap-1.5">
                  <Flag size={11} /> {m.label} — {m.full}
                </span>
                {p === priority && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
