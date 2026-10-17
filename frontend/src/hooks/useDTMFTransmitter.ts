import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { DTMFSymbol, DTMFTransmitterConfig } from '../types';
import { playDTMFTone, playDTMFSequence, DTMF_MATRIX } from '../utils/audio';

export interface TransmissionLogItem {
  id: string;
  symbol: string;
  frequencies: [number, number];
  timestamp: string;
}

export function useDTMFTransmitter() {
  const { dispatch } = useApp();
  const [config, setConfig] = useState<DTMFTransmitterConfig>({
    tone_duration_ms: 200,
    silence_interval_ms: 100,
  });
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState<DTMFSymbol | null>(null);
  const [activeFrequencies, setActiveFrequencies] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<TransmissionLogItem[]>([]);
  const abortControllerRef = useRef<boolean>(false);

  const transmitKey = useCallback(async (symbol: DTMFSymbol) => {
    const freqs = DTMF_MATRIX[symbol];
    if (!freqs) return;

    setIsTransmitting(true);
    setActiveSymbol(symbol);
    setActiveFrequencies(freqs);
    dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'transmitting' });

    const logItem: TransmissionLogItem = {
      id: Math.random().toString(36).substring(2, 9),
      symbol,
      frequencies: freqs,
      timestamp: new Date().toISOString(),
    };

    setHistory((prev) => [logItem, ...prev].slice(0, 50));

    try {
      await playDTMFTone(symbol, config.tone_duration_ms);
    } finally {
      setIsTransmitting(false);
      setActiveSymbol(null);
      setActiveFrequencies(null);
      dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'idle' });
    }
  }, [config.tone_duration_ms, dispatch]);

  const transmitSequence = useCallback(async (sequence: string) => {
    if (!sequence || sequence.trim().length === 0) return;
    
    setIsTransmitting(true);
    dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'transmitting' });
    abortControllerRef.current = false;

    const chars = sequence.toUpperCase().split('') as DTMFSymbol[];

    try {
      for (let i = 0; i < chars.length; i++) {
        if (abortControllerRef.current) break;

        const char = chars[i];
        const freqs = DTMF_MATRIX[char];
        if (freqs) {
          setActiveSymbol(char);
          setActiveFrequencies(freqs);

          const logItem: TransmissionLogItem = {
            id: Math.random().toString(36).substring(2, 9),
            symbol: char,
            frequencies: freqs,
            timestamp: new Date().toISOString(),
          };
          setHistory((prev) => [logItem, ...prev].slice(0, 50));

          await playDTMFTone(char, config.tone_duration_ms);

          if (i < chars.length - 1 && config.silence_interval_ms > 0) {
            setActiveSymbol(null);
            setActiveFrequencies(null);
            await new Promise((res) => setTimeout(res, config.silence_interval_ms));
          }
        }
      }
    } finally {
      setIsTransmitting(false);
      setActiveSymbol(null);
      setActiveFrequencies(null);
      dispatch({ type: 'SET_ACOUSTIC_ENGINE_STATE', payload: 'idle' });
    }
  }, [config.tone_duration_ms, config.silence_interval_ms, dispatch]);

  const stopSequence = useCallback(() => {
    abortControllerRef.current = true;
    setIsTransmitting(false);
    setActiveSymbol(null);
    setActiveFrequencies(null);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
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
  };
}
