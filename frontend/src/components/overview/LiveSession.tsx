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
      <div className="bg-[#ffffff] border border-[#dce3df] rounded p-6 flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="w-12 h-12 rounded-full bg-[#f0f3ef] border border-[#dce3df] flex items-center justify-center mb-3 text-[#667773]">
          <Terminal className="w-6 h-6 text-[#667773]" />
        </div>
        <h3 className="font-display text-base text-[#20312e] mb-1">
          No Active Transaction Session
        </h3>
        <p className="text-xs text-[#667773] max-w-md mb-4">
          Initiate an acoustic transaction via the Speech & Intent panel or execute an automated citizen portal request.
        </p>
        <button
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'speech' })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#bd5e3b] hover:bg-[#a94c2e] text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
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
    <div className={`bg-[#ffffff] border rounded p-4 relative overflow-hidden ${
      isAwaitingConfirmation ? 'border-[#bd5e3b] ' : 'border-[#dce3df]'
    }`}>
      {/* Session Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce3df] pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#667773]">SESSION ID:</span>
            <span className="font-mono text-sm font-bold text-[#20312e] bg-[#f0f3ef] px-2 py-0.5 rounded border border-[#dce3df]">
              {activeSession.id}
            </span>
          </div>
          <StatusBadge status={activeSession.state} pulse={isAwaitingConfirmation} />
          <span className="text-[11px] font-mono text-[#667773] uppercase bg-[#f4f5f2] px-2 py-0.5 rounded border border-[#dce3df]">
            CHANNEL: <span className="text-[#bd5e3b] font-bold">{activeSession.input_channel}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-[#f0f3ef] hover:bg-[#f0f3ef]/80 text-[#667773] hover:text-[#20312e] border border-[#dce3df] transition-colors"
            title="Retry session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RETRY</span>
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-[#f8ecea] hover:bg-[#f1dedb] text-[#a63f37] border border-[#e8cbc7] transition-colors"
            title="Cancel session"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>CANCEL</span>
          </button>
        </div>
      </div>

      {/* Prominent Awaiting Confirmation Banner */}
      {isAwaitingConfirmation && (
        <div className="mb-4 p-3 bg-[#bd5e3b]/10 border border-[#bd5e3b]/60 rounded flex items-center justify-between flex-wrap gap-2 ">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#bd5e3b]" />
            <div>
              <div className="text-xs font-bold text-[#bd5e3b] font-mono tracking-wider uppercase">
                AWAITING AIR-GAPPED ACOUSTIC CONFIRMATION
              </div>
              <div className="text-[11px] text-[#20312e]">
                Citizen must transmit DTMF key{' '}
                <strong className="text-[#bd5e3b] underline text-sm">
                  [{activeSession.acoustic_confirmation?.expected_symbol || '5'}]
                </strong>{' '}
                or sequence to authorize transaction submission.
              </div>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_TAB', payload: 'acoustic' })}
            className="px-3 py-1.5 rounded bg-[#bd5e3b] hover:bg-[#a94c2e] text-white text-xs font-mono font-bold uppercase transition-colors"
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
          <div className="bg-[#f4f5f2] border border-[#dce3df] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#667773] mb-1.5">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-[#bd5e3b]" />
                Ingested Transcript
              </span>
              <span className="text-[10px]">
                {activeSession.created_at ? formatTelemetryTime(activeSession.created_at) : 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-[#20312e] font-mono bg-[#ffffff] p-2.5 rounded border border-[#dce3df]/60 leading-relaxed italic">
              "{activeSession.transcript || 'No transcript text ingested yet.'}"
            </p>
          </div>

          {/* Parsed Intent Schema */}
          <div className="bg-[#f4f5f2] border border-[#dce3df] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#667773] mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5 text-[#bd5e3b]" />
                Parsed Intent & Schema Validation
              </span>
              {activeSession.intent && (
                <span className="text-[10px] text-[#28734f]">
                  CONF: {formatConfidence(activeSession.intent.confidence)}
                </span>
              )}
            </div>

            {activeSession.intent ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between bg-[#ffffff] p-2 rounded border border-[#dce3df]/60">
                  <span className="text-[#667773]">Target Service:</span>
                  <span className="text-[#bd5e3b] font-bold uppercase">
                    {activeSession.intent.service}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-[#ffffff] p-2 rounded border border-[#dce3df]/60">
                  <span className="text-[#667773]">Language Code:</span>
                  <span className="text-[#20312e] uppercase">
                    {activeSession.intent.language}
                  </span>
                </div>
                <div className="bg-[#ffffff] p-2 rounded border border-[#dce3df]/60">
                  <span className="text-[#667773] block mb-1 text-[10px] uppercase">
                    Extracted Parameters:
                  </span>
                  <pre className="text-[11px] text-[#28734f] overflow-x-auto">
                    {JSON.stringify(activeSession.intent.parameters, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#667773] font-mono py-4 text-center">
                Waiting for NLP parser execution...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Stage & Acoustic Confirmation Status */}
        <div className="space-y-3">
          {/* Workflow Stage */}
          <div className="bg-[#f4f5f2] border border-[#dce3df] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#667773] mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <FileCheck2 className="w-3.5 h-3.5 text-[#bd5e3b]" />
                Workflow Pipeline Progress
              </span>
              <span className="text-xs font-bold text-[#bd5e3b]">
                Step {activeSession.workflow_step} / 8
              </span>
            </div>

            <div className="bg-[#ffffff] p-3 rounded border border-[#dce3df]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#20312e]">
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
                          ? 'bg-[#bd5e3b] shadow-[0_0_8px_#bd5e3b]'
                          : isDone
                          ? 'bg-[#28734f]'
                          : 'bg-[#f0f3ef]'
                      }`}
                      title={`Step ${stepNum}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Acoustic Confirmation Status */}
          <div className="bg-[#f4f5f2] border border-[#dce3df] rounded p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#667773] mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 text-[#bd5e3b]" />
                Acoustic Tone Verification
              </span>
              <ShieldCheck className="w-4 h-4 text-[#bd5e3b]" />
            </div>

            <div className="bg-[#ffffff] p-3 rounded border border-[#dce3df]/60 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#667773]">Expected Symbol:</span>
                <span className="text-[#bd5e3b] font-bold text-sm bg-[#f0f3ef] px-2 py-0.5 rounded border border-[#dce3df]">
                  {activeSession.acoustic_confirmation?.expected_symbol || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667773]">Received Symbol:</span>
                <span className="text-[#20312e] font-bold text-sm bg-[#f0f3ef] px-2 py-0.5 rounded border border-[#dce3df]">
                  {activeSession.acoustic_confirmation?.received_code || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667773]">Cryptographic Status:</span>
                {activeSession.acoustic_confirmation?.verified ? (
                  <span className="text-[#28734f] font-bold uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    VERIFIED // AUDIT RECORDED
                  </span>
                ) : (
                  <span className="text-[#667773] uppercase">
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
