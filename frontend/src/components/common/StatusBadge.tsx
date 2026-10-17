import React from 'react';

export type StatusVariant = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'neutral' 
  | 'accent';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  pulse?: boolean;
  className?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  pulse = false,
  className = '',
  showDot = true,
}) => {
  // Infer variant if not provided
  const normalized = status.toLowerCase();
  let computedVariant: StatusVariant = variant || 'neutral';

  if (!variant) {
    if (['connected', 'success', 'granted', 'active', 'healthy', 'ready', 'confirmed', 'completed'].includes(normalized)) {
      computedVariant = 'success';
    } else if (['connecting', 'pending', 'prompt', 'listening', 'awaiting_confirmation', 'in_progress', 'launching'].includes(normalized)) {
      computedVariant = 'warning';
    } else if (['error', 'disconnected', 'failed', 'rejected', 'denied', 'down', 'missing_keys'].includes(normalized)) {
      computedVariant = 'error';
    } else if (['transmitting', 'decoding', 'automating', 'parsing'].includes(normalized)) {
      computedVariant = 'accent';
    } else if (['idle', 'inactive', 'unknown', 'not tested'].includes(normalized)) {
      computedVariant = 'neutral';
    } else {
      computedVariant = 'info';
    }
  }

  const variantStyles: Record<StatusVariant, { bg: string; text: string; border: string; dot: string }> = {
    success: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-800/80',
      dot: 'bg-emerald-400',
    },
    warning: {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-800/80',
      dot: 'bg-amber-400',
    },
    error: {
      bg: 'bg-red-950/60',
      text: 'text-red-400',
      border: 'border-red-800/80',
      dot: 'bg-red-400',
    },
    info: {
      bg: 'bg-cyan-950/60',
      text: 'text-cyan-400',
      border: 'border-cyan-800/80',
      dot: 'bg-cyan-400',
    },
    accent: {
      bg: 'bg-[#FF642D]/15',
      text: 'text-[#FF642D]',
      border: 'border-[#FF642D]/50',
      dot: 'bg-[#FF642D]',
    },
    neutral: {
      bg: 'bg-[#12343B]/60',
      text: 'text-[#9AAEB1]',
      border: 'border-[#29434A]',
      dot: 'bg-[#9AAEB1]',
    },
  };

  const style = variantStyles[computedVariant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider uppercase border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`} />
        </span>
      )}
      <span>{status}</span>
    </span>
  );
};
