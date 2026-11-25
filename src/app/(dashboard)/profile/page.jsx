import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { getOwnProfile } from '../../../modules/users/userService.js';
import { ROLE_LABELS, ROLES } from '../../../lib/constants/roles.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import RoleBadge from '../../../components/ui/RoleBadge.jsx';
import StatusPill from '../../../components/shared/StatusPill.jsx';
import ProfileEditorCard from '../../../components/profile/ProfileEditorCard.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';

function getInitials(name) {
  const parts = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'U';
}

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?expired=1');
  }

  const profile = await getOwnProfile(user);

  const editorProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone || '',
    role: profile.role,
    roleLabel: ROLE_LABELS[profile.role] || profile.role,
    status: profile.status,
    supplierId: profile.supplier_id || null,
    supplierCompanyName: profile.supplier_company_name || '',
    supplierContactName: profile.supplier_contact_name || '',
    supplierPhone: profile.supplier_phone || '',
    supplierAddress: profile.supplier_address || '',
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profil Pengguna"
        description="Informasi akun aktif dan pengelolaan data kontak profil Anda di Supplify."
        badge={<RoleBadge role={profile.role} />}
        breadcrumbs={[
          { label: 'Beranda', href: '/dashboard' },
          { label: 'Profil Pengguna' },
        ]}
      />

      {/* Ringkasan Profil Atas */}
      <Card variant="soft-blue">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3243DD] text-white font-bold text-base shadow-sm">
              {getInitials(profile.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {profile.name}
                </h2>
                <StatusPill status={profile.status || 'active'} />
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-600 truncate">
                {profile.email}
                {profile.role === ROLES.SUPPLIER && profile.supplier_company_name
                  ? ` • ${profile.supplier_company_name}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-white border border-[#3243DD]/15 px-3 py-2 text-xs text-slate-700 shrink-0 self-start sm:self-auto">
            <ShieldCheck className="h-4 w-4 text-[#3243DD] shrink-0" aria-hidden="true" />
            <span>
              Peran: <strong>{ROLE_LABELS[profile.role] || profile.role}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      <ProfileEditorCard profile={editorProfile} />
    </div>
  );
}
