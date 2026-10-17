import React from 'react';
import { useApp } from '../../context/AppContext';
import { NavigationTab } from '../../types';
import {
  LayoutDashboard,
  Radio,
  Mic,
  Activity,
  FileCheck,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface NavItem {
  id: NavigationTab;
  label: string;
  sublabel: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Command Center',
    sublabel: 'Overview & Telemetry',
    icon: LayoutDashboard,
  },
  {
    id: 'acoustic',
    label: 'Acoustic Modem',
    sublabel: 'DTMF DSP & Spectrum',
    icon: Radio,
  },
  {
    id: 'speech',
    label: 'Speech & Intent',
    sublabel: 'ASR & Extraction',
    icon: Mic,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    sublabel: 'Execution & History',
    icon: Activity,
  },
  {
    id: 'audit',
    label: 'Audit Ledger',
    sublabel: 'Cryptographic Trail',
    icon: FileCheck,
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    sublabel: 'Hardware & Microservices',
    icon: Cpu,
  },
];

export const Sidebar: React.FC = () => {
  const { state, dispatch } = useApp();
  const { currentTab, sidebarCollapsed, metrics } = state;

  return (
    <aside
      className={`relative flex flex-col bg-[#0D252B] border-r border-[#29434A] transition-all duration-300 z-30 select-none ${
        sidebarCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#29434A]">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded bg-[#12343B] border border-[#FF642D]/40 text-[#FF642D] font-black text-xl font-display tracking-wider">
              0Hz
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-base text-[#F4F3EF] tracking-wider">
                ZEROHERTZ
              </span>
              <span className="text-[10px] font-mono text-[#FF642D] tracking-widest uppercase">
                Acoustic Defense Net
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex items-center justify-center w-10 h-10 rounded bg-[#12343B] border border-[#FF642D]/40 text-[#FF642D] font-black text-lg font-display">
            0Hz
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className={`p-1.5 rounded text-[#9AAEB1] hover:text-[#F4F3EF] hover:bg-[#12343B] border border-transparent hover:border-[#29434A] transition-colors ${
            sidebarCollapsed ? 'hidden' : 'block'
          }`}
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const hasPending = item.id === 'transactions' && metrics.pending_confirmation_count > 0;

          return (
            <button
              key={item.id}
              onClick={() => dispatch({ type: 'SET_TAB', payload: item.id })}
              title={sidebarCollapsed ? `${item.label} - ${item.sublabel}` : undefined}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded text-left transition-all relative group ${
                isActive
                  ? 'bg-[#12343B] text-[#FF642D] border border-[#FF642D]/40 shadow-[inset_0_1px_0_0_rgba(255,100,45,0.2)]'
                  : 'text-[#9AAEB1] hover:text-[#F4F3EF] hover:bg-[#12343B]/60 border border-transparent'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FF642D] rounded-r" />
              )}
              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive ? 'text-[#FF642D]' : 'text-[#9AAEB1] group-hover:text-[#F4F3EF]'
                }`}
              />
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide truncate">
                      {item.label}
                    </span>
                    {hasPending && (
                      <span className="flex items-center gap-1 text-[10px] font-mono bg-[#FF642D]/20 text-[#FF642D] px-1.5 py-0.2 rounded border border-[#FF642D]/50 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        {metrics.pending_confirmation_count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9AAEB1]/80 truncate block">
                    {item.sublabel}
                  </span>
                </div>
              )}

              {sidebarCollapsed && hasPending && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF642D] animate-ping" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle for collapsed state */}
      {sidebarCollapsed && (
        <div className="p-2 border-t border-[#29434A] flex justify-center">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-2 rounded text-[#9AAEB1] hover:text-[#F4F3EF] hover:bg-[#12343B] border border-transparent hover:border-[#29434A] transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer System Status Badge */}
      <div className="p-3 border-t border-[#29434A] bg-[#07191D]/50">
        {!sidebarCollapsed ? (
          <div className="text-[10px] font-mono text-[#9AAEB1] space-y-1">
            <div className="flex justify-between items-center">
              <span>SECURITY LEVEL</span>
              <span className="text-[#22C55E]">AIR-GAPPED 0Hz</span>
            </div>
            <div className="flex justify-between items-center">
              <span>FREQUENCY BAND</span>
              <span className="text-[#FF642D]">697 - 1633 Hz</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Security: Air-gapped 0Hz">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
          </div>
        )}
      </div>
    </aside>
  );
};
