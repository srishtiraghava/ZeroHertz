import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  Wifi,
  Mic,
  Activity,
  Volume2,
  VolumeX,
  Server,
  Layers,
  Globe,
  Clock,
} from 'lucide-react';
import { formatTelemetryTime } from '../../utils/format';

export const TopBar: React.FC = () => {
  const { state, dispatch } = useApp();
  const {
    wsState,
    micState,
    acousticEngineState,
    activeSession,
    narratorEnabled,
    narratorLang,
  } = state;

  const [currentTime, setCurrentTime] = useState<string>('--:--:--');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        `${('0' + now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}:${('0' + now.getSeconds()).slice(-2)}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-[#0D252B] border-b border-[#29434A] px-4 flex items-center justify-between select-none z-20">
      {/* Left: Environment & Active Session Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#07191D] border border-[#29434A]">
          <span className="w-2 h-2 rounded-full bg-[#FF642D] animate-ping" />
          <span className="text-xs font-mono font-bold tracking-wider text-[#F4F3EF]">
            TELECOM NODE: <span className="text-[#FF642D]">0HZ-AIRGAP</span>
          </span>
        </div>

        {activeSession ? (
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-[#12343B] border border-[#29434A]">
            <Layers className="w-3.5 h-3.5 text-[#FF642D]" />
            <span className="text-xs font-mono text-[#9AAEB1]">
              SESSION: <span className="text-[#F4F3EF] font-semibold">{activeSession.id.slice(0, 8)}</span>
            </span>
            <span className="text-[#29434A]">|</span>
            <span className="text-xs font-mono text-[#FF642D] font-bold">
              {activeSession.workflow_stage}
            </span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#9AAEB1]">
            <span className="text-[11px] text-[#9AAEB1]/70">STANDBY // NO ACTIVE SESSION</span>
          </div>
        )}
      </div>

      {/* Right: Hardware & Connection Indicators + Telemetry Clock + Narrator Controls */}
      <div className="flex items-center gap-3">
        {/* WebSocket Backend State */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#07191D] border border-[#29434A]">
          <Wifi className="w-3.5 h-3.5 text-[#9AAEB1]" />
          <span className="text-[11px] font-mono text-[#9AAEB1] hidden sm:inline">BACKEND</span>
          <StatusBadge status={wsState} pulse={wsState === 'connecting'} showDot={true} />
        </div>

        {/* Microphone State */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#07191D] border border-[#29434A]">
          <Mic className="w-3.5 h-3.5 text-[#9AAEB1]" />
          <span className="text-[11px] font-mono text-[#9AAEB1] hidden sm:inline">MIC</span>
          <StatusBadge status={micState} pulse={micState === 'active'} showDot={true} />
        </div>

        {/* Acoustic DSP Engine State */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#07191D] border border-[#29434A]">
          <Activity className="w-3.5 h-3.5 text-[#9AAEB1]" />
          <span className="text-[11px] font-mono text-[#9AAEB1] hidden sm:inline">DSP</span>
          <StatusBadge status={acousticEngineState} pulse={acousticEngineState === 'transmitting'} showDot={true} />
        </div>

        {/* Narrator Controls */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#07191D] border border-[#29434A]">
          <button
            onClick={() => dispatch({ type: 'SET_NARRATOR_ENABLED', payload: !narratorEnabled })}
            className={`p-1 rounded transition-colors ${
              narratorEnabled
                ? 'text-[#22C55E] hover:text-[#22C55E]/80'
                : 'text-[#9AAEB1] hover:text-[#F4F3EF]'
            }`}
            title={narratorEnabled ? 'Mute Audio Narrator' : 'Unmute Audio Narrator'}
          >
            {narratorEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          <div className="border-l border-[#29434A] h-3 mx-1" />

          <button
            onClick={() =>
              dispatch({
                type: 'SET_NARRATOR_LANG',
                payload: narratorLang === 'en-IN' ? 'hi-IN' : 'en-IN',
              })
            }
            className="text-[11px] font-mono font-bold text-[#9AAEB1] hover:text-[#FF642D] transition-colors flex items-center gap-1 px-1"
            title="Toggle Voice Language (English / Hindi)"
          >
            <Globe className="w-3 h-3" />
            <span>{narratorLang === 'en-IN' ? 'EN' : 'HI'}</span>
          </button>
        </div>

        {/* Precision Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#07191D] border border-[#29434A] font-mono text-xs text-[#9AAEB1]">
          <Clock className="w-3.5 h-3.5 text-[#FF642D]" />
          <span className="text-[#F4F3EF] font-bold">{currentTime}</span>
        </div>
      </div>
    </header>
  );
};
