import { ShieldCheck, ClipboardCheck, PackageCheck, Truck } from 'lucide-react';
import { ROLE_LABELS, ROLES } from '../../lib/constants/roles.js';
import Badge from './Badge.jsx';

const ROLE_CONFIG = {
  [ROLES.ADMIN]: { tone: 'primary', icon: ShieldCheck },
  [ROLES.MANAGER]: { tone: 'info', icon: ClipboardCheck },
  [ROLES.STAFF]: { tone: 'success', icon: PackageCheck },
  [ROLES.SUPPLIER]: { tone: 'accent', icon: Truck },
};

export default function RoleBadge({ role }) {
  const label = ROLE_LABELS[role] || role;
  const config = ROLE_CONFIG[role] || { tone: 'neutral', icon: null };

  return (
    <Badge tone={config.tone} icon={config.icon}>
      {label}
    </Badge>
  );
}
