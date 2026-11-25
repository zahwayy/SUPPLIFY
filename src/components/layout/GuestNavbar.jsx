'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import SupplifyLogo from '../icons/SupplifyLogo.jsx';

const NAV_LINKS = [
  { href: '#beranda', label: 'Beranda' },
  { href: '#tentang', label: 'Tentang' },
  { href: '#kemitraan', label: 'Kemitraan' },
];

export default function GuestNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('#beranda');
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    const mq = window.matchMedia('(min-width: 768px)');
    function handleBreakpointChange(e) {
      if (e.matches) setMenuOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    mq.addEventListener('change', handleBreakpointChange);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      mq.removeEventListener('change', handleBreakpointChange);
    };
  }, [menuOpen]);

  function handleNavClick(href) {
    setActiveHash(href);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-3 z-30">
      <div ref={containerRef} className="supplify-container relative">
        <nav
          aria-label="Navigasi utama"
          className="w-full min-h-[60px] rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm px-4 sm:px-6 flex items-center justify-between gap-4"
        >
          <Link
            href="/"
            className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] shrink-0"
            onClick={() => handleNavClick('#beranda')}
          >
            <SupplifyLogo size={28} />
          </Link>

          {/* Navigasi Desktop */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-700">
            {NAV_LINKS.map((item) => {
              const isActive = activeHash === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={() => setActiveHash(item.href)}
                  className={
                    isActive
                      ? 'font-semibold text-[#3243DD] border-b-2 border-[#3243DD] pb-0.5'
                      : 'hover:text-[#3243DD] transition-colors pb-0.5'
                  }
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          {/* CTA Desktop */}
          <div className="hidden md:flex items-center shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-[#FF3D8B]/70 bg-white px-4 py-2 text-sm font-semibold text-[#C81D67] hover:bg-[#FFF0F6] hover:border-[#FF3D8B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3D8B] transition-colors"
            >
              Masuk
            </Link>
          </div>

          {/* Tombol Hamburger Mobile */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="guest-mobile-menu"
            aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="md:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-[#EEF1FD]/70 hover:text-[#3243DD] hover:border-[#3243DD]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-colors cursor-pointer"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </nav>

        {/* Panel Menu Mobile dengan Transisi Halus */}
        <div
          id="guest-mobile-menu"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={`md:hidden absolute inset-x-0 top-full mt-2 px-[var(--supplify-container-gutter)] z-30 grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out ${
            menuOpen
              ? 'grid-rows-[1fr] opacity-100 translate-y-0'
              : 'grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none invisible'
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-2xl bg-white/98 backdrop-blur-md border border-slate-200/90 shadow-lg p-3.5 space-y-3">
              <div className="flex flex-col gap-1" role="navigation" aria-label="Menu mobile">
                {NAV_LINKS.map((item) => {
                  const isActive = activeHash === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={() => handleNavClick(item.href)}
                      className={`flex items-center justify-between min-h-[44px] rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EEF1FD] text-[#3243DD] font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-[#3243DD]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isActive && (
                        <span
                          className="h-2 w-2 rounded-full bg-[#3243DD]"
                          aria-hidden="true"
                        />
                      )}
                    </a>
                  );
                })}
              </div>

              <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-[#FF3D8B]/70 bg-white px-4 py-2 text-sm font-semibold text-[#C81D67] hover:bg-[#FFF0F6] hover:border-[#FF3D8B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3D8B] transition-colors"
                >
                  Masuk ke Sistem
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-[#3243DD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2635BC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-colors"
                >
                  <span>Daftar sebagai Supplier</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
