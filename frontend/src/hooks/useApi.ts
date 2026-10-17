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

  // Transactions
  const getTransactions = useCallback(async (): Promise<Transaction[]> => {
    return await fetchWithHandling('/api/transactions');
  }, []);

  // Audit Ledger
  const getAuditLogs = useCallback(async (): Promise<AuditLogEntry[]> => {
    return await fetchWithHandling('/api/audit');
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
      intent: ParsedIntent;
      workflow_stage: string;
      workflow_step: number;
      message?: string;
    }> => {
      return await fetchWithHandling('/api/execute-intent', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
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
          pcm_base64: base64PCM,
          sample_rate: sampleRate,
          bit_depth: 16,
        }),
      });
    },
    []
  );

  // Cancel Session
  const cancelSession = useCallback(async (sessionId: string) => {
    return await fetchWithHandling('/api/session/cancel', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }, []);

  // Retry Session
  const retrySession = useCallback(async (sessionId: string) => {
    return await fetchWithHandling('/api/session/retry', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
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
