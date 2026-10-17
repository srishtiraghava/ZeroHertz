import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { WebSocketEvent, ConnectionState } from '../types';

export function useWebSocket() {
  const { state, dispatch } = useApp();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isUnmountedRef = useRef<boolean>(false);

  const getWsUrl = () => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the Vite proxy or direct host
    return `${protocol}//${loc.host}/ws/command-center`;
  };

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    
    // Close existing connection if any
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        // ignore
      }
    }

    dispatch({ type: 'SET_WS_STATE', payload: 'connecting' });

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        reconnectAttemptsRef.current = 0;
        dispatch({ type: 'SET_WS_STATE', payload: 'connected' });
        // Send initial handshake / subscribe
        ws.send(JSON.stringify({ type: 'subscribe', client: 'command-center' }));
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          
          // Log event
          dispatch({ type: 'ADD_WS_EVENT', payload: data });

          // Handle event types
          switch (data.type) {
            case 'status':
              if (data.payload?.metrics) {
                dispatch({ type: 'UPDATE_METRICS', payload: data.payload.metrics });
              }
              if (data.payload?.acoustic_engine_state) {
                dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: data.payload.acoustic_engine_state });
              }
              break;

            case 'session_update':
              if (data.payload?.session) {
                dispatch({ type: 'SET_ACTIVE_SESSION', payload: data.payload.session });
              }
              break;

            case 'workflow_update':
              if (data.payload) {
                dispatch({
                  type: 'UPDATE_SESSION',
                  payload: {
                    workflow_stage: data.payload.stage || data.payload.workflow_stage,
                    workflow_step: data.payload.step !== undefined ? data.payload.step : data.payload.workflow_step,
                    state: data.payload.state || 'automating',
                    automation_log: data.payload.log_line 
                      ? [...(state.activeSession?.automation_log || []), data.payload.log_line]
                      : state.activeSession?.automation_log || [],
                  },
                });
              }
              break;

            case 'dtmf_detected':
              if (data.payload) {
                dispatch({ type: 'ADD_DTMF_DETECTION', payload: data.payload });
                if (state.activeSession) {
                  dispatch({
                    type: 'UPDATE_SESSION',
                    payload: {
                      acoustic_confirmation: {
                        ...state.activeSession.acoustic_confirmation,
                        received_code: data.payload.symbol,
                        confidence: data.payload.confidence,
                        timestamp: data.timestamp || new Date().toISOString(),
                      },
                    },
                  });
                }
              }
              break;

            case 'confirmation_requested':
              if (data.payload) {
                dispatch({
                  type: 'UPDATE_SESSION',
                  payload: {
                    state: 'awaiting_confirmation',
                    workflow_stage: 'Awaiting confirmation',
                    workflow_step: 4,
                    acoustic_confirmation: {
                      expected_symbol: data.payload.expected_code || data.payload.code || '5',
                    },
                  },
                });
                dispatch({
                  type: 'UPDATE_METRICS',
                  payload: {
                    pending_confirmation_count: (state.metrics.pending_confirmation_count || 0) + 1,
                  },
                });
              }
              break;

            case 'confirmation_verified':
              if (data.payload) {
                dispatch({
                  type: 'UPDATE_SESSION',
                  payload: {
                    state: 'confirmed',
                    workflow_stage: 'Confirmation verified',
                    workflow_step: 5,
                    acoustic_confirmation: {
                      ...state.activeSession?.acoustic_confirmation,
                      verified: true,
                      code: data.payload.code,
                      confidence: data.payload.confidence,
                    },
                  },
                });
                dispatch({
                  type: 'UPDATE_METRICS',
                  payload: {
                    pending_confirmation_count: Math.max(0, (state.metrics.pending_confirmation_count || 1) - 1),
                  },
                });
              }
              break;

            case 'transaction_completed':
              if (data.payload) {
                dispatch({
                  type: 'UPDATE_SESSION',
                  payload: {
                    state: 'completed',
                    workflow_stage: 'Submission completed',
                    workflow_step: 7,
                    portal_preview_url: data.payload.receipt_url || state.activeSession?.portal_preview_url,
                  },
                });
                dispatch({
                  type: 'UPDATE_METRICS',
                  payload: {
                    completed_transactions: (state.metrics.completed_transactions || 0) + 1,
                  },
                });
              }
              break;

            case 'transaction_failed':
              if (data.payload) {
                dispatch({
                  type: 'UPDATE_SESSION',
                  payload: {
                    state: 'failed',
                    workflow_stage: 'Idle',
                    error_message: data.payload.reason || data.payload.error || 'Transaction rejected',
                  },
                });
                dispatch({
                  type: 'UPDATE_METRICS',
                  payload: {
                    failed_rejected_transactions: (state.metrics.failed_rejected_transactions || 0) + 1,
                  },
                });
              }
              break;

            case 'heartbeat':
              // Keep-alive acknowledge
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
              }
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WS] Error:', err);
        dispatch({ type: 'SET_WS_STATE', payload: 'error' });
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        dispatch({ type: 'SET_WS_STATE', payload: 'disconnected' });
        
        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (e) {
      console.error('[WS] Connection exception:', e);
      dispatch({ type: 'SET_WS_STATE', payload: 'error' });
    }
  }, [dispatch, state.activeSession, state.metrics]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const send = useCallback((msg: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  return {
    wsState: state.wsState,
    send,
    reconnect: connect,
  };
}
