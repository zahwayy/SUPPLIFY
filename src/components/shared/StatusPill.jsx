import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Truck,
  Info,
  PackageCheck,
  Ban,
  PowerOff,
  Lock,
} from 'lucide-react';
import Badge from '../ui/Badge.jsx';

const STATUS_MAP = {
  active: { label: 'Aktif', tone: 'success', icon: CheckCircle2 },
  inactive: { label: 'Nonaktif', tone: 'neutral', icon: PowerOff },
  approved: { label: 'Disetujui', tone: 'success', icon: CheckCircle2 },
  confirmed: { label: 'Dikonfirmasi', tone: 'info', icon: CheckCircle2 },
  processing: { label: 'Dikonfirmasi (Legacy)', tone: 'info', icon: Clock },
  inspecting: { label: 'Pemeriksaan Fisik', tone: 'warning', icon: Clock },
  received: { label: 'Diterima', tone: 'success', icon: PackageCheck },
  returned: { label: 'Dikembalikan', tone: 'danger', icon: XCircle },
  completed: { label: 'Selesai (Legacy)', tone: 'success', icon: PackageCheck },
  resolved: { label: 'Selesai', tone: 'success', icon: CheckCircle2 },
  closed: { label: 'Ditutup', tone: 'neutral', icon: Lock },
  pending: { label: 'Menunggu', tone: 'warning', icon: Clock },
  preparing: { label: 'Dikonfirmasi (Legacy)', tone: 'info', icon: Clock },
  in_transit: { label: 'Dalam Pengiriman', tone: 'primary', icon: Truck },
  shipped: { label: 'Dikirim', tone: 'primary', icon: Truck },
  delivered: { label: 'Diterima (Legacy)', tone: 'success', icon: CheckCircle2 },
  submitted: { label: 'Diajukan', tone: 'warning', icon: Clock },
  under_review: { label: 'Ditinjau Admin', tone: 'info', icon: Clock },
  rejected: { label: 'Ditolak', tone: 'danger', icon: XCircle },
  cancelled: { label: 'Dibatalkan', tone: 'neutral', icon: Ban },
  open: { label: 'Terbuka', tone: 'danger', icon: AlertTriangle },
  investigating: { label: 'Investigasi', tone: 'warning', icon: AlertTriangle },
};

export default function StatusPill({ status, labelOverride = null }) {
  const key = String(status || '').toLowerCase();
  const cfg = STATUS_MAP[key] || {
    label: status || 'Status',
    tone: 'neutral',
    icon: Info,
  };

  return (
    <Badge tone={cfg.tone} icon={cfg.icon}>
      {labelOverride || cfg.label}
    </Badge>
  );
}
