import React from 'react';
import { Transaction } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import {
  formatDateTime,
  formatTelemetryTime,
  redactSensitive,
} from '../../utils/format';
import {
  X,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Lock,
} from 'lucide-react';

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export const TransactionDetail: React.FC<TransactionDetailProps> = ({
  transaction,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#0D252B] border border-[#29434A] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#29434A] bg-[#07191D]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FF642D]" />
            <h3 className="font-display text-base text-[#F4F3EF] tracking-wider uppercase">
              Transaction Details & Security Audit
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#9AAEB1] hover:text-[#F4F3EF] hover:bg-[#12343B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 font-mono text-xs">
          {/* Top Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#07191D] p-3.5 rounded border border-[#29434A]">
            <div>
              <span className="text-[#9AAEB1] block text-[10px] uppercase">Transaction ID</span>
              <span className="text-[#F4F3EF] font-bold text-sm">{transaction.id}</span>
            </div>
            <div>
              <span className="text-[#9AAEB1] block text-[10px] uppercase">Session ID</span>
              <span className="text-[#FF642D] font-bold text-sm">{transaction.session_id}</span>
            </div>
            <div>
              <span className="text-[#9AAEB1] block text-[10px] uppercase">Service Name</span>
              <span className="text-[#F4F3EF] uppercase font-bold">{transaction.service_type}</span>
            </div>
            <div>
              <span className="text-[#9AAEB1] block text-[10px] uppercase">Transaction Status</span>
              <StatusBadge status={transaction.status} />
            </div>
          </div>

          {/* Privacy & Redacted Data */}
          <div className="bg-[#07191D] p-3.5 rounded border border-[#29434A] space-y-2">
            <div className="flex items-center gap-1.5 text-[#22C55E] text-[11px] font-bold uppercase">
              <Lock className="w-3.5 h-3.5" />
              Citizen Data Redaction & Masking (Zero-Knowledge Ingest)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
              <div>
                <span className="text-[#9AAEB1] block text-[10px]">CITIZEN ID / AADHAAR</span>
                <span className="text-[#F4F3EF]">{redactSensitive(transaction.citizen_id || '982348194481')}</span>
              </div>
              <div>
                <span className="text-[#9AAEB1] block text-[10px]">ACCOUNT / REF</span>
                <span className="text-[#F4F3EF]">{redactSensitive(transaction.account_number || '4029104819')}</span>
              </div>
              <div>
                <span className="text-[#9AAEB1] block text-[10px]">PHONE</span>
                <span className="text-[#F4F3EF]">{redactSensitive(transaction.phone_number || '9876543210')}</span>
              </div>
            </div>
          </div>

          {/* Timestamps & Tokens */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#07191D] p-3 rounded border border-[#29434A]">
            <div>
              <span className="text-[#9AAEB1] block text-[10px]">INITIATED AT</span>
              <span className="text-[#F4F3EF] text-[11px]">{formatDateTime(transaction.created_at)}</span>
            </div>
            <div>
              <span className="text-[#9AAEB1] block text-[10px]">COMPLETED AT</span>
              <span className="text-[#F4F3EF] text-[11px]">
                {transaction.completed_at ? formatDateTime(transaction.completed_at) : '—'}
              </span>
            </div>
            <div>
              <span className="text-[#9AAEB1] block text-[10px]">RECEIPT ID</span>
              <span className="text-[#22C55E] font-bold text-[11px]">
                {transaction.receipt_id || 'RCPT-PENDING'}
              </span>
            </div>
          </div>

          {/* Transaction Parameters & Details */}
          {transaction.details && Object.keys(transaction.details).length > 0 && (
            <div className="bg-[#07191D] p-3 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1] block text-[10px] uppercase mb-1.5">
                Parameters & Execution Payload
              </span>
              <pre className="text-[11px] text-[#22C55E] bg-[#0D252B] p-2.5 rounded border border-[#29434A] overflow-x-auto max-h-40">
                {JSON.stringify(transaction.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Chronological Event Log */}
          <div className="space-y-2">
            <span className="text-[#9AAEB1] block text-[10px] uppercase font-bold">
              Execution Event History ({transaction.events ? transaction.events.length : 0})
            </span>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {transaction.events && transaction.events.length > 0 ? (
                transaction.events.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-[#07191D] p-2 rounded border border-[#29434A] text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF642D]" />
                      <span className="text-[#F4F3EF] font-bold">{ev.step}</span>
                      {ev.detail && <span className="text-[#9AAEB1]">— {ev.detail}</span>}
                    </div>
                    <span className="text-[#9AAEB1] text-[10px]">
                      {formatTelemetryTime(ev.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-3 text-[#9AAEB1] text-xs">
                  No intermediate event records found for this transaction.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#29434A] bg-[#07191D] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#12343B] hover:bg-[#12343B]/80 text-[#F4F3EF] text-xs font-mono font-bold transition-colors border border-[#29434A]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
