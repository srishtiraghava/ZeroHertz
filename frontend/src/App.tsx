import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { CommandCenter } from './components/overview/CommandCenter';
import { AcousticModem } from './components/acoustic/AcousticModem';
import { SpeechIntent } from './components/speech/SpeechIntent';
import { TransactionExecution } from './components/transactions/TransactionExecution';
import { TransactionHistory } from './components/transactions/TransactionHistory';
import { AuditLedger } from './components/audit/AuditLedger';
import { SystemDiagnostics } from './components/diagnostics/SystemDiagnostics';
import { useWebSocket } from './hooks/useWebSocket';

const DashboardContent: React.FC = () => {
  const { state } = useApp();
  const { currentTab, activeSession } = state;
  // Initialize WebSocket connection bus
  useWebSocket();

  return (
    <AppShell>
      {currentTab === 'overview' && <CommandCenter />}
      {currentTab === 'acoustic' && <AcousticModem />}
      {currentTab === 'speech' && <SpeechIntent />}
      {currentTab === 'transactions' && (
        <div className="space-y-6">
          {activeSession && <TransactionExecution />}
          <TransactionHistory />
        </div>
      )}
      {currentTab === 'audit' && <AuditLedger />}
      {currentTab === 'diagnostics' && <SystemDiagnostics />}
    </AppShell>
  );
};

export function App() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
}

export default App;
