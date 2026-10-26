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
      className={`relative z-30 flex h-full shrink-0 flex-col border-r border-[#dce3df] bg-white transition-[width] duration-200 select-none ${
        sidebarCollapsed ? 'w-16' : 'w-16 sm:w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-[#dce3df] px-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#dce3df] bg-[#f0f3ef] font-display text-lg font-bold text-[#39736b]">
            0Hz
          </div>
          {!sidebarCollapsed && (
            <div className="hidden min-w-0 flex-col sm:flex">
              <span className="font-display font-bold text-base text-[#20312e] tracking-wider">
                ZEROHERTZ
              </span>
              <span className="truncate text-[10px] font-medium text-[#667773]">
                Telecom operations
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className={`hidden rounded-md p-1.5 text-[#667773] transition-colors hover:bg-[#f0f3ef] hover:text-[#20312e] sm:block ${
            sidebarCollapsed ? 'sm:hidden' : ''
          }`}
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation List */}
      <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const hasPending = item.id === 'transactions' && metrics.pending_confirmation_count > 0;

          return (
            <button
              key={item.id}
              onClick={() => dispatch({ type: 'SET_TAB', payload: item.id })}
              title={sidebarCollapsed ? `${item.label} - ${item.sublabel}` : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? 'bg-[#edf3f0] text-[#285f57]'
                  : 'text-[#667773] hover:bg-[#f4f5f2] hover:text-[#20312e]'
              }`}
            >
              {isActive && (
                <div className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-[#39736b]" />
              )}
              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive ? 'text-[#39736b]' : 'text-[#87958f] group-hover:text-[#20312e]'
                }`}
              />
              {!sidebarCollapsed && (
                <div className="hidden min-w-0 flex-1 sm:block">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide truncate">
                      {item.label}
                    </span>
                    {hasPending && (
                      <span className="flex items-center gap-1 rounded bg-[#f8ede8] px-1.5 py-0.5 text-[10px] font-medium text-[#a94c2e]">
                        <ShieldAlert className="w-3 h-3" />
                        {metrics.pending_confirmation_count}
                      </span>
                    )}
                  </div>
                  <span className="block truncate text-[10px] text-[#87958f]">
                    {item.sublabel}
                  </span>
                </div>
              )}

              {sidebarCollapsed && hasPending && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#bd5e3b]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle for collapsed state */}
      {sidebarCollapsed && (
        <div className="p-2 border-t border-[#dce3df] flex justify-center">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="hidden rounded-md p-2 text-[#667773] transition-colors hover:bg-[#f0f3ef] hover:text-[#20312e] sm:block"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer System Status Badge */}
      <div className="border-t border-[#dce3df] bg-[#fafbf9] p-3">
        {!sidebarCollapsed ? (
          <div className="hidden space-y-1 text-[10px] text-[#667773] sm:block">
            <div className="flex justify-between items-center">
              <span>SECURITY LEVEL</span>
              <span className="text-[#28734f]">AIR-GAPPED 0Hz</span>
            </div>
            <div className="flex justify-between items-center">
              <span>FREQUENCY BAND</span>
              <span className="text-[#bd5e3b]">697 - 1633 Hz</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Security: Air-gapped 0Hz">
            <div className="w-2.5 h-2.5 rounded-full bg-[#28734f]" />
          </div>
        )}
      </div>
    </aside>
  );
};
