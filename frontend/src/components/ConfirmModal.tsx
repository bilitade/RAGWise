import { FiAlertTriangle } from "react-icons/fi";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_80%,transparent)] backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background)] p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
            isDestructive ? "bg-[color-mix(in_srgb,var(--error)_15%,transparent)] text-[var(--error)]" : "bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          }`}>
            <FiAlertTriangle className="size-6" strokeWidth={2.25} />
          </div>
          
          <h3 className="mb-2 text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="mb-8 text-sm leading-relaxed text-[var(--text-secondary)]">
            {message}
          </p>
          
          <div className="flex w-full flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:bg-[color-mix(in_srgb,var(--elevated)_50%,transparent)] active:scale-[0.98]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] ${
                isDestructive ? "bg-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_88%,black)]" : "bg-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
