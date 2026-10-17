/**
 * Formatting and data sanitization utilities
 */

/**
 * Redact citizen ID, Aadhaar, account numbers, or phones.
 * Keeps only the last 4 digits visible.
 */
export function redactSensitive(value: string | number | undefined | null): string {
  if (!value) return '—';
  const str = String(value).trim();
  if (str.length <= 4) {
    return '•••• ' + str;
  }
  const last4 = str.slice(-4);
  const hiddenCount = Math.min(str.length - 4, 12);
  const hiddenPart = '•'.repeat(hiddenCount);
  return `${hiddenPart} ${last4}`;
}

/**
 * Format ISO or Unix timestamp to high-precision telemetry string (HH:mm:ss.SSS)
 */
export function formatTelemetryTime(timestamp: string | number | Date | undefined | null): string {
  if (!timestamp) return '--:--:--.---';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return String(timestamp);
  
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/**
 * Format date and time for logs and audit table
 */
export function formatDateTime(timestamp: string | number | Date | undefined | null): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return String(timestamp);

  const pad = (n: number) => ('0' + n).slice(-2);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const mins = pad(date.getMinutes());
  const secs = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/**
 * Format frequency with Hz / kHz unit
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(3)} kHz`;
  }
  return `${hz.toFixed(0)} Hz`;
}

/**
 * Format confidence percentage
 */
export function formatConfidence(conf: number | undefined | null): string {
  if (conf === undefined || conf === null) return '0.0%';
  const val = conf <= 1 ? conf * 100 : conf;
  return `${val.toFixed(1)}%`;
}

/**
 * Truncate long hash strings (e.g. SHA-256)
 */
export function formatHash(hash: string | undefined | null, length = 12): string {
  if (!hash) return '—';
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length / 2)}…${hash.slice(-length / 2)}`;
}
