'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { formatDateTime } from '../../lib/utils/format.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import FeedbackBanner from './FeedbackBanner.jsx';

const MAX_MB = 5;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export default function EvidencePanel({
  entityType,
  entityId,
  files = [],
  canUpload = false,
  canDelete = false,
  title = 'Bukti & Lampiran',
  helperNote = '',
}) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null;
    setFeedback(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setFeedback({
        type: 'error',
        text: 'Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.',
      });
      setSelectedFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFeedback({
        type: 'error',
        text: `Ukuran file melebihi batas maksimal ${MAX_MB} MB.`,
      });
      setSelectedFile(null);
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({
        type: 'error',
        text: 'Pilih file JPG, PNG, WEBP, atau PDF terlebih dahulu.',
      });
      return;
    }

    setFeedback(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('entityType', entityType);
      fd.append('entityId', String(entityId));
      fd.append('description', description);
      fd.append('file', selectedFile);

      const res = await fetch('/api/evidence', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({
          type: 'error',
          text: data.error || 'File bukti belum berhasil diunggah. Silakan coba kembali.',
        });
      } else {
        setSelectedFile(null);
        setDescription('');
        e.target.reset();
        setFeedback({ type: 'success', text: 'File bukti berhasil diunggah.' });
        router.refresh();
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Koneksi terputus saat mengunggah file. Silakan coba kembali.',
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setFeedback(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/evidence/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      setDeleteTarget(null);
      if (!res.ok || !data.ok) {
        setFeedback({
          type: 'error',
          text: data.error || 'File bukti belum berhasil dihapus.',
        });
      } else {
        setFeedback({ type: 'success', text: 'File bukti berhasil dihapus.' });
        router.refresh();
      }
    } catch {
      setDeleteTarget(null);
      setFeedback({
        type: 'error',
        text: 'Koneksi terputus saat menghapus file. Silakan coba kembali.',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
            {title}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
              {files.length}
            </span>
          </CardTitle>
          {helperNote && (
            <p className="mt-0.5 text-xs text-slate-500">{helperNote}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {canUpload && (
          <form
            onSubmit={handleUpload}
            className="rounded-xl bg-[#F4F5F8] border border-slate-200/90 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  File Bukti (JPG, PNG, WEBP, PDF • Maks {MAX_MB} MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#3243DD] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#2635BC] file:cursor-pointer"
                />
                {selectedFile && (
                  <p className="mt-1 text-[11px] text-slate-600 truncate">
                    Terpilih: <strong>{selectedFile.name}</strong> (
                    {Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Keterangan Singkat (Opsional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Foto kondisi kemasan saat tiba"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={isUploading}
                disabled={!selectedFile}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Unggah Bukti
              </Button>
            </div>
          </form>
        )}

        {files.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {files.map((file) => {
              const isImage = String(file.mime_type || '').startsWith('image/');
              return (
                <li
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 text-sm"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF1FD] text-[#3243DD]">
                      {isImage ? (
                        <ImageIcon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {file.original_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {Math.max(1, Math.round(Number(file.size_bytes) / 1024))} KB •
                        Diunggah oleh {file.uploaded_by_name} pada{' '}
                        {formatDateTime(file.created_at)}
                      </p>
                      {file.description && (
                        <p className="mt-1 text-xs text-slate-700">{file.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <a
                      href={`/api/evidence/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3243DD] hover:bg-[#EEF1FD] transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Lihat
                    </a>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget(file)}
                        aria-label={`Hapus bukti ${file.original_name}`}
                        title="Hapus file bukti"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={FileText}
            title="Belum Ada Lampiran Bukti"
            description={
              canUpload
                ? 'Unggah foto atau dokumen pendukung untuk memperkuat verifikasi proses ini.'
                : 'Belum ada foto atau dokumen pendukung yang dilampirkan pada catatan ini.'
            }
          />
        )}
      </CardContent>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hapus File Bukti"
        message={`Hapus lampiran "${deleteTarget?.original_name || ''}"? File yang dihapus tidak dapat dipulihkan.`}
        confirmLabel="Hapus File"
        confirmVariant="danger"
        loading={isDeleting}
      />
    </Card>
  );
}
