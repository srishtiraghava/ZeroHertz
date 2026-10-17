import React, { useState } from 'react';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import { useApi } from '../../hooks/useApi';
import { StatusBadge } from '../common/StatusBadge';
import {
  Mic,
  MicOff,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Radio,
} from 'lucide-react';
import { formatConfidence } from '../../utils/format';

interface MicrophoneCaptureProps {
  onCaptureStateChange?: (analyser: AnalyserNode | null, ctx: AudioContext | null, capturing: boolean) => void;
  onDecoded?: (result: any) => void;
}

export const MicrophoneCapture: React.FC<MicrophoneCaptureProps> = ({
  onCaptureStateChange,
  onDecoded,
}) => {
  const {
    isCapturing,
    micState,
    startCapture,
    stopCapture,
    analyserNode,
    audioContext,
    audioLevel,
    getCapturedPCM,
    error: micError,
  } = useAudioCapture();

  const { decodeDsp, loading: isDecoding } = useApi();
  const [decodeResult, setDecodeResult] = useState<any>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const handleToggleCapture = async () => {
    if (isCapturing) {
      stopCapture();
      if (onCaptureStateChange) onCaptureStateChange(null, audioContext, false);
    } else {
      const ok = await startCapture();
      if (ok && onCaptureStateChange) {
        onCaptureStateChange(analyserNode, audioContext, true);
      }
    }
  };

  const handleSendToDspBackend = async () => {
    setDecodeError(null);
    setDecodeResult(null);

    const pcm = getCapturedPCM();
    if (!pcm || pcm.length === 0) {
      setDecodeError('No audio PCM buffer captured yet. Speak or play DTMF tones while mic is active.');
      return;
    }

    try {
      const sampleRate = audioContext?.sampleRate || 44100;
      const res = await decodeDsp(pcm, sampleRate);
      setDecodeResult(res);
      if (onDecoded) onDecoded(res);
    } catch (err: any) {
      setDecodeError(err.message || 'DSP backend failed to decode audio buffer');
    }
  };

  return (
    <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29434A] pb-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#FF642D]" />
          <h3 className="font-display text-sm tracking-wide text-[#F4F3EF]">
            Acoustic Signal Ingest & Hardware Capture
          </h3>
        </div>
        <StatusBadge status={micState} pulse={isCapturing} />
      </div>

      {/* Mic Status & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hardware Capture Controller */}
        <div className="bg-[#07191D] p-3.5 rounded border border-[#29434A] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#9AAEB1]">Hardware State:</span>
            <span className="text-[#F4F3EF] font-bold uppercase">{micState}</span>
          </div>

          {/* Audio Volume Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-[#9AAEB1] mb-1">
              <span>Input Ingest Level:</span>
              <span className={audioLevel > 50 ? 'text-[#FF642D]' : 'text-[#22C55E]'}>
                {audioLevel}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#12343B] rounded-full overflow-hidden border border-[#29434A]">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  audioLevel > 70
                    ? 'bg-[#FF642D]'
                    : audioLevel > 30
                    ? 'bg-[#22C55E]'
                    : 'bg-[#9AAEB1]'
                }`}
                style={{ width: `${Math.min(100, audioLevel)}%` }}
              />
            </div>
          </div>

          {/* Toggle Capture Button */}
          <button
            onClick={handleToggleCapture}
            className={`w-full py-2 px-4 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border ${
              isCapturing
                ? 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border-red-700/60'
                : 'bg-[#FF642D] hover:bg-[#FF7A45] text-white border-transparent'
            }`}
          >
            {isCapturing ? (
              <>
                <MicOff className="w-4 h-4" />
                Halt Microphone Capture
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Initiate Microphone Capture
              </>
            )}
          </button>

          {micError && (
            <div className="text-[11px] font-mono text-red-400 bg-red-950/40 p-2 rounded border border-red-800/60 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{micError}</span>
            </div>
          )}
        </div>

        {/* Backend DSP Verification Trigger */}
        <div className="bg-[#07191D] p-3.5 rounded border border-[#29434A] space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-[#9AAEB1] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#FF642D]" />
                DSP Server-Side Decoder
              </span>
              <span className="text-[10px] text-[#9AAEB1]/60">POST /api/dsp/decode</span>
            </div>
            <p className="text-[11px] text-[#9AAEB1] font-mono leading-relaxed">
              Extract Float32 audio samples from the hardware buffer, convert to Int16 PCM, and verify DTMF tones using server-side Goertzel filters.
            </p>
          </div>

          <button
            onClick={handleSendToDspBackend}
            disabled={!isCapturing || isDecoding}
            className="w-full py-2 px-4 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-[#12343B] hover:bg-[#12343B]/80 text-[#FF642D] border border-[#FF642D]/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <Radio className="w-4 h-4" />
            {isDecoding ? 'Transmitting PCM to Server...' : 'Verify Captured PCM with Backend DSP'}
          </button>
        </div>
      </div>

      {/* Backend DSP Verification Results */}
      {decodeResult && (
        <div className="bg-[#07191D] p-3 rounded border border-[#22C55E]/40 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#22C55E] font-bold flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              Backend DSP Decoding Complete
            </span>
            <span className="text-[#9AAEB1] text-[10px]">
              CONF: {formatConfidence(decodeResult.confidence)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#29434A]/50 text-[11px]">
            <div>
              <span className="text-[#9AAEB1]">Detected Symbol: </span>
              <span className="text-[#FF642D] font-bold text-sm">
                [{decodeResult.symbol || 'NONE'}]
              </span>
            </div>
            <div>
              <span className="text-[#9AAEB1]">Row Frequency: </span>
              <span className="text-[#F4F3EF]">{decodeResult.row_freq || 0} Hz</span>
            </div>
            <div>
              <span className="text-[#9AAEB1]">Col Frequency: </span>
              <span className="text-[#F4F3EF]">{decodeResult.col_freq || 0} Hz</span>
            </div>
            <div>
              <span className="text-[#9AAEB1]">Duration: </span>
              <span className="text-[#F4F3EF]">{decodeResult.duration_ms || 0} ms</span>
            </div>
          </div>
        </div>
      )}

      {decodeError && (
        <div className="bg-red-950/30 p-2.5 rounded border border-red-800/60 font-mono text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{decodeError}</span>
        </div>
      )}
    </div>
  );
};
