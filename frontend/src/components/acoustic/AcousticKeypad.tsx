import React, { useState } from 'react';
import { DTMFSymbol } from '../../types';
import { DTMF_GRID_ROWS, DTMF_MATRIX } from '../../utils/audio';
import { useDTMFTransmitter } from '../../hooks/useDTMFTransmitter';
import { formatTelemetryTime } from '../../utils/format';
import {
  Volume2,
  Sliders,
  Send,
  Square,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface AcousticKeypadProps {
  onTransmitted?: (symbol: DTMFSymbol) => void;
}

export const AcousticKeypad: React.FC<AcousticKeypadProps> = ({ onTransmitted }) => {
  const {
    config,
    setConfig,
    isTransmitting,
    activeSymbol,
    activeFrequencies,
    history,
    transmitKey,
    transmitSequence,
    stopSequence,
    clearHistory,
  } = useDTMFTransmitter();

  const [sequenceInput, setSequenceInput] = useState<string>('#5');

  const handleKeyPress = async (sym: DTMFSymbol) => {
    await transmitKey(sym);
    if (onTransmitted) onTransmitted(sym);
  };

  const handleSendSequence = async (seqToTransmit?: string) => {
    const seq = seqToTransmit || sequenceInput;
    if (!seq) return;
    await transmitSequence(seq);
  };

  return (
    <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29434A] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-[#FF642D]" />
          <h3 className="font-display text-sm tracking-wide text-[#F4F3EF]">
            Acoustic Keypad Transmitter (0Hz Dual Sine Engine)
          </h3>
        </div>
        {activeSymbol && (
          <span className="text-xs font-mono text-[#FF642D] animate-pulse font-bold bg-[#FF642D]/10 px-2 py-0.5 rounded border border-[#FF642D]/50">
            TRANSMITTING [{activeSymbol}] {activeFrequencies ? `${activeFrequencies[0]}+${activeFrequencies[1]}Hz` : ''}
          </span>
        )}
      </div>

      {/* 4x4 Keypad Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {DTMF_GRID_ROWS.flat().map((sym) => {
          const freqs = DTMF_MATRIX[sym];
          const isPressed = activeSymbol === sym;

          return (
            <button
              key={sym}
              type="button"
              disabled={isTransmitting && activeSymbol !== sym}
              onClick={() => handleKeyPress(sym)}
              className={`p-3.5 rounded font-mono font-bold text-lg select-none transition-all flex flex-col items-center justify-center border ${
                isPressed
                  ? 'bg-[#FF642D] text-white border-[#FF7A45] scale-95 shadow-[0_0_16px_#FF642D]'
                  : 'bg-[#12343B] text-[#F4F3EF] border-[#29434A] hover:bg-[#FF642D]/20 hover:border-[#FF642D]/60 hover:text-[#FF642D] active:scale-95'
              } disabled:opacity-50 disabled:pointer-events-none`}
            >
              <span>{sym}</span>
              <span className="text-[9px] font-normal text-[#9AAEB1] mt-0.5 opacity-70">
                {freqs[0]}+{freqs[1]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quick Helper Sequences */}
      <div className="space-y-3 mb-4">
        <div className="text-[11px] font-mono text-[#9AAEB1] flex items-center justify-between">
          <span className="uppercase tracking-wider">Acoustic Handshake Shortcuts:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <button
            type="button"
            disabled={isTransmitting}
            onClick={() => handleKeyPress('*')}
            className="px-2.5 py-1.5 rounded bg-[#07191D] border border-[#29434A] hover:border-[#FF642D] text-[#9AAEB1] hover:text-[#FF642D] transition-colors"
          >
            [*] START FRAME
          </button>
          <button
            type="button"
            disabled={isTransmitting}
            onClick={() => handleKeyPress('#')}
            className="px-2.5 py-1.5 rounded bg-[#07191D] border border-[#29434A] hover:border-[#FF642D] text-[#9AAEB1] hover:text-[#FF642D] transition-colors"
          >
            [#] END FRAME
          </button>
          <button
            type="button"
            disabled={isTransmitting}
            onClick={() => handleSendSequence('#5')}
            className="px-2.5 py-1.5 rounded bg-[#FF642D]/20 border border-[#FF642D]/60 hover:bg-[#FF642D]/30 text-[#FF642D] font-bold transition-colors flex items-center justify-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            [#5] CONFIRM
          </button>
          <button
            type="button"
            disabled={isTransmitting}
            onClick={() => handleSendSequence('*99#')}
            className="px-2.5 py-1.5 rounded bg-[#07191D] border border-[#29434A] hover:border-[#FF642D] text-[#9AAEB1] hover:text-[#FF642D] transition-colors"
          >
            [*99#] REJECT
          </button>
        </div>
      </div>

      {/* Sequence Transmission Bar */}
      <div className="space-y-2 mb-4 bg-[#07191D] p-3 rounded border border-[#29434A]">
        <div className="text-[11px] font-mono text-[#9AAEB1] flex items-center justify-between">
          <span>SEQUENCE TRANSMITTER:</span>
          <span className="text-[10px] text-[#9AAEB1]/60">Valid: 0-9, *, #, A-D</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={sequenceInput}
            onChange={(e) => setSequenceInput(e.target.value.toUpperCase().replace(/[^0-9A-D*#]/g, ''))}
            placeholder="e.g. *1482# or #5"
            className="flex-1 bg-[#12343B] border border-[#29434A] rounded px-3 py-1.5 font-mono text-sm text-[#F4F3EF] focus:outline-none focus:border-[#FF642D]"
          />
          {isTransmitting ? (
            <button
              type="button"
              onClick={stopSequence}
              className="px-3 py-1.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-mono font-bold flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              STOP
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendSequence()}
              disabled={!sequenceInput}
              className="px-3.5 py-1.5 rounded bg-[#FF642D] hover:bg-[#FF7A45] text-white text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              BURST
            </button>
          )}
        </div>
      </div>

      {/* Configurable Tone Durations */}
      <div className="bg-[#07191D] p-3 rounded border border-[#29434A] grid grid-cols-2 gap-4 text-xs font-mono">
        <div>
          <div className="flex justify-between text-[#9AAEB1] mb-1">
            <span>Tone Duration:</span>
            <span className="text-[#FF642D] font-bold">{config.tone_duration_ms} ms</span>
          </div>
          <input
            type="range"
            min="60"
            max="600"
            step="10"
            value={config.tone_duration_ms}
            onChange={(e) =>
              setConfig({ ...config, tone_duration_ms: Number(e.target.value) })
            }
            className="w-full accent-[#FF642D] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[#9AAEB1] mb-1">
            <span>Silence Gap:</span>
            <span className="text-[#FF642D] font-bold">{config.silence_interval_ms} ms</span>
          </div>
          <input
            type="range"
            min="20"
            max="400"
            step="10"
            value={config.silence_interval_ms}
            onChange={(e) =>
              setConfig({ ...config, silence_interval_ms: Number(e.target.value) })
            }
            className="w-full accent-[#FF642D] cursor-pointer"
          />
        </div>
      </div>

      {/* Transmission History */}
      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#29434A] flex items-center justify-between text-[11px] font-mono text-[#9AAEB1]">
          <span>
            Transmitted: <strong className="text-[#F4F3EF]">{history[0].symbol}</strong> ({history[0].frequencies[0]}+{history[0].frequencies[1]}Hz) at {formatTelemetryTime(history[0].timestamp)}
          </span>
          <button
            onClick={clearHistory}
            className="text-[10px] text-[#9AAEB1] hover:text-[#FF642D]"
          >
            Clear Log
          </button>
        </div>
      )}
    </div>
  );
};
