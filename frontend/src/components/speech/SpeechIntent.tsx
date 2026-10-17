import React, { useState } from 'react';
import { PresetScenarios } from './PresetScenarios';
import { TranscriptInput } from './TranscriptInput';
import { PresetScenario } from '../../types';

export const SpeechIntent: React.FC = () => {
  const [selectedTranscript, setSelectedTranscript] = useState<string>('');
  const [selectedLang, setSelectedLang] = useState<'hi-IN' | 'en-IN'>('en-IN');

  const handleSelectScenario = (scenario: PresetScenario) => {
    setSelectedTranscript(scenario.transcript);
    setSelectedLang(scenario.language);
  };

  return (
    <div className="space-y-6">
      {/* 3 Preset Scenarios Bar */}
      <PresetScenarios onSelectScenario={handleSelectScenario} />

      {/* Speech Ingest & Intent Parsing Editor */}
      <TranscriptInput
        initialTranscript={selectedTranscript}
        initialLanguage={selectedLang}
      />
    </div>
  );
};
