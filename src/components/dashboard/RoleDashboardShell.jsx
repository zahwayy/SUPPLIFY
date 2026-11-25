import PageHeader from '../shared/PageHeader.jsx';
import StatCard from '../shared/StatCard.jsx';
import RoleBadge from '../ui/RoleBadge.jsx';

export default function RoleDashboardShell({
  user,
  title,
  subtitle,
  headerActions = null,
  kpiStrip = [],
  alertBanner = null,
  briefingBanner = null,
  mainContent = null,
  sideContent = null,
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={subtitle}
        badge={<RoleBadge role={user.role} />}
        actions={headerActions}
      />

      {alertBanner}

      {briefingBanner}

      {kpiStrip.length > 0 && (
        <section aria-label="Ringkasan operasional">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {kpiStrip.map((kpi) => (
              <StatCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                helper={kpi.helper}
                icon={kpi.icon}
                tone={kpi.tone}
                surface={kpi.surface || 'default'}
                href={kpi.href}
              />
            ))}
          </div>
        </section>
      )}

      <div
        className={
          sideContent
            ? 'grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-5 items-start'
            : 'space-y-5'
        }
      >
        <div className="space-y-5 min-w-0">{mainContent}</div>
        {sideContent && <aside className="space-y-4 min-w-0">{sideContent}</aside>}
      </div>
    </div>
  );
}
