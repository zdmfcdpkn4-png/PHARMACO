import { useEffect } from 'react';
import { X } from 'lucide-react';

// Tiroir coulissant depuis le bas de l'écran (mobile-friendly).
export default function BottomSheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
      />
      {/* Panneau */}
      <div className="relative max-h-[80vh] overflow-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl animate-[sheetUp_.2s_ease-out]">
        {/* Poignée */}
        <div className="sticky top-0 z-10 bg-white pt-2">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-gray-300" />
          {title && (
            <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2">
              <h3 className="text-base font-semibold text-gray-800">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>
        <div className="p-2">{children}</div>
      </div>
    </div>
  );
}
