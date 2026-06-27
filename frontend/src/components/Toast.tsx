import { CONFIG } from '../lib/config';

export interface ToastMsg {
  kind: 'success' | 'error' | 'info';
  text: string;
  txHash?: string;
}

export function Toast({ toast, onClose }: { toast: ToastMsg; onClose: () => void }) {
  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <span>{toast.text}</span>
      {toast.txHash && (
        <a href={`${CONFIG.explorerBase}/tx/${toast.txHash}`} target="_blank" rel="noreferrer">
          View tx ↗
        </a>
      )}
      <button className="toast-close" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
