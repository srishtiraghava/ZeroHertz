import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { formatTelemetryTime, formatConfidence } from '../../utils/format';
import {
  Terminal,
  Cpu,
  Radio,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Ban,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';

export const LiveSession: React.FC = () => {
  const { state, dispatch } = useApp();
  const { activeSession } = state;
  const { cancelSession, retrySession } = useApi();

  if (!activeSession) {
    return (
      <div className="bg-[#0D252B] border border-[#29434A] rounded p-6 flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="w-12 h-12 rounded-full bg-[#12343B] border border-[#29434A] flex items-center justify-center mb-3 text-[#9AAEB1]">
          <Terminal className="w-6 h-6 text-[#9AAEB1]" />
        </div>
        <h3 className="font-display text-base text-[#F4F3EF] mb-1">
          No Active Transaction Session
        </h3>
        <p className="text-xs text-[#9AAEB1] max-w-md mb-4">
          Initiate an acoustic transaction via the Speech & Intent panel or execute an automated citizen portal request.
        </p>
        <button
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'speech' })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#FF642D] hover:bg-[#FF7A45] text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
        >
          Launch Speech & Intent
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isAwaitingConfirmation =
    activeSession.state === 'awaiting_confirmation' ||
    activeSession.workflow_stage === 'Awaiting confirmation';

  const handleCancel = async () => {
    try {
      await cancelSession(activeSession.id);
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { state: 'cancelled', workflow_stage: 'Idle' },
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetry = async () => {
    try {
      await retrySession(activeSession.id);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`bg-[#0D252B] border rounded p-4 relative overflow-hidden ${
      isAwaitingConfirmation ? 'border-[#FF642D] shadow-[0_0_15px_rgba(255,100,45,0.25)]' : 'border-[#29434A]'
    }`}>
      {/* Session Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#29434A] pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#9AAEB1]">SESSION ID:</span>
            <span className="font-mono text-sm font-bold text-[#F4F3EF] bg-[#12343B] px-2 py-0.5 rounded border border-[#29434A]">
              {activeSession.id}
            </span>
          </div>
          <StatusBadge status={activeSession.state} pulse={isAwaitingConfirmation} />
          <span className="text-[11px] font-mono text-[#9AAEB1] uppercase bg-[#07191D] px-2 py-0.5 rounded border border-[#29434A]">
            CHANNEL: <span className="text-[#FF642D] font-bold">{activeSession.input_channel}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-[#12343B] hover:bg-[#12343B]/80 text-[#9AAEB1] hover:text-[#F4F3EF] border border-[#29434A] transition-colors"
            title="Retry session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RETRY</span>
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 transition-colors"
            title="Cancel session"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>CANCEL</span>
          </button>
        </div>
      </div>

      {/* Prominent Awaiting Confirmation Banner */}
      {isAwaitingConfirmation && (
        <div className="mb-4 p-3 bg-[#FF642D]/10 border border-[#FF642D]/60 rounded flex items-center justify-between flex-wrap gap-2 animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#FF642D]" />
            <div>
              <div className="text-xs font-bold text-[#FF642D] font-mono tracking-wider uppercase">
                AWAITING AIR-GAPPED ACOUSTIC CONFIRMATION
              </div>
              <div className="text-[11px] text-[#F4F3EF]">
                Citizen must transmit DTMF key{' '}
                <strong className="text-[#FF642D] underline text-sm">
                  [{activeSession.acoustic_confirmation?.expected_symbol || '5'}]
                </strong>{' '}
                or sequence to authorize transaction submission.
              </div>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_TAB', payload: 'acoustic' })}
            className="px-3 py-1.5 rounded bg-[#FF642D] hover:bg-[#FF7A45] text-white text-xs font-mono font-bold uppercase transition-colors"
          >
            Open Acoustic Keypad
          </button>
        </div>
      )}

      {/* Main Grid: Transcript & Intent on Left, Workflow Stage & Acoustic Confirmation on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Speech Ingest & Extracted Intent */}
        <div className="space-y-3">
          {/* Transcript Box */}
          <div className="bg-[#07191D] border border-[#29434A] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9AAEB1] mb-1.5">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-[#FF642D]" />
                Ingested Transcript
              </span>
              <span className="text-[10px]">
                {activeSession.created_at ? formatTelemetryTime(activeSession.created_at) : 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-[#F4F3EF] font-mono bg-[#0D252B] p-2.5 rounded border border-[#29434A]/60 leading-relaxed italic">
              "{activeSession.transcript || 'No transcript text ingested yet.'}"
            </p>
          </div>

          {/* Parsed Intent Schema */}
          <div className="bg-[#07191D] border border-[#29434A] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9AAEB1] mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5 text-[#FF642D]" />
                Parsed Intent & Schema Validation
              </span>
              {activeSession.intent && (
                <span className="text-[10px] text-[#22C55E]">
                  CONF: {formatConfidence(activeSession.intent.confidence)}
                </span>
              )}
            </div>

            {activeSession.intent ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between bg-[#0D252B] p-2 rounded border border-[#29434A]/60">
                  <span className="text-[#9AAEB1]">Target Service:</span>
                  <span className="text-[#FF642D] font-bold uppercase">
                    {activeSession.intent.service}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-[#0D252B] p-2 rounded border border-[#29434A]/60">
                  <span className="text-[#9AAEB1]">Language Code:</span>
                  <span className="text-[#F4F3EF] uppercase">
                    {activeSession.intent.language}
                  </span>
                </div>
                <div className="bg-[#0D252B] p-2 rounded border border-[#29434A]/60">
                  <span className="text-[#9AAEB1] block mb-1 text-[10px] uppercase">
                    Extracted Parameters:
                  </span>
                  <pre className="text-[11px] text-[#22C55E] overflow-x-auto">
                    {JSON.stringify(activeSession.intent.parameters, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#9AAEB1] font-mono py-4 text-center">
                Waiting for NLP parser execution...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Stage & Acoustic Confirmation Status */}
        <div className="space-y-3">
          {/* Workflow Stage */}
          <div className="bg-[#07191D] border border-[#29434A] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9AAEB1] mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <FileCheck2 className="w-3.5 h-3.5 text-[#FF642D]" />
                Workflow Pipeline Progress
              </span>
              <span className="text-xs font-bold text-[#FF642D]">
                Step {activeSession.workflow_step} / 8
              </span>
            </div>

            <div className="bg-[#0D252B] p-3 rounded border border-[#29434A]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F4F3EF]">
                  {activeSession.workflow_stage}
                </span>
                <StatusBadge status={activeSession.workflow_stage} />
              </div>

              {/* Step indicator bar */}
              <div className="grid grid-cols-8 gap-1 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((stepNum) => {
                  const isDone = stepNum < activeSession.workflow_step;
                  const isCurrent = stepNum === activeSession.workflow_step;
                  return (
                    <div
                      key={stepNum}
                      className={`h-2 rounded-xs transition-all ${
                        isCurrent
                          ? 'bg-[#FF642D] shadow-[0_0_8px_#FF642D]'
                          : isDone
                          ? 'bg-[#22C55E]'
                          : 'bg-[#12343B]'
                      }`}
                      title={`Step ${stepNum}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Acoustic Confirmation Status */}
          <div className="bg-[#07191D] border border-[#29434A] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9AAEB1] mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 text-[#FF642D]" />
                Acoustic Tone Verification
              </span>
              <ShieldCheck className="w-4 h-4 text-[#FF642D]" />
            </div>

            <div className="bg-[#0D252B] p-3 rounded border border-[#29434A]/60 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#9AAEB1]">Expected Symbol:</span>
                <span className="text-[#FF642D] font-bold text-sm bg-[#12343B] px-2 py-0.5 rounded border border-[#29434A]">
                  {activeSession.acoustic_confirmation?.expected_symbol || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9AAEB1]">Received Symbol:</span>
                <span className="text-[#F4F3EF] font-bold text-sm bg-[#12343B] px-2 py-0.5 rounded border border-[#29434A]">
                  {activeSession.acoustic_confirmation?.received_code || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9AAEB1]">Cryptographic Status:</span>
                {activeSession.acoustic_confirmation?.verified ? (
                  <span className="text-[#22C55E] font-bold uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    VERIFIED // AUDIT RECORDED
                  </span>
                ) : (
                  <span className="text-[#9AAEB1] uppercase">
                    {isAwaitingConfirmation ? 'LISTENING ON MIC...' : 'PENDING'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
