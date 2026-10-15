import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
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
import {
  fetchAnalyticsApi,
  downloadAnalyticsCsvApi,
  fetchClassesApi,
} from '../../services/api';
import type { AnalyticsData } from '../../types/teacher';
import type { ClassItem } from '../../types/models';

export const AnalyticsPage: React.FC = () => {
  const { token } = useAuth();

  // State
  const [period, setPeriod] = useState<string>('30d');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Accessible table toggles
  const [showTrendTable, setShowTrendTable] = useState<boolean>(false);
  const [showBucketTable, setShowBucketTable] = useState<boolean>(false);

  // CSV Export state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Load classes
  useEffect(() => {
    if (!token) return;
    fetchClassesApi(token).then((res) => {
      if (res.data) setClasses(res.data);
    });
  }, [token]);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchAnalyticsApi(token, period, selectedClassId || undefined);
      if (res.data) {
        setData(res.data);
      } else if (res.error) {
        setError(res.error.message || 'Failed to load analytics.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading analytics.');
    } finally {
      setLoading(false);
    }
  }, [token, period, selectedClassId]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;
    fetchAnalyticsApi(token, period, selectedClassId || undefined)
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setData(res.data);
        } else if (res.error) {
          setError(res.error.message || 'Failed to load analytics.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Network error loading analytics.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, period, selectedClassId]);

  const handleManualRefresh = () => {
    setLoading(true);
    loadAnalytics();
  };

  const handleExportCsv = async () => {
    if (!token) return;
    setIsExporting(true);
    setExportFeedback(null);
    try {
      const success = await downloadAnalyticsCsvApi(token, period, selectedClassId || undefined);
      if (success) {
        setExportFeedback('CSV report downloaded successfully (includes scientific disclaimer header).');
      } else {
        setExportFeedback('CSV download failed. Please check permissions.');
      }
    } catch {
      setExportFeedback('Export error occurred.');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportFeedback(null), 5000);
    }
  };

  const BUCKET_COLORS = ['#94a3b8', '#60a5fa', '#3b82f6', '#1d4ed8'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Filters */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--color-dark-text)' }}>
              Analytics & Compliance Reports
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
              Handwashing protocol adherence metrics, class comparisons, and gesture performance
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleExportCsv}
              disabled={isExporting || loading}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                opacity: isExporting ? 0.6 : 1,
              }}
            >
              <Download size={15} />
              <span>{isExporting ? 'Generating...' : 'Export CSV Report'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-canvas)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-dark-text)',
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label htmlFor="analytics-period" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Reporting Period
            </label>
            <select
              id="analytics-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="this_month">Current Calendar Month</option>
            </select>
          </div>

          <div>
            <label htmlFor="analytics-class" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Filter by Class
            </label>
            <select
              id="analytics-class"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
              }}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Export Feedback notification */}
      {exportFeedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: exportFeedback.includes('failed') ? 'var(--color-error-bg)' : '#f0fdf4',
            color: exportFeedback.includes('failed') ? 'var(--color-error)' : 'var(--color-success)',
            border: `1px solid ${exportFeedback.includes('failed') ? 'var(--color-error)' : '#bbf7d0'}`,
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {exportFeedback}
        </div>
      )}

      {/* Mandatory Scientific & Hygiene Disclaimer Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
        }}
      >
        <ShieldCheck size={22} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px', color: '#1e40af' }}>
            Scientific Protocol Notice
          </h4>
          <p style={{ fontSize: '12px', color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
            {data?.disclaimer ||
              'AI technique recognition reflects protocol adherence and does not prove microbiological cleanliness or germ elimination.'}
            {' '}This system assists educators by tracking procedural movement compliance according to the school handwashing curriculum.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <div
          style={{
            padding: '80px 20px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
          role="status"
        >
          <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>Generating analytics report...</span>
        </div>
      ) : error && !data ? (
        <div
          style={{
            padding: '40px 20px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-error)',
            textAlign: 'center',
          }}
          role="alert"
        >
          <AlertCircle size={32} style={{ color: 'var(--color-error)', margin: '0 auto 10px' }} />
          <p style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>{error}</p>
        </div>
      ) : (
        <>
          {/* Daily Activity Trend Chart */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                  Daily Session Volumes & Completion Rate
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
                  Total sessions vs qualifying sessions over {period}
                </p>
              </div>

              <button
                onClick={() => setShowTrendTable(!showTrendTable)}
                style={{
                  fontSize: '12px',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
                aria-label="Toggle accessible data table view for daily sessions"
              >
                {showTrendTable ? 'Show Chart' : 'Accessible Table'}
              </button>
            </div>

            {showTrendTable ? (
              <div style={{ overflowX: 'auto', maxHeight: '260px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Total Sessions</th>
                      <th style={{ padding: '8px' }}>Qualifying Sessions</th>
                      <th style={{ padding: '8px' }}>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.daily_trends || []).map((t) => (
                      <tr key={t.date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px' }}>{t.date}</td>
                        <td style={{ padding: '8px' }}>{t.total_sessions}</td>
                        <td style={{ padding: '8px' }}>{t.qualifying_sessions}</td>
                        <td style={{ padding: '8px' }}>{t.completion_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ height: '240px', width: '100%' }}>
                {data?.daily_trends && data.daily_trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily_trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted-text)' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-muted-text)' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Bar dataKey="total_sessions" name="Total Sessions" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="qualifying_sessions"
                        name="Qualifying Sessions"
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
                      fontSize: '13px',
                    }}
                  >
                    No sessions recorded in this period.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2-Column Section: Completion by Class & Participation Distribution */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Completion by Class (Normalised by Class Size) */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-dark-text)' }}>
                Protocol Completion by Class
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '0 0 16px' }}>
                Normalized by class size so larger classes do not dominate
              </p>

              {data?.completion_by_class && data.completion_by_class.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.completion_by_class.map((c) => (
                    <div
                      key={c.class_id}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-canvas)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-dark-text)' }}>
                          {c.class_name}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {c.completion_rate}% Completion
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          backgroundColor: 'var(--color-border)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '6px',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, c.completion_rate)}%`,
                            backgroundColor: 'var(--color-primary)',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-muted-text)' }}>
                        <span>{c.registered_students} students · {c.qualifying_washes} qualifying washes</span>
                        <span>{c.washes_per_student.toFixed(1)} washes / child</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>No class completion data.</p>
              )}
            </div>

            {/* Participation Distribution */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                    Student Participation Distribution
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
                    Breakdown of student handwashing engagement
                  </p>
                </div>
                <button
                  onClick={() => setShowBucketTable(!showBucketTable)}
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                  aria-label="Toggle accessible data table view for participation distribution"
                >
                  {showBucketTable ? 'Show Bars' : 'Table View'}
                </button>
              </div>

              {data?.participation_distribution && data.participation_distribution.length > 0 ? (
                showBucketTable ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '8px' }}>Wash Tier</th>
                        <th style={{ padding: '8px' }}>Students</th>
                        <th style={{ padding: '8px' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.participation_distribution.map((b) => (
                        <tr key={b.bucket_label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{b.bucket_label}</td>
                          <td style={{ padding: '8px' }}>{b.student_count}</td>
                          <td style={{ padding: '8px' }}>{b.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    {data.participation_distribution.map((b, idx) => (
                      <div key={b.bucket_label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>{b.bucket_label}</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-dark-text)' }}>
                            {b.student_count} students ({b.percentage}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '10px',
                            backgroundColor: 'var(--color-border)',
                            borderRadius: '5px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, b.percentage)}%`,
                              backgroundColor: BUCKET_COLORS[idx % BUCKET_COLORS.length],
                              borderRadius: '5px',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>No distribution data available.</p>
              )}
            </div>
          </div>

          {/* Commonly Missed or Uncertain Steps Analysis */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-dark-text)' }}>
                Protocol Movement Forensics: Commonly Missed or Uncertain Steps
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: 0 }}>
                Identifies movements where students encounter recognition retries or sequence hesitation.
                Useful for classroom demonstrations.
              </p>
            </div>

            {data?.commonly_missed_steps && data.commonly_missed_steps.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--color-canvas)',
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-muted-text)',
                        fontSize: '12px',
                      }}
                    >
                      <th style={{ padding: '10px 14px' }}>Protocol Step</th>
                      <th style={{ padding: '10px 14px' }}>Total Attempts</th>
                      <th style={{ padding: '10px 14px' }}>Recognized</th>
                      <th style={{ padding: '10px 14px' }}>Uncertain / Retries</th>
                      <th style={{ padding: '10px 14px' }}>Skipped</th>
                      <th style={{ padding: '10px 14px' }}>Uncertainty Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commonly_missed_steps.map((st) => (
                      <tr key={st.step_code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-dark-text)' }}>
                          {st.step_name}
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-muted-text)' }}>
                            Code: {st.step_code}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{st.total_attempts}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--color-success)', fontWeight: 600 }}>
                          {st.recognized_count}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--color-amber)', fontWeight: 600 }}>
                          {st.uncertain_count + st.retry_count}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--color-muted-text)' }}>
                          {st.skipped_count}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: st.uncertainty_rate > 30 ? '#fee2e2' : '#f1f5f9',
                              color: st.uncertainty_rate > 30 ? 'var(--color-error)' : 'var(--color-muted-text)',
                            }}
                          >
                            {st.uncertainty_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>No step forensic records found.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
