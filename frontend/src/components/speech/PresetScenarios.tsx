import React from 'react';
import { PresetScenario } from '../../types';
import { HeartPulse, Landmark, ShieldAlert, Sparkles } from 'lucide-react';

interface PresetScenariosProps {
  onSelectScenario: (scenario: PresetScenario) => void;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'healthcare',
    title: 'Healthcare Appointment',
    service: 'healthcare_appointment',
    language: 'en-IN',
    description: 'AIIMS Cardiology OPD Consultation Booking',
    transcript:
      'I need to book an urgent cardiology OPD appointment at AIIMS New Delhi for patient Ramesh Kumar with Dr. Sharma next Monday morning.',
    parameters: {
      hospital: 'AIIMS New Delhi',
      department: 'Cardiology',
      doctor: 'Dr. Sharma',
      preferred_date: 'Next Monday',
      slot: 'Morning',
      patient_name: 'Ramesh Kumar',
    },
  },
  {
    id: 'pension',
    title: 'Pension Grievance',
    service: 'pension_grievance',
    language: 'hi-IN',
    description: 'EPS-95 Pension Arrears Non-Credit Grievance',
    transcript:
      'मेरी जुलाई और अगस्त महीने की 4,800 रुपये की मासिक पेंशन अभी तक खाते में नहीं आई है। कृपया सीपीग्राम्स पर तत्काल शिकायत दर्ज करें।',
    parameters: {
      pension_type: 'EPS-95',
      pending_amount: 4800,
      months_pending: ['July', 'August'],
      portal: 'CPGRAMS',
      urgency: 'HIGH',
    },
  },
  {
    id: 'bank_freeze',
    title: 'Emergency Bank Freeze',
    service: 'bank_freeze',
    language: 'en-IN',
    description: 'Immediate Fraud Lock & Account Freeze',
    transcript:
      'Emergency: Unauthorized cyber fraud debit of 25,000 rupees detected on savings account 4819. Block all UPI access and freeze debit cards immediately.',
    parameters: {
      account_tail: '4819',
      disputed_amount: 25000,
      incident_type: 'Cyber Fraud',
      action_requested: 'BLOCK_UPI_AND_FREEZE_ACCOUNT',
      priority: 'CRITICAL',
    },
  },
];

export const PresetScenarios: React.FC<PresetScenariosProps> = ({ onSelectScenario }) => {
  return (
    <div className="bg-[#ffffff] border border-[#dce3df] rounded p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-[#dce3df] pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#bd5e3b]" />
          <h3 className="font-display text-sm tracking-wide text-[#20312e]">
            Preset Citizen Automation Scenarios
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#667773]">
          Click to load into editor (No auto-submit)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PRESET_SCENARIOS.map((sc) => {
          const Icon =
            sc.id === 'healthcare'
              ? HeartPulse
              : sc.id === 'pension'
              ? Landmark
              : ShieldAlert;

          const iconColor =
            sc.id === 'healthcare'
              ? 'text-cyan-400'
              : sc.id === 'pension'
              ? 'text-[#8b5c1c]'
              : 'text-[#a63f37]';

          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc)}
              className="text-left bg-[#f4f5f2] hover:bg-[#f0f3ef] p-3 rounded border border-[#dce3df] hover:border-[#bd5e3b]/60 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-bold text-xs text-[#20312e] group-hover:text-[#bd5e3b] transition-colors flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    {sc.title}
                  </span>
                  <span className="text-[10px] font-mono bg-[#f0f3ef] text-[#667773] px-1.5 py-0.5 rounded border border-[#dce3df]">
                    {sc.language}
                  </span>
                </div>
                <p className="text-[11px] text-[#667773] line-clamp-2 leading-relaxed">
                  {sc.description}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#dce3df]/50 flex items-center justify-between text-[10px] font-mono text-[#bd5e3b]">
                <span>LOAD SCENARIO</span>
                <span>→</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
