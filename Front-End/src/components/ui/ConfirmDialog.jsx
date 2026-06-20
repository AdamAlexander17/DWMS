import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm', message, loading, confirmLabel = 'Delete', loadingLabel, variant = 'danger' }) {
  const isSuccess = variant === 'success'
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" variant={isSuccess ? 'default' : 'danger'}>
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
          {isSuccess
            ? <CheckCircle2 size={24} className="text-green-500" />
            : <AlertTriangle size={24} className="text-red-500" />
          }
        </div>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex gap-3 w-full mt-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center" disabled={loading}>
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 justify-center ${isSuccess ? 'btn-primary' : 'btn-danger'}`} disabled={loading}>
            {loading ? (loadingLabel || `${confirmLabel}…`) : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
