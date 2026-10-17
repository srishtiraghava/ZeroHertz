import React, { useState } from 'react';
import { FrequencySpectrum } from './FrequencySpectrum';
import { DTMFMatrix } from './DTMFMatrix';
import { AcousticKeypad } from './AcousticKeypad';
import { MicrophoneCapture } from './MicrophoneCapture';
import { useApp } from '../../context/AppContext';
import { DTMFDetection, DTMFSymbol } from '../../types';
import { getAudioContext } from '../../utils/audio';

export const AcousticModem: React.FC = () => {
  const { state } = useApp();
  const { recentDetections } = state;

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isCapturingAudio, setIsCapturingAudio] = useState<boolean>(false);
  const [activeTransmitSymbol, setActiveTransmitSymbol] = useState<DTMFSymbol | null>(null);

  const latestDetection = recentDetections.length > 0 ? recentDetections[0] : null;

  return (
    <div className="space-y-6">
      {/* Upper Section: Microphone Ingest Controls */}
      <MicrophoneCapture
        onCaptureStateChange={(analyserNode, ctx, capturing) => {
          setAnalyser(analyserNode);
          setIsCapturingAudio(capturing);
        }}
      />

      {/* Real-time Frequency Spectrum Visualizer */}
      <FrequencySpectrum
        analyserNode={analyser}
        audioContext={getAudioContext()}
        isCapturing={isCapturingAudio}
      />

      {/* Dual Columns: DTMF 4x4 Matrix Display & Acoustic Keypad Transmitter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DTMFMatrix
          latestDetection={latestDetection}
          detectionHistory={recentDetections}
          activeTransmitSymbol={activeTransmitSymbol}
        />

        <AcousticKeypad
          onTransmitted={(symbol) => {
            setActiveTransmitSymbol(symbol);
            setTimeout(() => setActiveTransmitSymbol(null), 300);
          }}
        />
      </div>
    </div>
  );
};
