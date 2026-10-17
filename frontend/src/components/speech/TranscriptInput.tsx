import React, { useState } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useApi } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';
import { ParsedIntent } from '../../types';
import {
  Mic,
  MicOff,
  Send,
  Trash2,
  Globe,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Layers,
} from 'lucide-react';
import { formatConfidence } from '../../utils/format';

interface TranscriptInputProps {
  initialTranscript?: string;
  initialLanguage?: 'hi-IN' | 'en-IN';
  onIntentExecuted?: (result: any) => void;
}

export const TranscriptInput: React.FC<TranscriptInputProps> = ({
  initialTranscript = '',
  initialLanguage = 'en-IN',
  onIntentExecuted,
}) => {
  const { dispatch } = useApp();
  const {
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    language,
    setLanguage,
    error: speechError,
    startListening,
    stopListening,
    clearTranscript,
    isSupported,
  } = useSpeechRecognition();

  const { executeIntent, loading: isExecuting } = useApi();
  const [parsedResponse, setParsedResponse] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Sync initial props if updated externally
  React.useEffect(() => {
    if (initialTranscript) setTranscript(initialTranscript);
  }, [initialTranscript, setTranscript]);

  React.useEffect(() => {
    if (initialLanguage) setLanguage(initialLanguage);
  }, [initialLanguage, setLanguage]);

  const handleSubmitIntent = async () => {
    const textToSend = transcript.trim();
    if (!textToSend) return;

    setExecutionError(null);
    setValidationErrors([]);
    setParsedResponse(null);

    try {
      const res = await executeIntent({
        transcript: textToSend,
        language: language.startsWith('hi') ? 'hi' : 'en',
      });

      setParsedResponse(res);

      if (res.intent?.validation_errors && res.intent.validation_errors.length > 0) {
        setValidationErrors(res.intent.validation_errors);
      }

      // Update global session in AppContext
      dispatch({
        type: 'SET_ACTIVE_SESSION',
        payload: {
          id: res.session_id || `SES-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
          state: 'automating',
          input_channel: 'speech',
          transcript: textToSend,
          intent: res.intent,
          workflow_stage: (res.workflow_stage as any) || 'Intent parsed',
          workflow_step: res.workflow_step || 2,
          acoustic_confirmation: null,
          automation_log: [`Intent parsed successfully for ${res.intent?.service || 'service'}`],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      if (onIntentExecuted) onIntentExecuted(res);
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to parse and execute intent');
    }
  };

  return (
    <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 space-y-4">
      {/* Header with Language selector and ASR toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#29434A] pb-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#FF642D]" />
          <h3 className="font-display text-sm tracking-wide text-[#F4F3EF]">
            Speech Recognition & Manual Intent Entry
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 text-xs font-mono bg-[#07191D] px-2.5 py-1 rounded border border-[#29434A]">
            <Globe className="w-3.5 h-3.5 text-[#9AAEB1]" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'hi-IN' | 'en-IN')}
              className="bg-transparent text-[#F4F3EF] outline-none text-xs font-bold cursor-pointer"
            >
              <option value="en-IN" className="bg-[#0D252B]">en-IN (English India)</option>
              <option value="hi-IN" className="bg-[#0D252B]">hi-IN (हिंदी भारत)</option>
            </select>
          </div>

          {/* Voice Ingest Toggle Button */}
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors border ${
              isListening
                ? 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border-red-700/60 animate-pulse'
                : 'bg-[#FF642D] hover:bg-[#FF7A45] text-white border-transparent'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                Listening...
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                Start Voice Ingest
              </>
            )}
          </button>
        </div>
      </div>

      {/* Textarea for transcript editing */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-[#9AAEB1]">
          <span>Citizen Utterance / Intent Input:</span>
          {transcript && (
            <button
              onClick={clearTranscript}
              className="text-[#9AAEB1] hover:text-[#FF642D] flex items-center gap-1 text-[11px]"
            >
              <Trash2 className="w-3 h-3" /> Clear Text
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder={
              language === 'hi-IN'
                ? 'अपनी आवश्यकता यहाँ बोलें या लिखें... (उदा. मेरी पेंशन की समस्या दर्ज करें)'
                : 'Speak or type citizen request here... (e.g. Schedule an urgent appointment at AIIMS)'
            }
            className="w-full bg-[#07191D] border border-[#29434A] rounded p-3 font-mono text-sm text-[#F4F3EF] placeholder-[#9AAEB1]/40 focus:outline-none focus:border-[#FF642D] resize-none leading-relaxed"
          />

          {/* Interim speech recognition preview */}
          {interimTranscript && (
            <div className="absolute bottom-2 left-3 right-3 text-xs font-mono text-[#FF642D]/80 truncate bg-[#07191D]/90 px-1 py-0.5 rounded">
              [ASR Streaming]: {interimTranscript}
            </div>
          )}
        </div>
      </div>

      {speechError && (
        <div className="text-xs font-mono text-amber-400 bg-amber-950/30 p-2.5 rounded border border-amber-800/60 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Action Submit Button */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] font-mono text-[#9AAEB1]">
          Endpoint: <span className="text-[#F4F3EF]">POST /api/execute-intent</span>
        </div>

        <button
          onClick={handleSubmitIntent}
          disabled={!transcript.trim() || isExecuting}
          className="px-5 py-2.5 rounded bg-[#FF642D] hover:bg-[#FF7A45] text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Send className="w-4 h-4" />
          {isExecuting ? 'Parsing Intent & Launching...' : 'Submit Intent for Execution'}
        </button>
      </div>

      {/* Execution Error Banner */}
      {executionError && (
        <div className="text-xs font-mono text-red-400 bg-red-950/30 p-3 rounded border border-red-800/60 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div>
            <strong className="block font-bold">Execution Error:</strong>
            {executionError}
          </div>
        </div>
      )}

      {/* Schema Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-950/20 border border-red-800/80 rounded p-3 text-xs font-mono space-y-1">
          <div className="text-red-400 font-bold flex items-center gap-1.5 uppercase">
            <AlertCircle className="w-4 h-4" />
            Schema Validation Violations ({validationErrors.length})
          </div>
          <ul className="list-disc pl-5 text-red-300 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Parsed JSON Response Display */}
      {parsedResponse && (
        <div className="bg-[#07191D] border border-[#22C55E]/40 rounded p-3 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#22C55E] font-bold flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              Intent Successfully Parsed & Automation Initialized
            </span>
            <span className="text-[#9AAEB1] text-[10px]">
              CONF: {formatConfidence(parsedResponse.intent?.confidence)}
            </span>
          </div>

          <div className="bg-[#0D252B] p-2.5 rounded border border-[#29434A] max-h-56 overflow-y-auto">
            <pre className="text-[#22C55E] text-[11px] leading-relaxed">
              {JSON.stringify(parsedResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
