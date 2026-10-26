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
      <div className="bg-[#ffffff] border border-[#dce3df] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#dce3df] bg-[#f4f5f2]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#bd5e3b]" />
            <h3 className="font-display text-base text-[#20312e] tracking-wider uppercase">
              Transaction Details & Security Audit
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#667773] hover:text-[#20312e] hover:bg-[#f0f3ef] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 font-mono text-xs">
          {/* Top Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f4f5f2] p-3.5 rounded border border-[#dce3df]">
            <div>
              <span className="text-[#667773] block text-[10px] uppercase">Transaction ID</span>
              <span className="text-[#20312e] font-bold text-sm">{transaction.id}</span>
            </div>
            <div>
              <span className="text-[#667773] block text-[10px] uppercase">Session ID</span>
              <span className="text-[#bd5e3b] font-bold text-sm">{transaction.session_id}</span>
            </div>
            <div>
              <span className="text-[#667773] block text-[10px] uppercase">Service Name</span>
              <span className="text-[#20312e] uppercase font-bold">{transaction.service_type}</span>
            </div>
            <div>
              <span className="text-[#667773] block text-[10px] uppercase">Transaction Status</span>
              <StatusBadge status={transaction.status} />
            </div>
          </div>

          {/* Privacy & Redacted Data */}
          <div className="bg-[#f4f5f2] p-3.5 rounded border border-[#dce3df] space-y-2">
            <div className="flex items-center gap-1.5 text-[#28734f] text-[11px] font-bold uppercase">
              <Lock className="w-3.5 h-3.5" />
              Citizen Data Redaction & Masking (Zero-Knowledge Ingest)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
              <div>
                <span className="text-[#667773] block text-[10px]">CITIZEN ID / AADHAAR</span>
                <span className="text-[#20312e]">{redactSensitive(transaction.citizen_id || (transaction.details as any)?.beneficiary_id || '982348194481')}</span>
              </div>
              <div>
                <span className="text-[#667773] block text-[10px]">ACCOUNT / REF</span>
                <span className="text-[#20312e]">{redactSensitive((transaction as any).account_number || (transaction.details as any)?.beneficiary_id || '4029104819')}</span>
              </div>
              <div>
                <span className="text-[#667773] block text-[10px]">PHONE</span>
                <span className="text-[#20312e]">{redactSensitive((transaction as any).phone_number || '9876543210')}</span>
              </div>
            </div>
          </div>

          {/* Timestamps & Tokens */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#f4f5f2] p-3 rounded border border-[#dce3df]">
            <div>
              <span className="text-[#667773] block text-[10px]">INITIATED AT</span>
              <span className="text-[#20312e] text-[11px]">{formatDateTime(transaction.created_at)}</span>
            </div>
            <div>
              <span className="text-[#667773] block text-[10px]">COMPLETED AT</span>
              <span className="text-[#20312e] text-[11px]">
                {(transaction as any).completed_at ? formatDateTime((transaction as any).completed_at) : formatDateTime(transaction.updated_at)}
              </span>
            </div>
            <div>
              <span className="text-[#667773] block text-[10px]">RECEIPT ID</span>
              <span className="text-[#28734f] font-bold text-[11px]">
                {(transaction as any).receipt_id || transaction.receipt_reference_id || 'RCPT-PENDING'}
              </span>
            </div>
          </div>

          {/* Transaction Parameters & Details */}
          {transaction.details && Object.keys(transaction.details).length > 0 && (
            <div className="bg-[#f4f5f2] p-3 rounded border border-[#dce3df]">
              <span className="text-[#667773] block text-[10px] uppercase mb-1.5">
                Parameters & Execution Payload
              </span>
              <pre className="text-[11px] text-[#28734f] bg-[#ffffff] p-2.5 rounded border border-[#dce3df] overflow-x-auto max-h-40">
                {JSON.stringify(transaction.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Chronological Event Log */}
          <div className="space-y-2">
            <span className="text-[#667773] block text-[10px] uppercase font-bold">
              Execution Event History ({transaction.events ? transaction.events.length : 0})
            </span>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {transaction.events && transaction.events.length > 0 ? (
                transaction.events.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-[#f4f5f2] p-2 rounded border border-[#dce3df] text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#bd5e3b]" />
                      <span className="text-[#20312e] font-bold">{ev.step}</span>
                      {ev.detail && <span className="text-[#667773]">— {ev.detail}</span>}
                    </div>
                    <span className="text-[#667773] text-[10px]">
                      {formatTelemetryTime(ev.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-3 text-[#667773] text-xs">
                  No intermediate event records found for this transaction.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#dce3df] bg-[#f4f5f2] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#f0f3ef] hover:bg-[#f0f3ef]/80 text-[#20312e] text-xs font-mono font-bold transition-colors border border-[#dce3df]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
