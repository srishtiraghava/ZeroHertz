import React, { useRef, useEffect } from 'react';
import { DTMF_ROW_FREQUENCIES, DTMF_COL_FREQUENCIES } from '../../utils/audio';

interface FrequencySpectrumProps {
  analyserNode: AnalyserNode | null;
  audioContext: AudioContext | null;
  isCapturing: boolean;
}

export const FrequencySpectrum: React.FC<FrequencySpectrumProps> = ({
  analyserNode,
  audioContext,
  isCapturing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const sampleRate = audioContext?.sampleRate || 44100;
    const minDisplayFreq = 400; // Hz
    const maxDisplayFreq = 2000; // Hz DTMF telecommunications band

    const allDtmfFreqs = [
      ...DTMF_ROW_FREQUENCIES.map((f) => ({ freq: f, group: 'low' as const })),
      ...DTMF_COL_FREQUENCIES.map((f) => ({ freq: f, group: 'high' as const })),
    ];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark petroleum background
      ctx.fillStyle = '#f4f5f2';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle radar/oscilloscope grid
      ctx.strokeStyle = '#f0f3ef';
      ctx.lineWidth = 1;
      const gridStepsY = 4;
      for (let i = 1; i < gridStepsY; i++) {
        const y = (height / gridStepsY) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      let dataArray: Uint8Array | null = null;
      let binCount = 0;

      if (analyserNode && isCapturing) {
        binCount = analyserNode.frequencyBinCount;
        const buf = new Uint8Array(binCount);
        analyserNode.getByteFrequencyData(buf);
        dataArray = buf as Uint8Array<ArrayBuffer>;
      }

      // Draw frequency spectrum curve / bars within [minDisplayFreq, maxDisplayFreq]
      if (dataArray && binCount > 0) {
        const binWidthHz = sampleRate / (binCount * 2);

        // Draw filled gradient area
        ctx.beginPath();
        ctx.moveTo(0, height);

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(255, 100, 45, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 100, 45, 0.25)');
        gradient.addColorStop(1, 'rgba(18, 52, 59, 0.05)');

        let hasDrawn = false;
        for (let x = 0; x < width; x++) {
          const freq = minDisplayFreq + (x / width) * (maxDisplayFreq - minDisplayFreq);
          const binIndex = Math.min(binCount - 1, Math.max(0, Math.round(freq / binWidthHz)));
          const rawVal = dataArray[binIndex] || 0;
          const barHeight = (rawVal / 255) * (height - 24);
          const y = height - barHeight;

          if (!hasDrawn) {
            ctx.moveTo(x, y);
            hasDrawn = true;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw top glowing trace stroke
        ctx.strokeStyle = '#bd5e3b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const freq = minDisplayFreq + (x / width) * (maxDisplayFreq - minDisplayFreq);
          const binIndex = Math.min(binCount - 1, Math.max(0, Math.round(freq / binWidthHz)));
          const rawVal = dataArray[binIndex] || 0;
          const barHeight = (rawVal / 255) * (height - 24);
          const y = height - barHeight;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw 8 DTMF Frequency Markers
      allDtmfFreqs.forEach(({ freq, group }) => {
        // Map frequency to x coordinate based on linear scale
        const x = ((freq - minDisplayFreq) / (maxDisplayFreq - minDisplayFreq)) * width;

        if (x >= 0 && x <= width) {
          // Check energy at this DTMF marker bin
          let energy = 0;
          if (dataArray && binCount > 0) {
            const binWidthHz = sampleRate / (binCount * 2);
            const centerBin = Math.round(freq / binWidthHz);
            // Average around center bin ±1
            let sum = 0;
            let cnt = 0;
            for (let b = Math.max(0, centerBin - 1); b <= Math.min(binCount - 1, centerBin + 1); b++) {
              sum += dataArray[b];
              cnt++;
            }
            energy = cnt > 0 ? sum / cnt : 0;
          }

          const isActive = energy > 140; // Detection threshold

          // Marker vertical line
          ctx.beginPath();
          ctx.setLineDash(isActive ? [] : [2, 3]);
          ctx.strokeStyle = isActive
            ? '#bd5e3b'
            : group === 'low'
            ? 'rgba(245, 158, 11, 0.45)'
            : 'rgba(34, 197, 94, 0.45)';
          ctx.lineWidth = isActive ? 2 : 1;
          ctx.moveTo(x, 16);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.setLineDash([]);

          // Frequency label tag
          ctx.fillStyle = isActive ? '#bd5e3b' : group === 'low' ? '#F59E0B' : '#28734f';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${freq}Hz`, x, 12);

          // Energy indicator dot if active
          if (isActive) {
            ctx.beginPath();
            ctx.arc(x, height - 10, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#bd5e3b';
            ctx.fill();
          }
        }
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserNode, audioContext, isCapturing]);

  return (
    <div className="bg-[#f4f5f2] border border-[#dce3df] rounded p-3 relative flex flex-col">
      <div className="flex items-center justify-between text-xs font-mono text-[#667773] mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#bd5e3b]" />
          <span className="uppercase tracking-wider font-bold text-[#20312e]">
            Real-time FFT Frequency Spectrum (400Hz - 2000Hz)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#F59E0B]" /> Low Group (Row)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#28734f]" /> High Group (Col)
          </span>
          <span className="text-[#667773]">
            SR: {audioContext?.sampleRate ? `${(audioContext.sampleRate / 1000).toFixed(1)}kHz` : '44.1kHz'}
          </span>
        </div>
      </div>

      <div className="relative w-full h-44 bg-[#f4f5f2] rounded overflow-hidden border border-[#f0f3ef]">
        <canvas
          ref={canvasRef}
          width={800}
          height={176}
          className="w-full h-full block"
        />
        {!isCapturing && (
          <div className="absolute inset-0 bg-[#f4f5f2]/80 flex items-center justify-center font-mono text-xs text-[#667773]">
            Microphone Ingest Inactive — Enable Audio Capture Below to View FFT Spectrum
          </div>
        )}
      </div>
    </div>
  );
};
