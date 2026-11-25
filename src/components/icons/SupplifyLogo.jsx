import Image from 'next/image';

export default function SupplifyLogo({
  size = 32,
  showWordmark = true,
  subtitle = '',
  className = '',
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/images/logo-supplify.png"
        alt="Logo Supplify"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        priority
      />
      {showWordmark && (
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-tight text-slate-900">
            Supplify
          </span>
          {subtitle && (
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
