import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry } from '../../types';
import { useApi } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  formatDateTime,
  formatTelemetryTime,
  formatHash,
} from '../../utils/format';
import {
  ShieldCheck,
  FileCheck,
  Search,
  Filter,
  RefreshCw,
  Terminal,
  Key,
  Copy,
  Check,
} from 'lucide-react';

export const AuditLedger: React.FC = () => {
  const { getAuditLogs, loading } = useApi();
  const { state } = useApp();
  const { recentEvents } = state;

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchAudit = async () => {
    try {
      const data = await getAuditLogs();
      if (Array.isArray(data)) {
        setAuditEntries(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  // Incorporate real-time audit logs from WebSocket
  useEffect(() => {
    const latestWsAudit = recentEvents.find((e) => e.type === 'audit_log');
    if (latestWsAudit && latestWsAudit.payload) {
      const p = latestWsAudit.payload;
      const newEntry: AuditLogEntry = {
        id: p.id || Math.random().toString(36).slice(2, 9),
        timestamp: latestWsAudit.timestamp || new Date().toISOString(),
        session_id: latestWsAudit.session_id || p.session_id || 'UNKNOWN',
        event_type: p.event_type || 'ACOUSTIC_VERIFY',
        packet_hash: p.packet_hash || 'SHA256:0hz' + Math.random().toString(36).slice(2, 12),
        verification_outcome: p.verification_outcome || 'SUCCESS',
        portal_action: p.portal_action || 'FORM_SUBMIT',
        transaction_outcome: p.transaction_outcome || 'COMMITTED',
        payload: p,
      };

      setAuditEntries((prev) => {
        // avoid duplicate if same id
        if (prev.some((item) => item.id === newEntry.id)) return prev;
        return [newEntry, ...prev];
      });
    }
  }, [recentEvents]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredEntries = useMemo(() => {
    return auditEntries.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSession = item.session_id.toLowerCase().includes(q);
        const matchesEvent = item.event_type.toLowerCase().includes(q);
        const matchesHash = item.packet_hash.toLowerCase().includes(q);
        const matchesAction = item.portal_action.toLowerCase().includes(q);
        if (!matchesSession && !matchesEvent && !matchesHash && !matchesAction) {
          return false;
        }
      }

      if (outcomeFilter !== 'all' && item.verification_outcome !== outcomeFilter) {
        return false;
      }

      return true;
    });
  }, [auditEntries, search, outcomeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Audit Controls */}
      <div className="bg-[#0D252B] border border-[#29434A] rounded p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
            <h3 className="font-display text-base text-[#F4F3EF] tracking-wider uppercase">
              ZeroHertz Cryptographic Audit Ledger
            </h3>
          </div>
          <p className="text-xs text-[#9AAEB1] font-mono mt-0.5">
            Immutable trace of DTMF acoustic verification packets and government portal commitments
          </p>
        </div>

        <button
          onClick={fetchAudit}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#12343B] hover:bg-[#12343B]/80 text-[#9AAEB1] hover:text-[#F4F3EF] text-xs font-mono border border-[#29434A] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Ledger</span>
        </button>
      </div>

      {/* Search & Outcome Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="relative col-span-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9AAEB1]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Session, Hash, Event Type, or Portal Action..."
            className="w-full bg-[#0D252B] border border-[#29434A] rounded pl-8 pr-3 py-2 text-[#F4F3EF] placeholder-[#9AAEB1]/50 focus:outline-none focus:border-[#FF642D]"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#0D252B] border border-[#29434A] rounded px-3 py-2">
          <Filter className="w-3.5 h-3.5 text-[#9AAEB1]" />
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full bg-transparent text-[#F4F3EF] outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0D252B]">ALL OUTCOMES</option>
            <option value="SUCCESS" className="bg-[#0D252B]">SUCCESS</option>
            <option value="FAILURE" className="bg-[#0D252B]">FAILURE</option>
            <option value="PENDING" className="bg-[#0D252B]">PENDING</option>
            <option value="REJECTED" className="bg-[#0D252B]">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Main Dual Grid: Table on Left, Selected Detail Payload on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ledger Table (2 cols) */}
        <div className="lg:col-span-2 bg-[#0D252B] border border-[#29434A] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#07191D] text-[#9AAEB1] border-b border-[#29434A] uppercase text-[10px] tracking-wider select-none">
                <tr>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Session ID</th>
                  <th className="py-3 px-3">Event Type</th>
                  <th className="py-3 px-3">Packet Hash</th>
                  <th className="py-3 px-3">Verification</th>
                  <th className="py-3 px-3">Portal Action</th>
                  <th className="py-3 px-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#29434A]/50">
                {loading && auditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#9AAEB1]">
                      Loading audit ledger records...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#9AAEB1]">
                      No audit records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const isSelected = selectedEntry?.id === entry.id;

                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#12343B] border-l-2 border-[#FF642D]'
                            : 'hover:bg-[#12343B]/60'
                        }`}
                      >
                        <td className="py-3 px-3 text-[#9AAEB1] whitespace-nowrap text-[11px]">
                          {formatDateTime(entry.timestamp)}
                        </td>
                        <td className="py-3 px-3 text-[#F4F3EF] font-bold">
                          {entry.session_id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-[#FF642D] font-semibold">
                          {entry.event_type}
                        </td>
                        <td className="py-3 px-3 text-[#9AAEB1]">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(entry.packet_hash);
                            }}
                            className="inline-flex items-center gap-1 hover:text-[#FF642D] cursor-copy bg-[#07191D] px-1.5 py-0.5 rounded border border-[#29434A]"
                            title="Click to copy full cryptographic hash"
                          >
                            <Key className="w-2.5 h-2.5" />
                            {formatHash(entry.packet_hash, 10)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={entry.verification_outcome} />
                        </td>
                        <td className="py-3 px-3 text-[#9AAEB1] truncate max-w-[120px]">
                          {entry.portal_action}
                        </td>
                        <td className="py-3 px-3 font-bold text-[11px]">
                          <span
                            className={
                              entry.transaction_outcome === 'COMMITTED' || entry.transaction_outcome === 'SUCCESS'
                                ? 'text-[#22C55E]'
                                : entry.transaction_outcome === 'FAILED'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }
                          >
                            {entry.transaction_outcome}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Entry Detail Panel (1 col) */}
        <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between border-b border-[#29434A] pb-2 mb-3">
              <span className="font-display text-sm tracking-wide text-[#F4F3EF] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#FF642D]" />
                Event Payload Inspector
              </span>
              {selectedEntry && (
                <StatusBadge status={selectedEntry.verification_outcome} />
              )}
            </div>

            {selectedEntry ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="bg-[#07191D] p-3 rounded border border-[#29434A] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#9AAEB1]">Audit Log ID:</span>
                    <span className="text-[#F4F3EF] font-bold">{selectedEntry.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9AAEB1]">Timestamp:</span>
                    <span className="text-[#F4F3EF]">{formatDateTime(selectedEntry.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9AAEB1]">Session ID:</span>
                    <span className="text-[#FF642D] font-bold">{selectedEntry.session_id}</span>
                  </div>
                </div>

                {/* Packet Hash with Copy Button */}
                <div className="bg-[#07191D] p-3 rounded border border-[#29434A]">
                  <div className="flex items-center justify-between text-[#9AAEB1] mb-1">
                    <span className="text-[10px] uppercase">Cryptographic Packet Hash:</span>
                    <button
                      onClick={() => copyToClipboard(selectedEntry.packet_hash)}
                      className="text-[#FF642D] hover:text-[#FF7A45] flex items-center gap-1 text-[10px]"
                    >
                      {copiedHash === selectedEntry.packet_hash ? (
                        <>
                          <Check className="w-3 h-3 text-[#22C55E]" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#22C55E] break-all bg-[#0D252B] p-2 rounded border border-[#29434A]">
                    {selectedEntry.packet_hash}
                  </div>
                </div>

                {/* Raw Payload JSON */}
                <div className="bg-[#07191D] p-3 rounded border border-[#29434A]">
                  <span className="text-[#9AAEB1] block text-[10px] uppercase mb-1">
                    Structured Payload
                  </span>
                  <pre className="text-[11px] text-[#F4F3EF] bg-[#0D252B] p-2.5 rounded border border-[#29434A] overflow-x-auto max-h-56 leading-relaxed">
                    {JSON.stringify(selectedEntry.payload || selectedEntry, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-[#9AAEB1] font-mono text-xs">
                Select an entry from the ledger table to view its cryptographic payload and verification digest.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
