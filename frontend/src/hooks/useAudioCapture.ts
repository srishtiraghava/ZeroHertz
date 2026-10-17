import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { MicrophoneState } from '../types';
import { getAudioContext, float32ToInt16PCM } from '../utils/audio';

export interface AudioCaptureState {
  isCapturing: boolean;
  micState: MicrophoneState;
  analyserNode: AnalyserNode | null;
  audioContext: AudioContext | null;
  error: string | null;
  startCapture: () => Promise<boolean>;
  stopCapture: () => void;
  getCapturedPCM: () => Int16Array | null;
  audioLevel: number;
}

export function useAudioCapture(): AudioCaptureState {
  const { state, dispatch } = useApp();
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmBufferRef = useRef<Float32Array[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Monitor audio volume level
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isCapturing) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setAudioLevel(Math.min(100, Math.round(rms * 250)));

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [isCapturing]);

  const stopCapture = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsCapturing(false);
    setAudioLevel(0);
    dispatch({ type: 'SET_MIC_STATE', payload: 'inactive' });
    dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'idle' });
  }, [dispatch]);

  const startCapture = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported by your browser environment.');
      }

      dispatch({ type: 'SET_MIC_STATE', payload: 'prompt' });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      streamRef.current = stream;
      dispatch({ type: 'SET_MIC_STATE', payload: 'granted' });

      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Setup AnalyserNode for spectrum visualization
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Setup ScriptProcessor for PCM audio chunk recording
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      pcmBufferRef.current = [];
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Keep up to ~3 seconds of Float32 audio (approx 33 buffers at 4096 / 44.1kHz)
        const chunk = new Float32Array(inputData);
        pcmBufferRef.current.push(chunk);
        if (pcmBufferRef.current.length > 35) {
          pcmBufferRef.current.shift();
        }
      };
      processorRef.current = processor;
      source.connect(processor);
      // Dummy connect to destination so onaudioprocess fires
      processor.connect(audioCtx.destination);

      setIsCapturing(true);
      dispatch({ type: 'SET_MIC_STATE', payload: 'active' });
      dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'listening' });

      // Start level meter
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      return true;
    } catch (err: any) {
      console.error('[AudioCapture] Mic access error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const state: MicrophoneState = isDenied ? 'denied' : 'error';
      setError(err.message || 'Failed to access audio hardware');
      dispatch({ type: 'SET_MIC_STATE', payload: state });
      dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'error' });
      stopCapture();
      return false;
    }
  }, [dispatch, stopCapture, updateAudioLevel]);

  // Extract recorded PCM
  const getCapturedPCM = useCallback((): Int16Array | null => {
    if (pcmBufferRef.current.length === 0) return null;

    const totalSamples = pcmBufferRef.current.reduce((acc, curr) => acc + curr.length, 0);
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const buf of pcmBufferRef.current) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    return float32ToInt16PCM(merged);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    isCapturing,
    micState: state.micState,
    analyserNode: analyserRef.current,
    audioContext: getAudioContext(),
    error,
    startCapture,
    stopCapture,
    getCapturedPCM,
    audioLevel,
  };
}
