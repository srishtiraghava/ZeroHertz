import React, { useState } from 'react';
import { WebSocketEvent } from '../../types';
import { StatusBadge } from './StatusBadge';
import { formatTelemetryTime } from '../../utils/format';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';

interface EventCardProps {
  event: WebSocketEvent;
  compact?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, compact = false }) => {
  const [expanded, setExpanded] = useState(!compact);

  return (
    <div className="border border-[#dce3df] bg-[#ffffff] hover:border-[#bd5e3b]/50 transition-colors rounded p-2.5 text-xs font-mono">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[#667773] hover:text-[#bd5e3b] focus:outline-none transition-colors"
            title="Toggle details"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <StatusBadge status={event.type} />
          {event.session_id && (
            <span className="text-[#667773] truncate text-[11px] bg-[#f0f3ef] px-1.5 py-0.5 rounded border border-[#dce3df]">
              SID: {event.session_id.slice(0, 8)}
            </span>
          )}
        </div>
        <span className="text-[#667773] text-[10px] shrink-0 font-mono">
          {formatTelemetryTime(event.timestamp)}
        </span>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-[#dce3df]/60 bg-[#f4f5f2]/80 rounded p-2 overflow-x-auto text-[11px]">
          <div className="flex items-center gap-1.5 text-[#667773] mb-1">
            <Terminal className="w-3 h-3 text-[#bd5e3b]" />
            <span className="text-[10px] uppercase tracking-wider text-[#667773]">Payload</span>
          </div>
          <pre className="text-[#20312e] font-mono leading-relaxed max-h-40 overflow-y-auto">
            {typeof event.payload === 'object'
              ? JSON.stringify(event.payload, null, 2)
              : String(event.payload)}
          </pre>
        </div>
      )}
    </div>
  );
};
