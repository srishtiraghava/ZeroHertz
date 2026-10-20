import { useState, useCallback } from 'react';
import {
  Transaction,
  AuditLogEntry,
  SystemDiagnosticsData,
  ParsedIntent,
  SystemMetrics,
} from '../types';
import { pcmToBase64 } from '../utils/audio';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithHandling = async (url: string, options?: RequestInit) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });

      if (!res.ok) {
        let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const body = await res.json();
          if (body.detail) errorDetail = body.detail;
          else if (body.message) errorDetail = body.message;
        } catch (e) {
          // ignore
        }
        throw new Error(errorDetail);
      }

      return await res.json();
    } catch (err: any) {
      const msg = err.message || 'API request failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const getMetrics = useCallback(async (): Promise<SystemMetrics> => {
    return await fetchWithHandling('/api/metrics');
  }, []);

  // Transactions — backend returns TransactionDetail array with transaction_id (not id)
  const getTransactions = useCallback(async (): Promise<Transaction[]> => {
    const data = await fetchWithHandling('/api/transactions');
    const rows = Array.isArray(data) ? data : [];
    return rows.map((t: any) => ({
      ...t,
      // Normalize transaction_id → id for frontend display
      id: t.transaction_id || t.id,
      // Parse payload_json to extract service_type, citizen_name, etc.
      service_type: (() => { try { return JSON.parse(t.payload_json || '{}').service_type || 'Unknown Service'; } catch { return 'Unknown Service'; } })(),
      details: (() => { try { return JSON.parse(t.payload_json || '{}'); } catch { return {}; } })(),
      citizen_id: (() => { try { return JSON.parse(t.payload_json || '{}').beneficiary_id || ''; } catch { return ''; } })(),
      // Normalize status to lowercase
      status: (t.status || 'pending').toLowerCase(),
      events: t.events || [],
    }));
  }, []);

  // Audit Ledger — backend returns AuditListResponse with .events array
  const getAuditLogs = useCallback(async (): Promise<AuditLogEntry[]> => {
    const res = await fetchWithHandling('/api/audit');
    // Backend wraps in { events: [], chain_valid: bool, total_records: int }
    const events = Array.isArray(res) ? res : (res?.events || []);
    // Normalize backend fields to our AuditLogEntry shape
    return events.map((e: any) => ({
      id: e.id,
      event_type: e.event_type,
      session_id: e.session_id || 'SYSTEM',
      payload_json: e.payload_json || '{}',
      prev_hash: e.prev_hash || '',
      current_hash: e.current_hash || '',
      timestamp: e.timestamp,
      // Derived convenience fields for display
      packet_hash: e.current_hash || e.packet_hash || '',
      verification_outcome: 'SUCCESS' as const,
      portal_action: e.event_type || 'AUDIT',
      transaction_outcome: 'COMMITTED',
      payload: (() => { try { return JSON.parse(e.payload_json || '{}'); } catch { return {}; } })(),
    }));
  }, []);

  // Diagnostics
  const getDiagnostics = useCallback(async (): Promise<SystemDiagnosticsData> => {
    return await fetchWithHandling('/api/diagnostics');
  }, []);

  // Submit Intent
  const executeIntent = useCallback(
    async (payload: {
      transcript: string;
      language: string;
      context?: Record<string, any>;
    }): Promise<{
      success: boolean;
      session_id: string;
      // Backend returns parsed_intent; we alias to intent for frontend convenience
      parsed_intent: ParsedIntent;
      intent: ParsedIntent;
      workflow_stage: string;
      workflow_step: number;
      message?: string;
      challenge_token?: string;
      expires_at?: string;
      portal_preview_url?: string;
    }> => {
      // Backend expects `prompt` not `transcript`
      const body = {
        prompt: payload.transcript,
        ...(payload.context || {}),
      };
      const raw = await fetchWithHandling('/api/execute-intent', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // Normalize: backend calls it parsed_intent, frontend calls it intent
      return {
        ...raw,
        intent: raw.parsed_intent || raw.intent,
        session_id: raw.session_id,
        workflow_stage: raw.status || 'INITIALIZED',
        workflow_step: 2,
        success: true,
      };
    },
    []
  );

  // Decode PCM
  const decodeDsp = useCallback(
    async (
      pcmData: Int16Array,
      sampleRate = 44100
    ): Promise<{
      detected: boolean;
      symbol?: string;
      row_freq?: number;
      col_freq?: number;
      confidence?: number;
      duration_ms?: number;
      raw_results?: any;
    }> => {
      const base64PCM = pcmToBase64(pcmData);
      return await fetchWithHandling('/api/dsp/decode', {
        method: 'POST',
        body: JSON.stringify({
          audio_base64: base64PCM,   // Backend field is audio_base64 not pcm_base64
          sample_rate: sampleRate,
          audio_format: 'pcm_s16le',
        }),
      });
    },
    []
  );

  // Cancel Session — backend uses path param: POST /api/sessions/{id}/cancel
  const cancelSession = useCallback(async (sessionId: string) => {
    return await fetchWithHandling(`/api/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
    });
  }, []);

  // Retry Session — restart workflow by re-executing the stored session intent
  const retrySession = useCallback(async (sessionId: string) => {
    return await fetchWithHandling(`/api/sessions/${encodeURIComponent(sessionId)}/retry`, {
      method: 'POST',
    });
  }, []);

  return {
    loading,
    error,
    getMetrics,
    getTransactions,
    getAuditLogs,
    getDiagnostics,
    executeIntent,
    decodeDsp,
    cancelSession,
    retrySession,
  };
}
