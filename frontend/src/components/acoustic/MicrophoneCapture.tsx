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
    <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#dce3df] pb-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#bd5e3b]" />
          <h3 className="font-display text-sm tracking-wide text-[#20312e]">
            Acoustic Signal Ingest & Hardware Capture
          </h3>
        </div>
        <StatusBadge status={micState} pulse={isCapturing} />
      </div>

      {/* Mic Status & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hardware Capture Controller */}
        <div className="bg-[#f4f5f2] p-3.5 rounded border border-[#dce3df] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#667773]">Hardware State:</span>
            <span className="text-[#20312e] font-bold uppercase">{micState}</span>
          </div>

          {/* Audio Volume Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-[#667773] mb-1">
              <span>Input Ingest Level:</span>
              <span className={audioLevel > 50 ? 'text-[#bd5e3b]' : 'text-[#28734f]'}>
                {audioLevel}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#f0f3ef] rounded-full overflow-hidden border border-[#dce3df]">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  audioLevel > 70
                    ? 'bg-[#bd5e3b]'
                    : audioLevel > 30
                    ? 'bg-[#28734f]'
                    : 'bg-[#667773]'
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
                ? 'bg-[#f8ecea] hover:bg-[#f1dedb] text-[#a63f37] border-[#e8cbc7]'
                : 'bg-[#bd5e3b] hover:bg-[#a94c2e] text-white border-transparent'
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
            <div className="text-[11px] font-mono text-[#a63f37] bg-[#f8ecea] p-2 rounded border border-[#e8cbc7] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{micError}</span>
            </div>
          )}
        </div>

        {/* Backend DSP Verification Trigger */}
        <div className="bg-[#f4f5f2] p-3.5 rounded border border-[#dce3df] space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-[#667773] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#bd5e3b]" />
                DSP Server-Side Decoder
              </span>
              <span className="text-[10px] text-[#667773]/60">POST /api/dsp/decode</span>
            </div>
            <p className="text-[11px] text-[#667773] font-mono leading-relaxed">
              Extract Float32 audio samples from the hardware buffer, convert to Int16 PCM, and verify DTMF tones using server-side Goertzel filters.
            </p>
          </div>

          <button
            onClick={handleSendToDspBackend}
            disabled={!isCapturing || isDecoding}
            className="w-full py-2 px-4 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-[#f0f3ef] hover:bg-[#f0f3ef]/80 text-[#bd5e3b] border border-[#bd5e3b]/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <Radio className="w-4 h-4" />
            {isDecoding ? 'Transmitting PCM to Server...' : 'Verify Captured PCM with Backend DSP'}
          </button>
        </div>
      </div>

      {/* Backend DSP Verification Results */}
      {decodeResult && (
        <div className="bg-[#f4f5f2] p-3 rounded border border-[#28734f]/40 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#28734f] font-bold flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-4 h-4 text-[#28734f]" />
              Backend DSP Decoding Complete
            </span>
            <span className="text-[#667773] text-[10px]">
              CONF: {formatConfidence(decodeResult.confidence)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#dce3df]/50 text-[11px]">
            <div>
              <span className="text-[#667773]">Detected Symbol: </span>
              <span className="text-[#bd5e3b] font-bold text-sm">
                [{decodeResult.symbol || 'NONE'}]
              </span>
            </div>
            <div>
              <span className="text-[#667773]">Row Frequency: </span>
              <span className="text-[#20312e]">{decodeResult.row_freq || 0} Hz</span>
            </div>
            <div>
              <span className="text-[#667773]">Col Frequency: </span>
              <span className="text-[#20312e]">{decodeResult.col_freq || 0} Hz</span>
            </div>
            <div>
              <span className="text-[#667773]">Duration: </span>
              <span className="text-[#20312e]">{decodeResult.duration_ms || 0} ms</span>
            </div>
          </div>
        </div>
      )}

      {decodeError && (
        <div className="bg-[#f8ecea] p-2.5 rounded border border-[#e8cbc7] font-mono text-xs text-[#a63f37] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{decodeError}</span>
        </div>
      )}
    </div>
  );
};
