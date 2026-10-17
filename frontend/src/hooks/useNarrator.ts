import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { playSuccessSound } from '../utils/audio';

export function useNarrator() {
  const { state, dispatch } = useApp();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const loadVoices = () => {
        if (!synthRef.current) return;
        const available = synthRef.current.getVoices();
        setVoices(available);
      };

      loadVoices();
      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const speak = useCallback(
    (text: string, forceLanguage?: 'hi-IN' | 'en-IN') => {
      if (!state.narratorEnabled || !synthRef.current || !text) return;

      try {
        synthRef.current.cancel(); // Cancel ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = forceLanguage || state.narratorLang;
        utterance.lang = targetLang;

        // Try to match voice for chosen language
        const matchedVoice = voices.find(
          (v) =>
            v.lang.toLowerCase() === targetLang.toLowerCase() ||
            v.lang.toLowerCase().startsWith(targetLang.split('-')[0].toLowerCase())
        );

        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
          console.warn('[Narrator] Utterance error:', e);
          setIsSpeaking(false);
        };

        synthRef.current.speak(utterance);
      } catch (err) {
        console.warn('[Narrator] Speak failed:', err);
      }
    },
    [state.narratorEnabled, state.narratorLang, voices]
  );

  const toggleMute = useCallback(() => {
    const nextVal = !state.narratorEnabled;
    dispatch({ type: 'SET_NARRATOR_ENABLED', payload: nextVal });
    if (!nextVal && synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, [state.narratorEnabled, dispatch]);

  const setLanguage = useCallback(
    (lang: 'hi-IN' | 'en-IN') => {
      dispatch({ type: 'SET_NARRATOR_LANG', payload: lang });
    },
    [dispatch]
  );

  const notifySuccess = useCallback(async (narrationMessage?: string) => {
    // 1. Play Web Audio 3-tone chime
    await playSuccessSound();
    // 2. Speak narration if provided
    if (narrationMessage) {
      speak(narrationMessage);
    }
  }, [speak]);

  return {
    isSpeaking,
    narratorEnabled: state.narratorEnabled,
    narratorLang: state.narratorLang,
    voices,
    speak,
    toggleMute,
    setLanguage,
    notifySuccess,
  };
}
