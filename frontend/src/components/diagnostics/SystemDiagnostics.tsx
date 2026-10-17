import React, { useState, useEffect } from 'react';
import { SystemDiagnosticsData } from '../../types';
import { useApi } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { formatDateTime, formatTelemetryTime } from '../../utils/format';
import {
  Cpu,
  RefreshCw,
  Server,
  Database,
  Radio,
  Mic,
  BrainCircuit,
  Bot,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

export const SystemDiagnostics: React.FC = () => {
  const { getDiagnostics, loading } = useApi();
  const { state } = useApp();
  const { wsState } = state;

  const [diagnostics, setDiagnostics] = useState<SystemDiagnosticsData | null>(null);
  const [browserChecks, setBrowserChecks] = useState<{
    micSupport: boolean;
    speechSupport: boolean;
    audioContextSupport: boolean;
  }>({
    micSupport: false,
    speechSupport: false,
    audioContextSupport: false,
  });

  const runDiagnostics = async () => {
    // 1. Run local client capability checks
    const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasSpeech = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasAudioCtx = !!(window.AudioContext || (window as any).webkitAudioContext);
    setBrowserChecks({
      micSupport: hasMic,
      speechSupport: hasSpeech,
      audioContextSupport: hasAudioCtx,
    });

    // 2. Query backend diagnostics endpoint
    try {
      const data = await getDiagnostics();
      if (data) {
        setDiagnostics(data);
      }
    } catch (e) {
      // Backend might be offline or initializing, create fallback structure
      console.warn('Diagnostics fetch failed:', e);
      setDiagnostics({
        api_health: 'Unknown',
        db_connectivity: 'Unknown',
        websocket: wsState === 'connected' ? 'connected' : 'Unknown',
        mic_support: hasMic ? 'supported' : 'unsupported',
        speech_recognition_support: hasSpeech ? 'supported' : 'unsupported',
        playwright_status: 'Unknown',
        ai_provider_config: {
          provider: 'FastAPI / Ollama / OpenAI',
          model: 'ZeroHertz-Intent-Engine',
          status: 'Unknown',
        },
        dsp_config: {
          sample_rate: 44100,
          fft_size: 2048,
          tone_detection_threshold: 140,
          goertzel_enabled: true,
          status: 'Active',
        },
        latest_errors: [],
      });
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0D252B] border border-[#29434A] rounded p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#FF642D]" />
            <h3 className="font-display text-base text-[#F4F3EF] tracking-wider uppercase">
              ZeroHertz Subsystem Diagnostics & Hardware Telemetry
            </h3>
          </div>
          <p className="text-xs text-[#9AAEB1] font-mono mt-0.5">
            GET /api/diagnostics — Real-time health metrics of microservices, AI providers, and audio capture pipeline
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded bg-[#FF642D] hover:bg-[#FF7A45] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Grid of Diagnostic Subsystems */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Subsystem 1: Core Network & API Backend */}
        <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#29434A] pb-2 text-[#F4F3EF] font-bold">
            <span className="flex items-center gap-1.5 uppercase">
              <Server className="w-4 h-4 text-[#FF642D]" />
              Core Infrastructure
            </span>
            <span className="text-[10px] text-[#9AAEB1]">NODE-01</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">FastAPI REST Health:</span>
              <StatusBadge status={diagnostics?.api_health || 'Unknown'} />
            </div>

            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">Database Connectivity:</span>
              <StatusBadge status={diagnostics?.db_connectivity || 'Unknown'} />
            </div>

            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">Bi-directional WebSocket:</span>
              <StatusBadge status={wsState} />
            </div>
          </div>
        </div>

        {/* Subsystem 2: Client Hardware & Audio Subsystems */}
        <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#29434A] pb-2 text-[#F4F3EF] font-bold">
            <span className="flex items-center gap-1.5 uppercase">
              <Mic className="w-4 h-4 text-[#FF642D]" />
              Browser Hardware Ingest
            </span>
            <span className="text-[10px] text-[#9AAEB1]">CLIENT AUDIO</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">Microphone API Support:</span>
              <StatusBadge status={browserChecks.micSupport ? 'supported' : 'unsupported'} />
            </div>

            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">Web Speech ASR Support:</span>
              <StatusBadge status={browserChecks.speechSupport ? 'supported' : 'unsupported'} />
            </div>

            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">Web Audio Oscillator DSP:</span>
              <StatusBadge status={browserChecks.audioContextSupport ? 'supported' : 'unsupported'} />
            </div>
          </div>
        </div>

        {/* Subsystem 3: Automation & Playwright Engine */}
        <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#29434A] pb-2 text-[#F4F3EF] font-bold">
            <span className="flex items-center gap-1.5 uppercase">
              <Bot className="w-4 h-4 text-[#FF642D]" />
              Automation Engine
            </span>
            <span className="text-[10px] text-[#9AAEB1]">HEADLESS WEB</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-[#07191D] p-2.5 rounded border border-[#29434A]">
              <span className="text-[#9AAEB1]">Playwright Browser:</span>
              <StatusBadge status={diagnostics?.playwright_status || 'Unknown'} />
            </div>

            <div className="bg-[#07191D] p-2.5 rounded border border-[#29434A] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#9AAEB1]">AI Intent Provider:</span>
                <span className="text-[#F4F3EF] font-bold">
                  {diagnostics?.ai_provider_config?.provider || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9AAEB1]">Model:</span>
                <span className="text-[#FF642D]">
                  {diagnostics?.ai_provider_config?.model || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="bg-[#07191D] p-2.5 rounded border border-[#29434A] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#9AAEB1]">Goertzel DSP Decoders:</span>
                <span className="text-[#22C55E] font-bold">
                  {diagnostics?.dsp_config?.goertzel_enabled ? 'ENABLED' : 'UNKNOWN'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9AAEB1]">Detection Sample Rate:</span>
                <span className="text-[#F4F3EF]">
                  {diagnostics?.dsp_config?.sample_rate || 44100} Hz
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Subsystem Errors & Exceptions */}
      <div className="bg-[#0D252B] border border-[#29434A] rounded p-4 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#29434A] pb-2">
          <span className="flex items-center gap-2 text-[#F4F3EF] font-bold uppercase">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            Latest Diagnostic Faults & Error Log
          </span>
          <span className="text-[11px] text-[#9AAEB1]">
            {diagnostics?.latest_errors ? diagnostics.latest_errors.length : 0} Anomaly Events
          </span>
        </div>

        {diagnostics?.latest_errors && diagnostics.latest_errors.length > 0 ? (
          <div className="space-y-2">
            {diagnostics.latest_errors.map((err, i) => (
              <div
                key={i}
                className="bg-[#07191D] p-3 rounded border border-red-900/50 flex items-start gap-3 text-red-300"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-[#FF642D] uppercase">
                      [{err.module}]
                    </span>
                    <span className="text-[10px] text-[#9AAEB1]">
                      {formatTelemetryTime(err.timestamp)}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono leading-relaxed">{err.message}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[#9AAEB1] text-xs">
            <CheckCircle2 className="w-6 h-6 text-[#22C55E] mx-auto mb-1.5" />
            No active hardware or microservice faults detected. All systems nominal.
          </div>
        )}
      </div>
    </div>
  );
};
