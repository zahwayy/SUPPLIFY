'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Dropdown({
  label,
  items = [],
  align = 'right',
  triggerClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer ${triggerClassName}`}
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="menu"
        >
          {items.map((item, idx) => (
            <button
              key={item.key || idx}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
              className={`w-full flex items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors cursor-pointer ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-slate-700 hover:bg-[#F4F5F8] hover:text-[#3243DD]'
              }`}
            >
              {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
