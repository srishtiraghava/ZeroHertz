import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useApi } from '../../hooks/useApi';
import { useNarrator } from '../../hooks/useNarrator';
import { StatusBadge } from '../common/StatusBadge';
import { formatTelemetryTime, formatConfidence } from '../../utils/format';
import {
  ShieldAlert,
  RotateCcw,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  Terminal,
  Activity,
  Layers,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';

const WORKFLOW_STEPS = [
  { step: 1, title: 'Request received', desc: 'Audio / ASR ingest into node' },
  { step: 2, title: 'Intent parsed', desc: 'NLP schema extraction & validation' },
  { step: 3, title: 'Portal opened', desc: 'Headless browser portal session initialized' },
  { step: 4, title: 'Fields populated', desc: 'Form values injected into citizen portal' },
  { step: 5, title: 'Awaiting confirmation', desc: 'Acoustic air-gap verification required' },
  { step: 6, title: 'Confirmation verified', desc: 'DTMF dual-sine token cryptographic match' },
  { step: 7, title: 'Submission completed', desc: 'Form committed to government portal' },
  { step: 8, title: 'Receipt available', desc: 'Cryptographic receipt & transaction hash generated' },
];

export const TransactionExecution: React.FC = () => {
  const { state, dispatch } = useApp();
  const { activeSession } = state;
  const { cancelSession, retrySession } = useApi();
  const { speak, notifySuccess } = useNarrator();
  const prevStepRef = useRef<number>(0);

  // Trigger audio narrator on step progression
  useEffect(() => {
    if (!activeSession) return;
    const currentStep = activeSession.workflow_step;

    if (currentStep !== prevStepRef.current) {
      prevStepRef.current = currentStep;

      // Find step title
      const stepItem = WORKFLOW_STEPS.find((s) => s.step === currentStep);
      if (stepItem) {
        if (currentStep === 5) {
          speak('Awaiting acoustic confirmation. Please transmit your authorization tone.');
        } else if (currentStep === 7 || currentStep === 8) {
          notifySuccess('Transaction successfully verified and submitted to portal.');
        } else {
          speak(stepItem.title);
        }
      }
    }
  }, [activeSession?.workflow_step, speak, notifySuccess]);

  if (!activeSession) {
    return (
      <div className="bg-[#ffffff] border border-[#dce3df] rounded p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
        <Activity className="w-10 h-10 text-[#667773] mb-3" />
        <h3 className="font-display text-base text-[#20312e] mb-1">
          No Active Transaction Execution
        </h3>
        <p className="text-xs text-[#667773] max-w-md">
          Execute a transaction request from the Speech & Intent panel or await an inbound citizen portal request.
        </p>
      </div>
    );
  }

  const currentStep = activeSession.workflow_step || 1;
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
    <div className="space-y-6">
      {/* Session Title Bar */}
      <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#667773]">EXECUTION NODE:</span>
            <span className="font-mono text-sm font-bold text-[#20312e] bg-[#f0f3ef] px-2.5 py-1 rounded border border-[#dce3df]">
              {activeSession.id}
            </span>
          </div>
          <StatusBadge status={activeSession.state} pulse={isAwaitingConfirmation} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f0f3ef] hover:bg-[#f0f3ef]/80 text-[#667773] hover:text-[#20312e] text-xs font-mono border border-[#dce3df] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Transaction
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f8ecea] hover:bg-[#f1dedb] text-[#a63f37] text-xs font-mono border border-[#e8cbc7] transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
            Cancel Session
          </button>
        </div>
      </div>

      {/* Prominent Awaiting Confirmation Panel */}
      {isAwaitingConfirmation && (
        <div className="bg-[#bd5e3b]/10 border-2 border-[#bd5e3b] rounded-lg p-5  ">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#bd5e3b]/20 border border-[#bd5e3b] flex items-center justify-center text-[#bd5e3b]">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="font-display text-lg tracking-wider text-[#bd5e3b] uppercase">
                  AWAITING AIR-GAPPED ACOUSTIC CONFIRMATION (STAGE 5/8)
                </h4>
                <p className="text-xs text-[#20312e] mt-0.5">
                  Playwright has prepared portal form fields. Citizen must transmit authorization DTMF tone{' '}
                  <span className="font-mono text-base font-bold text-[#bd5e3b] underline">
                    [{activeSession.acoustic_confirmation?.expected_symbol || '5'}]
                  </span>{' '}
                  via microphone to proceed with submission.
                </p>
              </div>
            </div>

            <button
              onClick={() => dispatch({ type: 'SET_TAB', payload: 'acoustic' })}
              className="px-4 py-2.5 rounded bg-[#bd5e3b] hover:bg-[#a94c2e] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-lg"
            >
              Open Acoustic Transmitter
            </button>
          </div>
        </div>
      )}

      {/* 8-Step Step-by-Step Workflow Pipeline */}
      <div className="bg-[#ffffff] border border-[#dce3df] rounded p-5">
        <div className="flex items-center justify-between border-b border-[#dce3df] pb-3 mb-5">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#bd5e3b]" />
            <h3 className="font-display text-sm tracking-wide text-[#20312e]">
              8-Stage Air-Gapped Automation Pipeline
            </h3>
          </div>
          <span className="text-xs font-mono text-[#bd5e3b] font-bold">
            STAGE {currentStep} OF 8: {activeSession.workflow_stage.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {WORKFLOW_STEPS.map((stepItem) => {
            const isCompleted = stepItem.step < currentStep;
            const isCurrent = stepItem.step === currentStep;

            return (
              <div
                key={stepItem.step}
                className={`p-3.5 rounded border transition-all relative ${
                  isCurrent
                    ? 'bg-[#f0f3ef] border-[#bd5e3b] shadow-[0_0_12px_rgba(255,100,45,0.3)]'
                    : isCompleted
                    ? 'bg-[#f4f5f2] border-emerald-800/60'
                    : 'bg-[#f4f5f2]/60 border-[#dce3df]/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                      isCurrent
                        ? 'bg-[#bd5e3b] text-white'
                        : isCompleted
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#f0f3ef] text-[#667773]'
                    }`}
                  >
                    {stepItem.step}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#bd5e3b] " />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-[#667773]/60" />
                  )}
                </div>

                <div className="font-mono text-xs font-bold text-[#20312e] mb-0.5">
                  {stepItem.title}
                </div>
                <div className="text-[10px] text-[#667773] leading-tight">
                  {stepItem.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dual Split: Portal Preview & Automation Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portal Preview / Live Automation Frame */}
        <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-[#dce3df] pb-2 mb-3 text-xs font-mono">
            <span className="text-[#667773] flex items-center gap-1.5 uppercase">
              <ExternalLink className="w-3.5 h-3.5 text-[#bd5e3b]" />
              Government Portal Automation Viewport
            </span>
            <a
              href="/portal.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#bd5e3b] hover:underline flex items-center gap-1 text-[11px]"
            >
              Open Standalone <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex-1 bg-[#f4f5f2] rounded border border-[#dce3df] overflow-hidden relative">
            <iframe
              src={activeSession.portal_preview_url || '/portal.html'}
              title="Citizen Portal Automation Preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>

        {/* Automation Execution Log Stream */}
        <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-[#dce3df] pb-2 mb-3 text-xs font-mono">
            <span className="text-[#667773] flex items-center gap-1.5 uppercase">
              <Terminal className="w-3.5 h-3.5 text-[#bd5e3b]" />
              Playwright & DSP Automation Trace
            </span>
            <span className="text-[10px] text-[#28734f]">AIRGAP BUS ACTIVE</span>
          </div>

          <div className="flex-1 bg-[#f4f5f2] rounded border border-[#dce3df] p-3 overflow-y-auto font-mono text-[11px] space-y-1.5 text-[#667773]">
            <div className="text-[#bd5e3b]">
              [0Hz-SYSTEM] Initialized execution loop for session {activeSession.id}
            </div>
            {activeSession.automation_log.map((log, index) => (
              <div key={index} className="leading-relaxed">
                <span className="text-[#28734f]">[{index + 1}]</span> {log}
              </div>
            ))}
            {isAwaitingConfirmation && (
              <div className="text-[#bd5e3b] font-bold  pt-2 border-t border-[#dce3df]">
                &gt;&gt; PAUSED: Awaiting citizen acoustic authorization token...
              </div>
            )}
            {activeSession.state === 'completed' && (
              <div className="text-emerald-400 font-bold pt-2 border-t border-emerald-900">
                &gt;&gt; COMPLETED: Transaction receipt generated and archived to Audit Ledger.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
