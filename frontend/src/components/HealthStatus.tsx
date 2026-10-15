import React, { useEffect, useState, useCallback } from 'react';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchHealth, type HealthData, type ApiError } from '../services/api';

export const HealthStatus: React.FC = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const performHealthCheck = useCallback(async () => {
    setLoading(true);
    const result = await fetchHealth();
    if (result.error) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchHealth().then((result) => {
      if (!isMounted) return;
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '14px',
        boxShadow: 'var(--shadow-sm)',
      }}
      data-testid="health-status-widget"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {loading ? (
          <Activity
            size={18}
            style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }}
            data-testid="icon-loading"
          />
        ) : error ? (
          <AlertTriangle
            size={18}
            style={{ color: 'var(--color-amber)' }}
            data-testid="icon-error"
          />
        ) : (
          <CheckCircle2
            size={18}
            style={{ color: 'var(--color-success)' }}
            data-testid="icon-healthy"
          />
        )}

        <div>
          <span style={{ fontWeight: 600 }}>API Status: </span>
          {loading ? (
            <span style={{ color: 'var(--color-muted-text)' }}>Connecting to backend...</span>
          ) : error ? (
            <span style={{ color: 'var(--color-amber)', fontWeight: 500 }}>
              {error.code}: {error.message}
            </span>
          ) : (
            <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
              Healthy ({data?.app_name} v{data?.version} [{data?.environment}])
            </span>
          )}
        </div>
      </div>

      <button
        onClick={performHealthCheck}
        disabled={loading}
        title="Refresh health status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-soft-blue)',
          color: 'var(--color-primary)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <RefreshCw size={14} />
        Refresh
      </button>
    </div>
  );
};
