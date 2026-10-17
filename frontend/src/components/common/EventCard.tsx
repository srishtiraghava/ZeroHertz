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
    <div className="border border-[#29434A] bg-[#0D252B] hover:border-[#FF642D]/50 transition-colors rounded p-2.5 text-xs font-mono">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[#9AAEB1] hover:text-[#FF642D] focus:outline-none transition-colors"
            title="Toggle details"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <StatusBadge status={event.type} />
          {event.session_id && (
            <span className="text-[#9AAEB1] truncate text-[11px] bg-[#12343B] px-1.5 py-0.5 rounded border border-[#29434A]">
              SID: {event.session_id.slice(0, 8)}
            </span>
          )}
        </div>
        <span className="text-[#9AAEB1] text-[10px] shrink-0 font-mono">
          {formatTelemetryTime(event.timestamp)}
        </span>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-[#29434A]/60 bg-[#07191D]/80 rounded p-2 overflow-x-auto text-[11px]">
          <div className="flex items-center gap-1.5 text-[#9AAEB1] mb-1">
            <Terminal className="w-3 h-3 text-[#FF642D]" />
            <span className="text-[10px] uppercase tracking-wider text-[#9AAEB1]">Payload</span>
          </div>
          <pre className="text-[#F4F3EF] font-mono leading-relaxed max-h-40 overflow-y-auto">
            {typeof event.payload === 'object'
              ? JSON.stringify(event.payload, null, 2)
              : String(event.payload)}
          </pre>
        </div>
      )}
    </div>
  );
};
