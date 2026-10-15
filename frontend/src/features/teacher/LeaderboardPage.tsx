import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Award,
  RefreshCw,
  AlertCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  fetchLeaderboardApi,
  fetchPointTransactionsApi,
  submitPointCorrectionApi,
  fetchClassesApi,
} from '../../services/api';
import type {
  LeaderboardItem,
  PointTransactionItem,
} from '../../types/teacher';
import type { ClassItem } from '../../types/models';
import { Dialog } from '../../components/Dialog';

export const LeaderboardPage: React.FC = () => {
  const { token } = useAuth();

  // State
  const [currentMonth, setCurrentMonth] = useState<string>('2026-10');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Correction Modal state
  const [selectedStudentForTransactions, setSelectedStudentForTransactions] = useState<LeaderboardItem | null>(null);
  const [transactions, setTransactions] = useState<PointTransactionItem[]>([]);
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Correction Form
  const [showCorrectionForm, setShowCorrectionForm] = useState<boolean>(false);
  const [deltaPoints, setDeltaPoints] = useState<number>(0);
  const [correctionReason, setCorrectionReason] = useState<string>('kiosk_hardware_issue');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [submittingCorrection, setSubmittingCorrection] = useState<boolean>(false);
  const [correctionFeedback, setCorrectionFeedback] = useState<string | null>(null);

  // Available months
  const availableMonths = [
    { value: '2026-10', label: 'October 2026 (Current)' },
    { value: '2026-09', label: 'September 2026' },
    { value: '2026-08', label: 'August 2026' },
  ];

  // Load classes
  useEffect(() => {
    if (!token) return;
    fetchClassesApi(token).then((res) => {
      if (res.data) setClasses(res.data);
    });
  }, [token]);

  // Load Leaderboard
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    fetchLeaderboardApi(token, currentMonth, selectedClassId || undefined, page, 50)
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setLeaderboard(res.data.items);
          setTimezone(res.data.timezone || 'UTC');
          setTotal(res.data.total);
          setTotalPages(res.data.total_pages || 1);
        } else if (res.error) {
          setError(res.error.message || 'Failed to load leaderboard.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Network error loading leaderboard.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, currentMonth, selectedClassId, page]);

  const refreshLeaderboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchLeaderboardApi(token, currentMonth, selectedClassId || undefined, page, 50);
      if (res.data) {
        setLeaderboard(res.data.items);
        setTimezone(res.data.timezone || 'UTC');
        setTotal(res.data.total);
        setTotalPages(res.data.total_pages || 1);
      } else if (res.error) {
        setError(res.error.message || 'Failed to load leaderboard.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [token, currentMonth, selectedClassId, page]);

  const handleManualRefresh = () => {
    refreshLeaderboard();
  };

  // Load student transactions when modal opens
  const loadStudentTransactions = async (studentId: string) => {
    if (!token) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await fetchPointTransactionsApi(token, {
        student_id: studentId,
        month: currentMonth,
        page: 1,
        limit: 50,
      });
      if (res.data) {
        setTransactions(res.data.items);
      } else if (res.error) {
        setTxError(res.error.message || 'Could not load point transactions.');
      }
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Network error loading transactions.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleOpenStudentTransactions = (student: LeaderboardItem) => {
    setSelectedStudentForTransactions(student);
    setShowCorrectionForm(false);
    setCorrectionFeedback(null);
    setDeltaPoints(0);
    setCorrectionNotes('');
    loadStudentTransactions(student.student_id);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStudentForTransactions || deltaPoints === 0) return;

    setSubmittingCorrection(true);
    setCorrectionFeedback(null);
    try {
      const res = await submitPointCorrectionApi(token, {
        student_id: selectedStudentForTransactions.student_id,
        points_delta: deltaPoints,
        reason: correctionReason,
        notes: correctionNotes || undefined,
      });

      if (res.data) {
        setCorrectionFeedback(`Successfully adjusted points by ${deltaPoints > 0 ? `+${deltaPoints}` : deltaPoints}. New monthly total: ${res.data.new_monthly_total}`);
        setShowCorrectionForm(false);
        setDeltaPoints(0);
        setCorrectionNotes('');
        loadStudentTransactions(selectedStudentForTransactions.student_id);
        refreshLeaderboard();
      } else if (res.error) {
        setCorrectionFeedback(`Error: ${res.error.message}`);
      }
    } catch (err) {
      setCorrectionFeedback(err instanceof Error ? err.message : 'Correction failed.');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const topThree = leaderboard.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Controls Header */}
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
              Monthly Bubsy Champion Leaderboard
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
              Recognizing consistent, correct technique. Monthly points computed in school timezone ({timezone}).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                setPage(1);
                handleManualRefresh();
              }}
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

        {/* Month and View Switcher */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label htmlFor="select-month" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Month
            </label>
            <select
              id="select-month"
              value={currentMonth}
              onChange={(e) => {
                setCurrentMonth(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-class-scope" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Scope
            </label>
            <select
              id="select-class-scope"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
              }}
            >
              <option value="">Whole School View</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  Class: {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rules & Points Explanation Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            fontSize: '12px',
            color: '#166534',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
            <Award size={16} /> How Points Are Awarded
          </div>
          Students earn <strong>10 Bubsy Points</strong> for each completed qualifying wash session validated by the AI sequence engine.
          Daily caps (max 2 rewardable washes/day) and anti-spam duplicate guards prevent artificial score inflation.
        </div>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            fontSize: '12px',
            color: '#1e40af',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
            <ShieldCheck size={16} /> Fair Play & Tie-Break Hierarchy
          </div>
          Ties are broken systematically per school protocol: <em>Highest points</em> → <em>More qualifying washes</em> → <em>Higher average technique score</em> → <em>Earliest qualifying wash</em>.
        </div>
      </div>

      {/* Main Leaderboard Section */}
      {loading ? (
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
          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>Calculating monthly scores...</span>
        </div>
      ) : error ? (
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
      ) : leaderboard.length === 0 ? (
        <div
          style={{
            padding: '80px 20px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
            textAlign: 'center',
          }}
        >
          <Trophy size={48} style={{ color: 'var(--color-muted-text)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-dark-text)', marginBottom: '4px' }}>
            No Leaderboard Records for {currentMonth}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', margin: 0 }}>
            No students have earned points in this reporting period yet.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium (when on page 1) */}
          {page === 1 && topThree.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {topThree.map((item, index) => {
                const medals = [
                  { label: 'Gold Champion', color: '#eab308', bg: '#fefce8', border: '#fef08a' },
                  { label: 'Silver', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
                  { label: 'Bronze', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
                ];
                const medal = medals[index] || medals[1];

                return (
                  <div
                    key={item.student_id}
                    style={{
                      backgroundColor: medal.bg,
                      border: `2px solid ${medal.border}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '24px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: medal.color,
                        textTransform: 'uppercase',
                      }}
                    >
                      {medal.label}
                    </div>

                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: medal.color,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '20px',
                        marginBottom: '12px',
                        marginTop: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                    >
                      {item.rank}
                    </div>

                    <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px', color: 'var(--color-dark-text)' }}>
                      {item.display_name}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--color-muted-text)', marginBottom: '12px' }}>
                      {item.class_name} {item.student_code ? `· ID: ${item.student_code}` : ''}
                    </span>

                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-primary)', marginBottom: '4px' }}>
                      {item.total_points} pts
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', marginBottom: '16px' }}>
                      {item.qualifying_washes} qualifying washes · Avg Score {Math.round(item.avg_technique_score)}%
                    </span>

                    <button
                      onClick={() => handleOpenStudentTransactions(item)}
                      aria-label={`Review point transactions for ${item.display_name}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-dark-text)',
                        cursor: 'pointer',
                      }}
                    >
                      Audit / Adjust Points
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Ranked Table */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
                Standings Table
              </h3>
            </div>

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
                    <th style={{ padding: '12px 16px', width: '60px' }}>Rank</th>
                    <th style={{ padding: '12px 16px' }}>Student</th>
                    <th style={{ padding: '12px 16px' }}>Class</th>
                    <th style={{ padding: '12px 16px' }}>Qualifying Washes</th>
                    <th style={{ padding: '12px 16px' }}>Avg Technique</th>
                    <th style={{ padding: '12px 16px' }}>Total Points</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.student_id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        backgroundColor: row.rank <= 3 ? 'rgba(254, 252, 232, 0.4)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-dark-text)' }}>
                        #{row.rank}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>{row.display_name}</span>
                        {row.student_code && (
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-muted-text)' }}>
                            ID: {row.student_code}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-muted-text)' }}>
                        {row.class_name}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {row.qualifying_washes}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-muted-text)' }}>
                        {Math.round(row.avg_technique_score)}%
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '14px' }}>
                          {row.total_points} pts
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenStudentTransactions(row)}
                          aria-label={`Audit points for ${row.display_name}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--color-dark-text)',
                          }}
                        >
                          <FileText size={13} />
                          <span>Audit & Adjust</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-canvas)',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--color-muted-text)',
                }}
              >
                <span>
                  Page {page} of {totalPages} ({total} ranked students)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      opacity: page <= 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      opacity: page >= totalPages ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Point Transaction Review & Compensating Correction Dialog */}
      {selectedStudentForTransactions && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedStudentForTransactions(null)}
          title={`Point Transactions: ${selectedStudentForTransactions.display_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-canvas)',
              }}
            >
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
                  {selectedStudentForTransactions.display_name} ({selectedStudentForTransactions.class_name})
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-muted-text)' }}>
                  Current Month Total: <strong>{selectedStudentForTransactions.total_points} Bubsy Points</strong>
                </span>
              </div>

              {!showCorrectionForm && (
                <button
                  onClick={() => setShowCorrectionForm(true)}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Create Compensating Correction
                </button>
              )}
            </div>

            {correctionFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: correctionFeedback.startsWith('Error') ? 'var(--color-error-bg)' : '#f0fdf4',
                  color: correctionFeedback.startsWith('Error') ? 'var(--color-error)' : 'var(--color-success)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {correctionFeedback}
              </div>
            )}

            {/* Correction Form */}
            {showCorrectionForm && (
              <form
                onSubmit={handleSubmitCorrection}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-primary)',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
                  Audited Point Adjustment
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-muted-text)', margin: 0 }}>
                  In accordance with database integrity rules, historical transactions are immutable. This action records
                  a compensating transaction with an audit log.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="point-delta-input" style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                      Point Delta (Positive or Negative)
                    </label>
                    <input
                      id="point-delta-input"
                      type="number"
                      step="1"
                      required
                      placeholder="e.g. 10 or -10"
                      value={deltaPoints || ''}
                      onChange={(e) => setDeltaPoints(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="point-reason-input" style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                      Reason Code
                    </label>
                    <select
                      id="point-reason-input"
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="kiosk_hardware_issue">Kiosk Hardware Issue</option>
                      <option value="camera_recognition_failure">Camera Recognition Glitch</option>
                      <option value="duplicate_correction">Duplicate Transaction Reversal</option>
                      <option value="teacher_verified_wash">Teacher Verified Handwashing</option>
                      <option value="other_administrative">Other Administrative Reason</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="point-notes-input" style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                    Audit Notes / Justification
                  </label>
                  <input
                    id="point-notes-input"
                    type="text"
                    placeholder="Brief explanation for this audit correction..."
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCorrectionForm(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'transparent',
                      fontSize: '12px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCorrection || deltaPoints === 0}
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      padding: '6px 16px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      opacity: submittingCorrection || deltaPoints === 0 ? 0.6 : 1,
                    }}
                  >
                    {submittingCorrection ? 'Applying...' : 'Apply Correction'}
                  </button>
                </div>
              </form>
            )}

            {/* Transaction Ledger Table */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px', color: 'var(--color-dark-text)' }}>
                Immutable Point Transaction Ledger
              </h4>
              {txLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted-text)', fontSize: '12px' }}>
                  Loading transactions...
                </div>
              ) : txError ? (
                <div style={{ color: 'var(--color-error)', fontSize: '12px' }}>{txError}</div>
              ) : transactions.length === 0 ? (
                <div style={{ color: 'var(--color-muted-text)', fontSize: '12px' }}>
                  No point transactions found for this student in {currentMonth}.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: 'var(--color-canvas)',
                          borderBottom: '1px solid var(--color-border)',
                          color: 'var(--color-muted-text)',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px' }}>Delta</th>
                        <th style={{ padding: '8px' }}>Reason</th>
                        <th style={{ padding: '8px' }}>Notes / Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.transaction_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px', color: 'var(--color-muted-text)' }}>
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px', fontWeight: 700, color: tx.points_delta > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {tx.points_delta > 0 ? `+${tx.points_delta}` : tx.points_delta}
                          </td>
                          <td style={{ padding: '8px' }}>{tx.reason_code.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '8px', color: 'var(--color-muted-text)' }}>
                            {tx.notes || (tx.session_id ? `Session ID: ${tx.session_id.slice(0, 8)}...` : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
