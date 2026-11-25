'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import Button from '../ui/Button.jsx';
import { useToast } from '../ui/ToastProvider.jsx';

export default function ExportCsvButton({
  resource,
  filters = {},
  label = 'Ekspor CSV',
  onFeedback = null,
}) {
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [inlineNotice, setInlineNotice] = useState(null);

  function notify(type, text) {
    if (typeof onFeedback === 'function') {
      onFeedback({ type, text });
    } else {
      toast.pushToast(type, text);
      setInlineNotice({ type, text });
      setTimeout(() => setInlineNotice(null), 5000);
    }
  }

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    setInlineNotice(null);

    try {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(filters || {})) {
        if (val === undefined || val === null || val === '' || val === false) continue;
        if (val === true) {
          params.set(key, '1');
        } else {
          params.set(key, String(val).trim());
        }
      }

      const qs = params.toString();
      const url = `/api/export/${encodeURIComponent(resource)}${qs ? `?${qs}` : ''}`;
      const response = await fetch(url, { method: 'GET', credentials: 'same-origin' });

      if (!response.ok) {
        let errorMsg = 'Gagal mengunduh file CSV. Silakan coba kembali.';
        try {
          const data = await response.json();
          if (data?.error) errorMsg = data.error;
        } catch {
          // ignore non-json error body
        }
        notify('error', errorMsg);
        return;
      }

      const rowCount = Number(response.headers.get('X-Export-Row-Count') ?? '-1');
      if (rowCount === 0) {
        notify(
          'info',
          'Tidak ada data yang tersedia untuk diunduh sesuai filter saat ini.'
        );
        return;
      }

      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = filenameMatch?.[1] || `${resource}.csv`;

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      notify(
        'success',
        `File ${filename} berhasil diunduh (${rowCount >= 0 ? `${rowCount} baris` : 'selesai'}).`
      );
    } catch {
      notify('error', 'Koneksi terputus saat mengunduh CSV. Silakan coba kembali.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        loading={isExporting}
        onClick={handleExport}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      {inlineNotice && (
        <span
          role="status"
          className={`text-[11px] font-medium ${
            inlineNotice.type === 'error'
              ? 'text-red-600'
              : inlineNotice.type === 'info'
              ? 'text-amber-700'
              : 'text-emerald-700'
          }`}
        >
          {inlineNotice.text}
        </span>
      )}
    </div>
  );
}
