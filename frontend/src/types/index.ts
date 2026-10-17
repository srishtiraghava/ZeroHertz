// Navigation
export type NavigationTab = 
  | 'overview' 
  | 'acoustic' 
  | 'speech' 
  | 'transactions' 
  | 'audit' 
  | 'diagnostics';

// States
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
export type MicrophoneState = 'prompt' | 'granted' | 'denied' | 'inactive' | 'active' | 'error';
export type AcousticEngineState = 'idle' | 'listening' | 'decoding' | 'transmitting' | 'error';

export type SessionWorkflowStage = 
  | 'Request received'
  | 'Intent parsed'
  | 'Portal opened'
  | 'Fields populated'
  | 'Awaiting confirmation'
  | 'Confirmation verified'
  | 'Submission completed'
  | 'Receipt available'
  | 'Idle';

export type SessionState = 
  | 'idle'
  | 'listening'
  | 'parsing'
  | 'automating'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type InputChannel = 'speech' | 'acoustic_dtmf' | 'manual' | 'api';

export interface ParsedIntent {
  service: string;
  language: 'hi' | 'en' | string;
  action?: string;
  parameters: Record<string, any>;
  confidence: number;
  schema_valid: boolean;
  validation_errors?: string[];
  raw_text?: string;
}

export interface AcousticConfirmation {
  code?: string;
  received_code?: string;
  verified?: boolean;
  timestamp?: string;
  confidence?: number;
  expected_symbol?: string;
}

export interface SessionData {
  id: string;
  state: SessionState;
  input_channel: InputChannel;
  transcript: string;
  intent: ParsedIntent | null;
  workflow_stage: SessionWorkflowStage;
  workflow_step: number; // 0 to 8
  acoustic_confirmation: AcousticConfirmation | null;
  portal_preview_url?: string;
  automation_log: string[];
  created_at: string;
  updated_at: string;
  error_message?: string;
}

// WebSocket Event
export interface WebSocketEvent {
  type: 
    | 'status' 
    | 'session_update' 
    | 'workflow_update' 
    | 'dtmf_detected' 
    | 'intent_parsed' 
    | 'portal_event' 
    | 'confirmation_requested' 
    | 'confirmation_verified' 
    | 'transaction_completed' 
    | 'transaction_failed' 
    | 'audit_log' 
    | 'error' 
    | 'heartbeat';
  timestamp: string;
  session_id?: string;
  payload: any;
}

// Metrics
export interface SystemMetrics {
  acoustic_engine_state: AcousticEngineState;
  mic_connection_state: MicrophoneState;
  backend_state: ConnectionState;
  pending_confirmation_count: number;
  total_sessions: number;
  completed_transactions: number;
  failed_rejected_transactions: number;
}

// DTMF
export type DTMFSymbol = 
  | '1' | '2' | '3' | 'A'
  | '4' | '5' | '6' | 'B'
  | '7' | '8' | '9' | 'C'
  | '*' | '0' | '#' | 'D';

export interface DTMFDetection {
  symbol: DTMFSymbol;
  row_freq: number;
  col_freq: number;
  confidence: number;
  duration_ms: number;
  timestamp: string;
  energy_snr?: number;
}

export interface DTMFTransmitterConfig {
  tone_duration_ms: number;
  silence_interval_ms: number;
}

// Transactions
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'rejected' | 'in_progress';

export interface TransactionEvent {
  timestamp: string;
  step: string;
  status: 'info' | 'success' | 'warning' | 'error';
  detail?: string;
}

export interface Transaction {
  id: string;
  session_id: string;
  service_type: string;
  citizen_id?: string; // sensitive
  account_number?: string; // sensitive
  phone_number?: string; // sensitive
  recipient?: string;
  amount?: string | number;
  details: Record<string, any>;
  status: TransactionStatus;
  created_at: string;
  completed_at?: string;
  receipt_id?: string;
  confirmation_token?: string;
  events: TransactionEvent[];
}

// Audit Ledger
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  session_id: string;
  event_type: string;
  packet_hash: string;
  verification_outcome: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'REJECTED';
  portal_action: string;
  transaction_outcome: string;
  payload?: Record<string, any>;
}

// Diagnostics
export interface AIProviderConfig {
  provider: string;
  model: string;
  status: 'configured' | 'missing_keys' | 'Unknown';
}

export interface DSPConfig {
  sample_rate: number;
  fft_size: number;
  tone_detection_threshold: number;
  goertzel_enabled: boolean;
  status: string;
}

export interface DiagnosticError {
  timestamp: string;
  module: string;
  message: string;
}

export interface SystemDiagnosticsData {
  api_health: 'healthy' | 'degraded' | 'down' | 'Unknown';
  db_connectivity: 'connected' | 'error' | 'Unknown';
  websocket: 'connected' | 'disconnected' | 'Unknown';
  mic_support: 'supported' | 'unsupported' | 'Unknown';
  speech_recognition_support: 'supported' | 'unsupported' | 'Unknown';
  playwright_status: 'ready' | 'launching' | 'error' | 'Unknown';
  ai_provider_config: AIProviderConfig;
  dsp_config: DSPConfig;
  latest_errors: DiagnosticError[];
}

// Preset Scenario
export interface PresetScenario {
  id: string;
  title: string;
  service: string;
  language: 'hi-IN' | 'en-IN';
  transcript: string;
  parameters: Record<string, any>;
  description: string;
}
