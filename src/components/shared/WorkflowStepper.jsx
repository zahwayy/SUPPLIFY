import { Check, XCircle, Ban } from 'lucide-react';

export default function WorkflowStepper({
  steps = [],
  currentKey,
  terminalStatus = null,
  terminalLabel = '',
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  const isTerminal = terminalStatus === 'rejected' || terminalStatus === 'cancelled';

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {isTerminal ? (
        <div
          className={`flex items-center gap-2.5 text-sm font-semibold ${
            terminalStatus === 'rejected' ? 'text-red-700' : 'text-slate-600'
          }`}
        >
          {terminalStatus === 'rejected' ? (
            <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          ) : (
            <Ban className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          )}
          <span>
            {terminalLabel ||
              (terminalStatus === 'rejected'
                ? 'Proses Ditolak'
                : 'Proses Dibatalkan')}
          </span>
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-0 sm:gap-y-2.5">
          {steps.map((step, idx) => {
            const isCompleted = currentIndex > idx;
            const isCurrent = currentIndex === idx;

            return (
              <li
                key={step.key}
                className="flex items-center text-xs sm:text-[13px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-[#3243DD] text-white ring-4 ring-[#3243DD]/15'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="leading-tight">
                    <span
                      className={`font-semibold ${
                        isCurrent
                          ? 'text-[#3243DD]'
                          : isCompleted
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.sublabel && (
                      <span className="block sm:hidden md:block text-[11px] text-slate-400">
                        {step.sublabel}
                      </span>
                    )}
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div
                    className={`hidden sm:block mx-2.5 sm:mx-3.5 h-0.5 w-5 sm:w-8 rounded-full ${
                      isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
