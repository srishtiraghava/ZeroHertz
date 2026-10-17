import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  NavigationTab,
  ConnectionState,
  MicrophoneState,
  AcousticEngineState,
  SystemMetrics,
  SessionData,
  WebSocketEvent,
  DTMFDetection,
} from '../types';

interface AppState {
  currentTab: NavigationTab;
  sidebarCollapsed: boolean;
  wsState: ConnectionState;
  micState: MicrophoneState;
  acousticEngineState: AcousticEngineState;
  metrics: SystemMetrics;
  activeSession: SessionData | null;
  recentEvents: WebSocketEvent[];
  recentDetections: DTMFDetection[];
  narratorEnabled: boolean;
  narratorLang: 'hi-IN' | 'en-IN';
}

type Action =
  | { type: 'SET_TAB'; payload: NavigationTab }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_WS_STATE'; payload: ConnectionState }
  | { type: 'SET_MIC_STATE'; payload: MicrophoneState }
  | { type: 'SET_ACOUSTIC_ENGINE_STATE'; payload: AcousticEngineState }
  | { type: 'UPDATE_METRICS'; payload: Partial<SystemMetrics> }
  | { type: 'SET_ACTIVE_SESSION'; payload: SessionData | null }
  | { type: 'UPDATE_SESSION'; payload: Partial<SessionData> }
  | { type: 'ADD_WS_EVENT'; payload: WebSocketEvent }
  | { type: 'ADD_DTMF_DETECTION'; payload: DTMFDetection }
  | { type: 'SET_NARRATOR_ENABLED'; payload: boolean }
  | { type: 'SET_NARRATOR_LANG'; payload: 'hi-IN' | 'en-IN' }
  | { type: 'RESET_SESSION' };

const initialMetrics: SystemMetrics = {
  acoustic_engine_state: 'idle',
  mic_connection_state: 'inactive',
  backend_state: 'connecting',
  pending_confirmation_count: 0,
  total_sessions: 0,
  completed_transactions: 0,
  failed_rejected_transactions: 0,
};

const initialState: AppState = {
  currentTab: 'overview',
  sidebarCollapsed: false,
  wsState: 'connecting',
  micState: 'inactive',
  acousticEngineState: 'idle',
  metrics: initialMetrics,
  activeSession: null,
  recentEvents: [],
  recentDetections: [],
  narratorEnabled: true,
  narratorLang: 'en-IN',
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, currentTab: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'SET_WS_STATE':
      return {
        ...state,
        wsState: action.payload,
        metrics: { ...state.metrics, backend_state: action.payload },
      };

    case 'SET_MIC_STATE':
      return {
        ...state,
        micState: action.payload,
        metrics: { ...state.metrics, mic_connection_state: action.payload },
      };

    case 'SET_ACOUSTIC_ENGINE_STATE':
      return {
        ...state,
        acousticEngineState: action.payload,
        metrics: { ...state.metrics, acoustic_engine_state: action.payload },
      };

    case 'UPDATE_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, ...action.payload },
      };

    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSession: action.payload };

    case 'UPDATE_SESSION': {
      if (!state.activeSession) return state;
      const updated = { ...state.activeSession, ...action.payload };
      return { ...state, activeSession: updated };
    }

    case 'ADD_WS_EVENT': {
      const updatedEvents = [action.payload, ...state.recentEvents].slice(0, 100);
      return { ...state, recentEvents: updatedEvents };
    }

    case 'ADD_DTMF_DETECTION': {
      const updated = [action.payload, ...state.recentDetections].slice(0, 30);
      return { ...state, recentDetections: updated };
    }

    case 'SET_NARRATOR_ENABLED':
      return { ...state, narratorEnabled: action.payload };

    case 'SET_NARRATOR_LANG':
      return { ...state, narratorLang: action.payload };

    case 'RESET_SESSION':
      return { ...state, activeSession: null };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
