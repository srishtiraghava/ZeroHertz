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
      bg: 'bg-[#eaf3ed]',
      text: 'text-[#28734f]',
      border: 'border-transparent',
      dot: 'bg-[#28734f]',
    },
    warning: {
      bg: 'bg-[#f8f0e4]',
      text: 'text-[#8b5c1c]',
      border: 'border-transparent',
      dot: 'bg-[#a96c21]',
    },
    error: {
      bg: 'bg-[#f8ecea]',
      text: 'text-[#a63f37]',
      border: 'border-transparent',
      dot: 'bg-[#b3473e]',
    },
    info: {
      bg: 'bg-[#eaf1f3]',
      text: 'text-[#426c78]',
      border: 'border-transparent',
      dot: 'bg-[#426c78]',
    },
    accent: {
      bg: 'bg-[#f8ede8]',
      text: 'text-[#a94c2e]',
      border: 'border-transparent',
      dot: 'bg-[#bd5e3b]',
    },
    neutral: {
      bg: 'bg-[#f0f3ef]',
      text: 'text-[#667773]',
      border: 'border-transparent',
      dot: 'bg-[#87958f]',
    },
  };

  const style = variantStyles[computedVariant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={` absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`} />
        </span>
      )}
      <span>{status}</span>
    </span>
  );
};
