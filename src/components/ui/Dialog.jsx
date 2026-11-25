'use client';

import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function Dialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  children = null,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  confirmVariant = 'primary',
  loading = false,
  confirmDisabled = false,
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose?.();
      }}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            autoFocus={confirmVariant === 'danger' || confirmVariant === 'warning'}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && (
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      )}
      {children && <div className={message ? 'mt-3.5' : ''}>{children}</div>}
    </Modal>
  );
}
