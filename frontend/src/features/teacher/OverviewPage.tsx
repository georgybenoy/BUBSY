import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Camera,
  Cpu,
  Database,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../../context/useAuth';
import { fetchOverviewApi } from '../../services/api';
import type { OverviewData } from '../../types/teacher';
import { ProgressRing } from '../../components/ProgressRing';
import { StatusBadge } from '../../components/StatusBadge';

interface OverviewPageProps {
  period?: string;
  onNavigateTab: (tabId: string) => void;
  onSelectSession?: (sessionId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  period = '30d',
  onNavigateTab,
  onSelectSession,
}) => {
  const { token } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showChartTable, setShowChartTable] = useState<boolean>(false);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOverviewApi(token, period);
      if (res.data) {
        setData(res.data);
      } else if (res.error) {
        setError(res.error.message || 'Failed to load overview data.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading overview');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;
    fetchOverviewApi(token, period)
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setData(res.data);
        } else if (res.error) {
          setError(res.error.message || 'Failed to load overview data.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Network error loading overview');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, period]);

  if (loading && !data) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: '12px',
        }}
        role="status"
        aria-live="polite"
      >
        <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--color-muted-text)', fontSize: '14px' }}>Loading school overview...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-error)',
          textAlign: 'center',
        }}
        role="alert"
      >
        <AlertCircle size={32} style={{ color: 'var(--color-error)', margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Failed to load overview</h3>
        <p style={{ color: 'var(--color-muted-text)', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
        <button
          onClick={loadOverview}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const metrics = data?.metrics;
  const isDbEmpty =
    metrics &&
    metrics.registered_students === 0 &&
    metrics.qualifying_washes === 0 &&
    metrics.protocol_completion.denominator === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 4 KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '22px',
        }}
      >
        {/* Card 1: Registered Students */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Registered Students
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-soft-blue)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800, color: 'var(--color-dark-text)', lineHeight: 1.1, marginBottom: '6px' }}>
            {metrics?.registered_students.toLocaleString() ?? 0}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>Across all active classes</span>
        </div>

        {/* Card 2: Qualifying Washes */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Qualifying Washes
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#dcfce7',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} />
            </div>
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800, color: 'var(--color-dark-text)', lineHeight: 1.1, marginBottom: '6px' }}>
            {metrics?.qualifying_washes.toLocaleString() ?? 0}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
            Selected reporting period ({period})
          </span>
        </div>

        {/* Card 3: Protocol Completion */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Protocol Completion
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#ede9fe',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800, color: 'var(--color-dark-text)', lineHeight: 1.1, marginBottom: '6px' }}>
            {metrics ? `${metrics.protocol_completion.percentage}%` : '0%'}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
            {metrics
              ? `${metrics.protocol_completion.numerator} of ${metrics.protocol_completion.denominator} sessions qualified`
              : 'No sessions recorded'}
          </span>
        </div>

        {/* Card 4: Active Participants */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Active Participants
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#fef3c7',
                color: 'var(--color-amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800, color: 'var(--color-dark-text)', lineHeight: 1.1, marginBottom: '6px' }}>
            {metrics?.active_participants.toLocaleString() ?? 0}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
            Students with ≥1 qualifying wash
          </span>
        </div>
      </div>

      {/* Empty State Banner if no data at all */}
      {isDbEmpty && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
            padding: '36px 24px',
            textAlign: 'center',
          }}
        >
          <Users size={40} style={{ color: 'var(--color-muted-text)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-dark-text)', marginBottom: '6px' }}>
            Welcome to Bubsy!
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-muted-text)',
              maxWidth: '500px',
              margin: '0 auto 20px',
            }}
          >
            No student handwashing activity has been recorded yet. Set up classes, register students, and have them
            scan their QR code at the Kiosk to begin earning Bubsy Points!
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => onNavigateTab('classes')}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Manage Classes
            </button>
            <button
              onClick={() => onNavigateTab('students')}
              style={{
                backgroundColor: 'var(--color-canvas)',
                color: 'var(--color-dark-text)',
                border: '1px solid var(--color-border)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Add Students
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column (Wider): Activity Trend, Class Comparison, Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Handwashing Activity Trend */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                  Handwashing Activity Trend
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
                  Daily recorded sessions vs. qualifying washes ({period})
                </p>
              </div>
              <button
                onClick={() => setShowChartTable(!showChartTable)}
                style={{
                  fontSize: '13px',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
                aria-label="Toggle accessible data table view for activity trend chart"
              >
                {showChartTable ? 'Show Chart' : 'Accessible Table'}
              </button>
            </div>

            {showChartTable ? (
              <div style={{ overflowX: 'auto', maxHeight: '260px' }}>
                <table style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Total Sessions</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Qualifying Washes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.activity_trend || []).map((pt) => (
                      <tr key={pt.date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 12px' }}>{pt.date}</td>
                        <td style={{ padding: '10px 12px' }}>{pt.total_sessions}</td>
                        <td style={{ padding: '10px 12px' }}>{pt.qualifying_washes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ height: '240px', width: '100%' }}>
                {data?.activity_trend && data.activity_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.activity_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-muted-text)' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-muted-text)' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          fontSize: '13px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                      <Bar dataKey="total_sessions" name="Total Sessions" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="qualifying_washes"
                        name="Qualifying Washes"
                        fill="var(--color-primary)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-muted-text)',
                      fontSize: '14px',
                    }}
                  >
                    No activity data available in this period.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Class Comparison (Normalized by class size) */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                  Class Comparison
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
                  Normalized by class size to ensure fair comparison
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('classes')}
                style={{
                  fontSize: '13px',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>All Classes</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {data?.class_comparison && data.class_comparison.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.class_comparison.slice(0, 5).map((cls) => (
                  <div
                    key={cls.class_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-canvas)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
                        {cls.class_name}
                      </span>
                      <div style={{ fontSize: '13px', color: 'var(--color-muted-text)', marginTop: '3px' }}>
                        {cls.student_count} students · {cls.qualifying_washes} qualifying washes
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          {cls.completion_rate}%
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>Completion</div>
                      </div>
                      <div style={{ minWidth: '80px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-dark-text)' }}>
                          {cls.washes_per_student.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>Washes / child</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: 0 }}>
                No class comparison data available.
              </p>
            )}
          </div>

          {/* Recent Activity */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                  Recent Activity
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
                  Latest recorded handwashing sessions
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('sessions')}
                style={{
                  fontSize: '13px',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>View All Sessions</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {data?.recent_activity && data.recent_activity.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.recent_activity.slice(0, 6).map((item) => (
                  <div
                    key={item.session_id}
                    onClick={() => onSelectSession?.(item.session_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-canvas)',
                      border: '1px solid var(--color-border)',
                      cursor: onSelectSession ? 'pointer' : 'default',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
                          {item.student_name || 'Unassigned Student'}
                        </span>
                        {item.class_name && (
                          <span
                            style={{
                              fontSize: '12px',
                              backgroundColor: 'var(--color-soft-blue)',
                              color: 'var(--color-primary)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            {item.class_name}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--color-muted-text)', marginTop: '3px', display: 'block' }}>
                        {new Date(item.started_at).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <StatusBadge
                        status={item.qualifies_for_points ? 'success' : 'neutral'}
                        label={item.outcome.replace('_', ' ')}
                      />
                      {item.points_awarded > 0 && (
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          +{item.points_awarded} pts
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: 0 }}>
                No recent wash sessions found.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (Narrower): Leaderboard Summary, Completion Ring, Kiosk Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Protocol Completion Ring */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '26px',
              boxShadow: 'var(--shadow-sm)',
              textAlign: 'center',
            }}
          >
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--color-dark-text)',
                marginBottom: '4px',
              }}
            >
              Protocol Adherence
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', marginBottom: '20px' }}>
              Completion across all sessions
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
              <ProgressRing
                value={metrics?.protocol_completion.percentage || 0}
                size={150}
                strokeWidth={14}
                color="var(--color-primary)"
              />
            </div>

            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-muted-text)',
                backgroundColor: 'var(--color-canvas)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                lineHeight: 1.5,
              }}
            >
              <ShieldCheck
                size={16}
                style={{ verticalAlign: 'text-bottom', marginRight: '6px', color: 'var(--color-primary)' }}
              />
              Reflects technique compliance; does not certify microbiological cleanliness.
            </div>
          </div>

          {/* Bubsy Champion Leaderboard Summary */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                  Bubsy Champions
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>Monthly Leaders</span>
              </div>
              <button
                onClick={() => onNavigateTab('leaderboard')}
                style={{
                  fontSize: '13px',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Full Board</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {data?.leaderboard_summary && data.leaderboard_summary.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.leaderboard_summary.map((lead) => {
                  const medalColors = ['#eab308', '#94a3b8', '#b45309'];
                  return (
                    <div
                      key={lead.student_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: lead.rank === 1 ? '#fefce8' : 'var(--color-canvas)',
                        border: lead.rank === 1 ? '1px solid #fef08a' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: medalColors[lead.rank - 1] || 'var(--color-border)',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {lead.rank}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
                            {lead.display_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>
                            {lead.qualifying_washes} washes
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {lead.total_points} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: 0 }}>
                No points earned yet this month.
              </p>
            )}
          </div>

          {/* Kiosk & Device Status Card */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                Kiosk & AI Status
              </h3>
              <button
                onClick={() => onNavigateTab('status')}
                style={{
                  fontSize: '13px',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Details</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-muted-text)' }}>
                  <Camera size={16} /> Camera
                </span>
                <StatusBadge
                  status={data?.device_status.camera_connected ? 'success' : 'error'}
                  label={data?.device_status.camera_connected ? 'Connected' : 'Disconnected'}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-muted-text)' }}>
                  <Cpu size={16} /> AI Recognition
                </span>
                <StatusBadge
                  status={data?.device_status.recognition_service_running ? 'success' : 'warning'}
                  label={data?.device_status.recognition_service_running ? 'Ready' : 'Standby'}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-muted-text)' }}>
                  <Database size={16} /> Local Database
                </span>
                <StatusBadge
                  status={data?.device_status.database_status === 'healthy' ? 'success' : 'error'}
                  label={data?.device_status.database_status || 'healthy'}
                />
              </div>

              <div
                style={{
                  paddingTop: '10px',
                  borderTop: '1px solid var(--color-border)',
                  color: 'var(--color-muted-text)',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Model: {data?.device_status.model_version || 'v1.0'}</span>
                <span>Timezone: {data?.device_status.timezone || 'UTC'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
