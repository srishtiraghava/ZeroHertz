import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionStatus } from '../../types';
import { useApi } from '../../hooks/useApi';
import { StatusBadge } from '../common/StatusBadge';
import { TransactionDetail } from './TransactionDetail';
import {
  formatDateTime,
  formatTelemetryTime,
  redactSensitive,
} from '../../utils/format';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  Lock,
} from 'lucide-react';

export const TransactionHistory: React.FC = () => {
  const { getTransactions, loading } = useApi();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Filters & Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const fetchTx = async () => {
    try {
      const data = await getTransactions();
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTx();
  }, []);

  // Filter & Sort
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesId = tx.id.toLowerCase().includes(q);
          const matchesSession = tx.session_id.toLowerCase().includes(q);
          const matchesService = tx.service_type.toLowerCase().includes(q);
          const matchesRecipient = tx.recipient ? tx.recipient.toLowerCase().includes(q) : false;
          if (!matchesId && !matchesSession && !matchesService && !matchesRecipient) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== 'all' && tx.status !== statusFilter) {
          return false;
        }

        // Service filter
        if (serviceFilter !== 'all' && tx.service_type !== serviceFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [transactions, searchQuery, statusFilter, serviceFilter, sortOrder]);

  // Unique services for dropdown
  const uniqueServices = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.service_type) set.add(tx.service_type);
    });
    return Array.from(set);
  }, [transactions]);

  // Pagination slice
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="bg-[#0D252B] border border-[#29434A] rounded p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#29434A] pb-4">
        <div>
          <h3 className="font-display text-base text-[#F4F3EF] tracking-wider uppercase">
            Transaction History & Air-Gapped Verification Ledger
          </h3>
          <p className="text-xs text-[#9AAEB1] font-mono mt-0.5">
            GET /api/transactions — All citizen identifiers cryptographically masked
          </p>
        </div>

        <button
          onClick={fetchTx}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#12343B] hover:bg-[#12343B]/80 text-[#9AAEB1] hover:text-[#F4F3EF] text-xs font-mono border border-[#29434A] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#9AAEB1]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search TX ID, Session, Service..."
            className="w-full bg-[#07191D] border border-[#29434A] rounded pl-8 pr-3 py-2 text-[#F4F3EF] placeholder-[#9AAEB1]/50 focus:outline-none focus:border-[#FF642D]"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 bg-[#07191D] border border-[#29434A] rounded px-3 py-2">
          <Filter className="w-3.5 h-3.5 text-[#9AAEB1]" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-[#F4F3EF] outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0D252B]">ALL STATUSES</option>
            <option value="completed" className="bg-[#0D252B]">COMPLETED</option>
            <option value="pending" className="bg-[#0D252B]">PENDING</option>
            <option value="in_progress" className="bg-[#0D252B]">IN PROGRESS</option>
            <option value="failed" className="bg-[#0D252B]">FAILED</option>
            <option value="rejected" className="bg-[#0D252B]">REJECTED</option>
          </select>
        </div>

        {/* Service Filter */}
        <div className="flex items-center gap-1.5 bg-[#07191D] border border-[#29434A] rounded px-3 py-2">
          <Layers className="w-3.5 h-3.5 text-[#9AAEB1]" />
          <select
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-[#F4F3EF] outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0D252B]">ALL SERVICES</option>
            {uniqueServices.map((svc) => (
              <option key={svc} value={svc} className="bg-[#0D252B]">
                {svc.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order */}
        <button
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="flex items-center justify-between bg-[#07191D] border border-[#29434A] hover:border-[#FF642D]/60 rounded px-3 py-2 text-[#9AAEB1] hover:text-[#F4F3EF] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#FF642D]" />
            Sort by Time
          </span>
          <span className="font-bold text-[#FF642D] uppercase">{sortOrder}</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-[#29434A]">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-[#07191D] text-[#9AAEB1] border-b border-[#29434A] uppercase text-[10px] tracking-wider select-none">
            <tr>
              <th className="py-3 px-3">Transaction ID</th>
              <th className="py-3 px-3">Session</th>
              <th className="py-3 px-3">Service</th>
              <th className="py-3 px-3">Citizen ID (Masked)</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Created At</th>
              <th className="py-3 px-3">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#29434A]/50 bg-[#0D252B]">
            {loading && transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#9AAEB1]">
                  Loading transactions from database...
                </td>
              </tr>
            ) : paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#9AAEB1]">
                  No transaction records matched the active filter criteria.
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="hover:bg-[#12343B] transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-3 text-[#FF642D] font-bold group-hover:underline">
                    {tx.id}
                  </td>
                  <td className="py-3 px-3 text-[#9AAEB1]">{tx.session_id.slice(0, 10)}</td>
                  <td className="py-3 px-3 text-[#F4F3EF] uppercase font-semibold">
                    {tx.service_type}
                  </td>
                  <td className="py-3 px-3 text-[#9AAEB1] flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#22C55E]" />
                    {redactSensitive(tx.citizen_id || '982348194481')}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="py-3 px-3 text-[#9AAEB1]">
                    {formatDateTime(tx.created_at)}
                  </td>
                  <td className="py-3 px-3 text-[#22C55E] font-bold">
                    {tx.receipt_id || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-2 text-xs font-mono text-[#9AAEB1]">
        <div>
          Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded bg-[#07191D] border border-[#29434A] hover:bg-[#12343B] text-[#9AAEB1] hover:text-[#F4F3EF] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page <strong className="text-[#F4F3EF]">{currentPage}</strong> of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded bg-[#07191D] border border-[#29434A] hover:bg-[#12343B] text-[#9AAEB1] hover:text-[#F4F3EF] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedTx && (
        <TransactionDetail
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
};
