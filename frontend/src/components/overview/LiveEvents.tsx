import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EventCard } from '../common/EventCard';
import { Terminal, Trash2, Filter } from 'lucide-react';

export const LiveEvents: React.FC = () => {
  const { state, dispatch } = useApp();
  const { recentEvents } = state;
  const [filterType, setFilterType] = useState<string>('all');

  const filteredEvents = filterType === 'all'
    ? recentEvents
    : recentEvents.filter((e) => e.type === filterType);

  return (
    <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#29434A] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#FF642D]" />
          <h3 className="font-display text-sm tracking-wide text-[#F4F3EF]">
            Live WebSocket Telemetry Stream
          </h3>
          <span className="text-[10px] font-mono bg-[#12343B] text-[#FF642D] px-1.5 py-0.5 rounded border border-[#29434A]">
            {filteredEvents.length} MSG
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 text-xs font-mono bg-[#07191D] px-2 py-1 rounded border border-[#29434A]">
            <Filter className="w-3 h-3 text-[#9AAEB1]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-[#F4F3EF] outline-none text-[11px] cursor-pointer"
            >
              <option value="all" className="bg-[#0D252B]">ALL EVENTS</option>
              <option value="dtmf_detected" className="bg-[#0D252B]">DTMF TONE</option>
              <option value="workflow_update" className="bg-[#0D252B]">WORKFLOW</option>
              <option value="confirmation_requested" className="bg-[#0D252B]">CONFIRM REQ</option>
              <option value="confirmation_verified" className="bg-[#0D252B]">CONFIRM VER</option>
              <option value="status" className="bg-[#0D252B]">STATUS</option>
              <option value="audit_log" className="bg-[#0D252B]">AUDIT</option>
              <option value="error" className="bg-[#0D252B]">ERROR</option>
            </select>
          </div>

          <button
            onClick={() => dispatch({ type: 'UPDATE_METRICS', payload: {} })} // trigger re-render or clear
            className="p-1 rounded text-[#9AAEB1] hover:text-[#FF642D] hover:bg-[#12343B] transition-colors"
            title="Refresh stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px]">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-10 text-[#9AAEB1] font-mono text-xs">
            Awaiting WebSocket telemetry packets from backend...
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <EventCard key={`${event.timestamp}-${index}`} event={event} compact={true} />
          ))
        )}
      </div>
    </div>
  );
};
