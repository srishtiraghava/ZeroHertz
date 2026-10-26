import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatTelemetryTime } from '../../utils/format';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Activity,
  Layers,
} from 'lucide-react';

export const EventTimeline: React.FC = () => {
  const { state } = useApp();
  const { activeSession, recentEvents } = state;

  // Filter events related to transactions and workflow updates
  const transactionEvents = recentEvents.filter(
    (ev) =>
      ev.type === 'workflow_update' ||
      ev.type === 'confirmation_requested' ||
      ev.type === 'confirmation_verified' ||
      ev.type === 'transaction_completed' ||
      ev.type === 'transaction_failed' ||
      ev.type === 'portal_event'
  );

  return (
    <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-[#dce3df] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#bd5e3b]" />
          <h3 className="font-display text-sm tracking-wide text-[#20312e]">
            Transaction Pipeline Timeline
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[#667773]">
          {transactionEvents.length} Recorded Traces
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
        {transactionEvents.length === 0 ? (
          <div className="text-center py-10 text-[#667773] font-mono text-xs">
            <Layers className="w-6 h-6 mx-auto mb-2 text-[#667773]/50" />
            No transaction timeline events received yet.
          </div>
        ) : (
          transactionEvents.map((ev, index) => {
            const isSuccess =
              ev.type === 'confirmation_verified' || ev.type === 'transaction_completed';
            const isWarn = ev.type === 'confirmation_requested';
            const isError = ev.type === 'transaction_failed';

            const Icon = isError
              ? XCircle
              : isWarn
              ? AlertTriangle
              : isSuccess
              ? CheckCircle2
              : Clock;

            const iconColor = isError
              ? 'text-[#a63f37]'
              : isWarn
              ? 'text-[#8b5c1c]'
              : isSuccess
              ? 'text-emerald-400'
              : 'text-[#bd5e3b]';

            const stageTitle =
              ev.payload?.stage ||
              ev.payload?.workflow_stage ||
              ev.payload?.step ||
              ev.type.replace(/_/g, ' ').toUpperCase();

            const detailMsg =
              ev.payload?.message ||
              ev.payload?.detail ||
              (typeof ev.payload === 'string' ? ev.payload : null);

            return (
              <div key={index} className="flex items-start gap-3 text-xs relative group">
                {/* Timeline vertical connector */}
                {index < transactionEvents.length - 1 && (
                  <div className="absolute left-2.5 top-5 bottom-[-12px] w-[1px] bg-[#dce3df]" />
                )}

                <div
                  className={`relative z-10 w-5 h-5 rounded-full bg-[#f0f3ef] border border-[#dce3df] flex items-center justify-center shrink-0 ${iconColor}`}
                >
                  <Icon className="w-3 h-3" />
                </div>

                <div className="flex-1 min-w-0 bg-[#f4f5f2]/70 p-2.5 rounded border border-[#dce3df]/60 group-hover:border-[#bd5e3b]/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-[#20312e] truncate uppercase text-[11px]">
                      {stageTitle}
                    </span>
                    <span className="font-mono text-[10px] text-[#667773] shrink-0">
                      {formatTelemetryTime(ev.timestamp)}
                    </span>
                  </div>

                  {detailMsg && (
                    <p className="text-[11px] text-[#667773] font-mono leading-relaxed">
                      {detailMsg}
                    </p>
                  )}

                  {ev.session_id && (
                    <div className="mt-1 text-[10px] font-mono text-[#667773]/70">
                      SID: {ev.session_id.slice(0, 10)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
