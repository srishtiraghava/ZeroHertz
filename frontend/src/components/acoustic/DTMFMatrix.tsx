import React from 'react';
import {
  DTMF_GRID_ROWS,
  DTMF_ROW_FREQUENCIES,
  DTMF_COL_FREQUENCIES,
} from '../../utils/audio';
import { DTMFDetection } from '../../types';
import { formatTelemetryTime, formatConfidence } from '../../utils/format';
import { Activity, Radio, ShieldCheck } from 'lucide-react';

interface DTMFMatrixProps {
  latestDetection: DTMFDetection | null;
  detectionHistory: DTMFDetection[];
  activeTransmitSymbol?: string | null;
}

export const DTMFMatrix: React.FC<DTMFMatrixProps> = ({
  latestDetection,
  detectionHistory,
  activeTransmitSymbol,
}) => {
  // Determine if a row or column frequency is currently active
  const activeRowFreq = latestDetection?.row_freq;
  const activeColFreq = latestDetection?.col_freq;
  const activeSymbol = activeTransmitSymbol || latestDetection?.symbol;

  return (
    <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#dce3df] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#bd5e3b]" />
          <h3 className="font-display text-sm tracking-wide text-[#20312e]">
            DTMF Standard 4x4 Matrix
          </h3>
        </div>
        {latestDetection && (
          <span className="text-xs font-mono text-[#28734f] flex items-center gap-1 bg-[#f0f3ef] px-2 py-0.5 rounded border border-[#dce3df]">
            <ShieldCheck className="w-3.5 h-3.5" />
            CONF: {formatConfidence(latestDetection.confidence)}
          </span>
        )}
      </div>

      {/* 4x4 Matrix with Column Frequency Headers and Row Frequency Labels */}
      <div className="overflow-x-auto">
        <div className="min-w-[280px]">
          {/* Column Frequencies Header */}
          <div className="grid grid-cols-5 gap-1.5 text-center mb-1 text-[10px] font-mono">
            <div className="text-[#667773]/60 flex items-center justify-center">Hz \ Hz</div>
            {DTMF_COL_FREQUENCIES.map((colFreq) => {
              const isColActive = activeColFreq === colFreq;
              return (
                <div
                  key={colFreq}
                  className={`py-1 rounded font-bold transition-colors ${
                    isColActive
                      ? 'bg-[#28734f]/20 text-[#28734f] border border-[#28734f]/60'
                      : 'bg-[#f4f5f2] text-[#28734f]/80 border border-[#dce3df]/50'
                  }`}
                >
                  {colFreq}
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {DTMF_GRID_ROWS.map((rowSymbols, rowIdx) => {
            const rowFreq = DTMF_ROW_FREQUENCIES[rowIdx];
            const isRowActive = activeRowFreq === rowFreq;

            return (
              <div key={rowFreq} className="grid grid-cols-5 gap-1.5 mb-1.5">
                {/* Row Frequency Label */}
                <div
                  className={`flex items-center justify-center text-[10px] font-mono font-bold py-2 rounded transition-colors ${
                    isRowActive
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/60'
                      : 'bg-[#f4f5f2] text-[#F59E0B]/80 border border-[#dce3df]/50'
                  }`}
                >
                  {rowFreq}
                </div>

                {/* The 4 Cells in this Row */}
                {rowSymbols.map((sym, colIdx) => {
                  const colFreq = DTMF_COL_FREQUENCIES[colIdx];
                  const isKeyDetected = latestDetection?.symbol === sym;
                  const isKeyTransmitting = activeTransmitSymbol === sym;
                  const isIntersection =
                    (activeRowFreq === rowFreq && activeColFreq === colFreq) ||
                    isKeyDetected ||
                    isKeyTransmitting;

                  return (
                    <div
                      key={sym}
                      className={`relative flex flex-col items-center justify-center py-2.5 rounded font-mono font-bold text-base transition-all select-none border ${
                        isKeyTransmitting
                          ? 'bg-[#bd5e3b] text-white border-[#a94c2e] shadow-[0_0_12px_#bd5e3b] scale-105'
                          : isIntersection
                          ? 'bg-[#bd5e3b]/20 text-[#bd5e3b] border-[#bd5e3b] shadow-[0_0_8px_rgba(255,100,45,0.4)]'
                          : 'bg-[#f0f3ef] text-[#20312e] border-[#dce3df] hover:border-[#667773]/40'
                      }`}
                    >
                      <span>{sym}</span>
                      <span className="text-[8px] font-normal text-[#667773] mt-0.5 opacity-80">
                        {rowFreq}+{colFreq}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Detection Banner */}
      <div className="mt-4 pt-3 border-t border-[#dce3df] bg-[#f4f5f2] p-3 rounded border font-mono text-xs space-y-1.5">
        <div className="flex items-center justify-between text-[#667773]">
          <span>LAST DECODED SYMBOL:</span>
          <span className="text-[#bd5e3b] font-bold text-base bg-[#f0f3ef] px-2 py-0.5 rounded border border-[#dce3df]">
            {activeSymbol || 'NONE'}
          </span>
        </div>

        {latestDetection && (
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#dce3df]/50">
            <div>
              <span className="text-[#667773]">Duration: </span>
              <span className="text-[#20312e]">{latestDetection.duration_ms} ms</span>
            </div>
            <div>
              <span className="text-[#667773]">Energy SNR: </span>
              <span className="text-[#28734f]">
                {latestDetection.energy_snr ? `${latestDetection.energy_snr.toFixed(1)} dB` : '> 18 dB'}
              </span>
            </div>
            <div className="col-span-2 text-[10px] text-[#667773]/70">
              Captured: {formatTelemetryTime(latestDetection.timestamp)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
