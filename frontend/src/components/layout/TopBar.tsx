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
    <header className="relative z-20 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-[#dce3df] bg-white px-3 sm:px-5">
      {/* Left: Environment & Active Session Summary */}
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#39736b]" />
          <span className="truncate text-xs font-semibold text-[#20312e] sm:text-sm">
            ZeroHertz <span className="font-normal text-[#87958f]">/ Network operations</span>
          </span>
        </div>

        {activeSession ? (
          <div className="hidden items-center gap-2 rounded-md bg-[#f4f5f2] px-2.5 py-1 text-xs md:flex">
            <Layers className="h-3.5 w-3.5 text-[#39736b]" />
            <span className="text-[#667773]">
              Session <span className="font-medium text-[#20312e]">{activeSession.id.slice(0, 8)}</span>
            </span>
            <span className="text-[#87958f]">·</span>
            <span className="text-xs font-medium text-[#39736b]">
              {activeSession.workflow_stage}
            </span>
          </div>
        ) : (
          <div className="hidden items-center gap-2 text-xs text-[#87958f] lg:flex">
            <span>Standby</span>
          </div>
        )}
      </div>

      {/* Right: Hardware & Connection Indicators + Telemetry Clock + Narrator Controls */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* WebSocket Backend State */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Wifi className="hidden h-3.5 w-3.5 text-[#87958f] sm:block" />
          <span className="sr-only sm:not-sr-only sm:text-[11px] sm:text-[#667773]">Backend</span>
          <StatusBadge status={wsState} showDot={true} />
        </div>

        {/* Microphone State */}
        <div className="hidden items-center gap-1.5 md:flex">
          <Mic className="h-3.5 w-3.5 text-[#87958f]" />
          <span className="text-[11px] font-mono text-[#667773] hidden sm:inline">MIC</span>
          <StatusBadge status={micState} showDot={true} />
        </div>

        {/* Acoustic DSP Engine State */}
        <div className="hidden items-center gap-1.5 lg:flex">
          <Activity className="h-3.5 w-3.5 text-[#87958f]" />
          <span className="text-[11px] font-mono text-[#667773] hidden sm:inline">DSP</span>
          <StatusBadge status={acousticEngineState} showDot={true} />
        </div>

        {/* Narrator Controls */}
        <div className="flex items-center gap-1 rounded-md bg-[#f4f5f2] px-1.5 py-1 sm:px-2">
          <button
            onClick={() => dispatch({ type: 'SET_NARRATOR_ENABLED', payload: !narratorEnabled })}
            className={`rounded p-1 transition-colors ${
              narratorEnabled
                ? 'text-[#28734f] hover:text-[#28734f]/80'
                : 'text-[#667773] hover:text-[#20312e]'
            }`}
            title={narratorEnabled ? 'Mute Audio Narrator' : 'Unmute Audio Narrator'}
          >
            {narratorEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          <div className="border-l border-[#dce3df] h-3 mx-1" />

          <button
            onClick={() =>
              dispatch({
                type: 'SET_NARRATOR_LANG',
                payload: narratorLang === 'en-IN' ? 'hi-IN' : 'en-IN',
              })
            }
            className="flex items-center gap-1 px-1 text-[11px] font-semibold text-[#667773] transition-colors hover:text-[#39736b]"
            title="Toggle Voice Language (English / Hindi)"
          >
            <Globe className="w-3 h-3" />
            <span>{narratorLang === 'en-IN' ? 'EN' : 'HI'}</span>
          </button>
        </div>

        {/* Precision Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f4f5f2] border border-[#dce3df] font-mono text-xs text-[#667773]">
          <Clock className="w-3.5 h-3.5 text-[#bd5e3b]" />
          <span className="text-[#20312e] font-bold">{currentTime}</span>
        </div>
      </div>
    </header>
  );
};
