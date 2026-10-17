import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  Activity,
  Mic,
  Wifi,
  ShieldAlert,
  Layers,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const MetricsRow: React.FC = () => {
  const { state } = useApp();
  const { metrics, wsState, micState, acousticEngineState } = state;

  const metricCards = [
    {
      label: 'Acoustic Engine',
      value: acousticEngineState.toUpperCase(),
      sub: 'DSP Decoders Active',
      icon: Activity,
      badge: <StatusBadge status={acousticEngineState} pulse={acousticEngineState === 'transmitting'} />,
      color: 'border-[#29434A]',
    },
    {
      label: 'Microphone Hardware',
      value: micState.toUpperCase(),
      sub: 'Audio Ingest Stream',
      icon: Mic,
      badge: <StatusBadge status={micState} pulse={micState === 'active'} />,
      color: 'border-[#29434A]',
    },
    {
      label: 'Backend & WebSocket',
      value: wsState.toUpperCase(),
      sub: 'Bi-directional Bus',
      icon: Wifi,
      badge: <StatusBadge status={wsState} pulse={wsState === 'connecting'} />,
      color: 'border-[#29434A]',
    },
    {
      label: 'Pending Confirmations',
      value: metrics.pending_confirmation_count,
      sub: 'Awaiting Acoustic Tone',
      icon: ShieldAlert,
      badge: (
        <span
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
            metrics.pending_confirmation_count > 0
              ? 'bg-[#FF642D]/20 text-[#FF642D] border-[#FF642D]/60 animate-pulse'
              : 'bg-[#12343B] text-[#9AAEB1] border-[#29434A]'
          }`}
        >
          {metrics.pending_confirmation_count > 0 ? 'ALERT' : 'CLEAR'}
        </span>
      ),
      color: metrics.pending_confirmation_count > 0 ? 'border-[#FF642D]/50' : 'border-[#29434A]',
    },
    {
      label: 'Total Sessions',
      value: metrics.total_sessions,
      sub: 'Lifetime Ingest Count',
      icon: Layers,
      color: 'border-[#29434A]',
    },
    {
      label: 'Completed Transactions',
      value: metrics.completed_transactions,
      sub: 'Acoustically Verified',
      icon: CheckCircle2,
      badge: <span className="text-xs font-mono text-[#22C55E]">100% AUDITED</span>,
      color: 'border-emerald-900/60',
    },
    {
      label: 'Failed / Rejected',
      value: metrics.failed_rejected_transactions,
      sub: 'Security Interventions',
      icon: XCircle,
      badge: (
        <span
          className={`text-xs font-mono ${
            metrics.failed_rejected_transactions > 0 ? 'text-red-400' : 'text-[#9AAEB1]'
          }`}
        >
          ANOMALIES
        </span>
      ),
      color: metrics.failed_rejected_transactions > 0 ? 'border-red-900/60' : 'border-[#29434A]',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {metricCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`bg-[#0D252B] p-3.5 rounded border ${card.color} shadow-sm hover:border-[#FF642D]/40 transition-colors flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9AAEB1] truncate">
                {card.label}
              </span>
              <Icon className="w-3.5 h-3.5 text-[#FF642D] shrink-0" />
            </div>

            <div className="flex items-baseline justify-between gap-2 my-1">
              <span className="text-xl font-bold font-mono tracking-tight text-[#F4F3EF]">
                {card.value}
              </span>
              {card.badge}
            </div>

            <span className="text-[10px] text-[#9AAEB1]/70 truncate mt-1">
              {card.sub}
            </span>
          </div>
        );
      })}
    </div>
  );
};
