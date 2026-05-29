import { useEffect, useRef } from 'react';
import { Bell, AlertCircle, X } from 'lucide-react';

// Panneau déroulant des alertes (cloche du header).
export default function AlertsPanel({ alerts, open, onClose, onMarkRead }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-gray-700">
          <Bell size={16} /> Alertes
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-80 overflow-auto">
        {alerts.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Aucune alerte</p>
        )}
        {alerts.map((a) => (
          <button
            key={a.id}
            onClick={() => onMarkRead(a.id)}
            className={`flex w-full items-start gap-2 border-b border-gray-50 px-4 py-3 text-left text-sm hover:bg-gray-50 ${
              a.is_read ? 'opacity-50' : ''
            }`}
          >
            <AlertCircle
              size={16}
              className={a.type === 'blocked' ? 'mt-0.5 text-status-blocked' : 'mt-0.5 text-gray-400'}
            />
            <span className="flex-1 text-gray-700">{a.message}</span>
            {!a.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
