import React, { useEffect } from 'react';
import { MetricsRow } from './MetricsRow';
import { LiveSession } from './LiveSession';
import { EventTimeline } from './EventTimeline';
import { LiveEvents } from './LiveEvents';
import { useApi } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';

export const CommandCenter: React.FC = () => {
  const { dispatch } = useApp();
  const { getMetrics } = useApi();

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const data = await getMetrics();
        if (isMounted && data) {
          dispatch({ type: 'UPDATE_METRICS', payload: data });
        }
      } catch (e) {
        // Handled silently or by connection status
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [getMetrics, dispatch]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <MetricsRow />

      {/* Active Live Session Panel */}
      <LiveSession />

      {/* Lower Dual Grid: Event Timeline & WebSocket Live Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventTimeline />
        <LiveEvents />
      </div>
    </div>
  );
};
