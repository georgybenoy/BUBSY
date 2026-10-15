import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  HelpCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  fetchSessionsApi,
  fetchSessionDetailApi,
  fetchClassesApi,
} from '../../services/api';
import type {
  SessionListItem,
  SessionDetailData,
} from '../../types/teacher';
import type { ClassItem } from '../../types/models';
import { StatusBadge } from '../../components/StatusBadge';
import { Dialog } from '../../components/Dialog';

interface WashSessionsPageProps {
  initialSessionId?: string | null;
}

export const WashSessionsPage: React.FC<WashSessionsPageProps> = ({ initialSessionId }) => {
  const { token } = useAuth();

  // Data state
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Selected session for detail view
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(Boolean(initialSessionId));
  const [detailError, setDetailError] = useState<string | null>(null);

  // Load classes for filter dropdown
  useEffect(() => {
    if (!token) return;
    fetchClassesApi(token).then((res) => {
      if (res.data) setClasses(res.data);
    });
  }, [token]);

  // Debounce student search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(studentSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  // Fetch sessions list
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    fetchSessionsApi(token, {
      page,
      limit: 15,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      class_id: selectedClassId || undefined,
      student_id: debouncedSearch || undefined,
      outcome: selectedOutcome || undefined,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setSessions(res.data.items);
          setTotal(res.data.total);
          setTotalPages(res.data.total_pages || 1);
        } else if (res.error) {
          setError(res.error.message || 'Failed to fetch sessions.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Network error loading sessions.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, page, startDate, endDate, selectedClassId, selectedOutcome, debouncedSearch]);

  const handleManualRefresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchSessionsApi(token, {
        page,
        limit: 15,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        class_id: selectedClassId || undefined,
        student_id: debouncedSearch || undefined,
        outcome: selectedOutcome || undefined,
      });

      if (res.data) {
        setSessions(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.total_pages || 1);
      } else if (res.error) {
        setError(res.error.message || 'Failed to fetch sessions.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading sessions.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch session detail when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId || !token) return;
    let ignore = false;
    fetchSessionDetailApi(token, activeSessionId)
      .then((res) => {
        if (!ignore) {
          if (res.data) {
            setSessionDetail(res.data);
          } else if (res.error) {
            setDetailError(res.error.message || 'Could not load session details.');
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setDetailError(err instanceof Error ? err.message : 'Network error loading detail.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setDetailLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeSessionId, token]);

  const handleOpenDetail = (sessionId: string) => {
    setSessionDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setActiveSessionId(sessionId);
  };

  const handleCloseDetail = () => {
    setActiveSessionId(null);
    setSessionDetail(null);
  };

  const renderOutcomeBadge = (outcomeCategory: string) => {
    switch (outcomeCategory) {
      case 'completed-qualifying':
        return <StatusBadge status="success" label="Completed (Qualifying)" />;
      case 'incomplete':
        return <StatusBadge status="warning" label="Incomplete" />;
      case 'recognition_uncertain':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              fontSize: '11px',
              fontWeight: 600,
              border: '1px solid #cbd5e1',
            }}
          >
            <HelpCircle size={12} style={{ color: '#64748b' }} />
            Recognition Uncertain
          </span>
        );
      case 'device_failure':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={12} />
            Device / Camera Failure
          </span>
        );
      case 'cancelled':
        return <StatusBadge status="neutral" label="Cancelled" />;
      default:
        return <StatusBadge status="neutral" label={outcomeCategory} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              Wash Sessions
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
              Searchable forensic record of student handwashing sessions and AI protocol recognition
            </p>
          </div>

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

        {/* Filter Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Outcome Category Filter */}
          <div>
            <label htmlFor="filter-outcome" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Outcome
            </label>
            <select
              id="filter-outcome"
              value={selectedOutcome}
              onChange={(e) => {
                setSelectedOutcome(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
              }}
            >
              <option value="">All Outcomes</option>
              <option value="completed-qualifying">Completed (Qualifying)</option>
              <option value="incomplete">Incomplete</option>
              <option value="recognition_uncertain">Recognition Uncertain</option>
              <option value="cancelled">Cancelled</option>
              <option value="device_failure">Device / Camera Failure</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label htmlFor="filter-class" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Class
            </label>
            <select
              id="filter-class"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
              }}
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.class_id} value={cls.class_id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="filter-start-date" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Start Date
            </label>
            <input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="filter-end-date" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              End Date
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Student Filter */}
          <div>
            <label htmlFor="filter-student-search" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', marginBottom: '4px' }}>
              Search Student
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="filter-student-search"
                type="text"
                placeholder="Name or school ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: '13px',
                }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-muted-text)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Uncertainty Notice Reminder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          fontSize: '12px',
          color: '#1e40af',
        }}
      >
        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
        <span>
          <strong>Ethical Recognition Notice:</strong> Uncertain AI recognition indicates inconclusive camera or
          motion evidence; it must never be presented as a child hygiene violation or student fault.
        </span>
      </div>

      {/* Sessions Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '60px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
            role="status"
          >
            <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>Loading wash sessions...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }} role="alert">
            <XCircle size={32} style={{ color: 'var(--color-error)', margin: '0 auto 10px' }} />
            <p style={{ color: 'var(--color-dark-text)', fontWeight: 600, fontSize: '14px' }}>Error loading sessions</p>
            <p style={{ color: 'var(--color-muted-text)', fontSize: '13px' }}>{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Sparkles size={36} style={{ color: 'var(--color-muted-text)', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-dark-text)', marginBottom: '4px' }}>
              No Sessions Found
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', margin: 0 }}>
              No handwashing sessions matched your selected filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-canvas)',
                    borderBottom: '1px solid var(--color-border)',
                    color: 'var(--color-muted-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Student</th>
                  <th style={{ padding: '12px 16px' }}>Class</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Duration</th>
                  <th style={{ padding: '12px 16px' }}>Outcome</th>
                  <th style={{ padding: '12px 16px' }}>Steps Recognized</th>
                  <th style={{ padding: '12px 16px' }}>Points</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.session_id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>
                        {s.student_name || 'Unassigned Student'}
                      </div>
                      {s.student_code && (
                        <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                          ID: {s.student_code}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--color-muted-text)' }}>
                      {s.class_name || '—'}
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--color-dark-text)' }}>
                      {new Date(s.started_at).toLocaleDateString()}
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-muted-text)' }}>
                        {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--color-muted-text)' }}>
                      {s.duration_seconds !== null ? `${s.duration_seconds}s` : '—'}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {renderOutcomeBadge(s.outcome_category)}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>
                        {s.recognized_steps_count}
                      </span>
                      <span style={{ color: 'var(--color-muted-text)', fontSize: '11px' }}>
                        {' '}/ {s.total_steps_count}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {s.points_awarded > 0 ? (
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                          +{s.points_awarded} pts
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted-text)' }}>0</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenDetail(s.session_id)}
                        aria-label={`Inspect session details for ${s.student_name || 'unassigned student'}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-canvas)',
                          border: '1px solid var(--color-border)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-primary)',
                        }}
                      >
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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
            Showing <strong>{sessions.length}</strong> of <strong>{total}</strong> sessions (Page {page} of {totalPages})
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                opacity: page <= 1 ? 0.5 : 1,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                opacity: page >= totalPages ? 0.5 : 1,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Session Detail Modal / Dialog */}
      {activeSessionId && (
        <Dialog
          isOpen={true}
          onClose={handleCloseDetail}
          title="Session Detail Inspection"
        >
          {detailLoading ? (
            <div
              style={{
                padding: '40px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
              role="status"
            >
              <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
                Loading session forensics...
              </span>
            </div>
          ) : detailError ? (
            <div style={{ padding: '24px', textAlign: 'center' }} role="alert">
              <AlertTriangle size={32} style={{ color: 'var(--color-error)', margin: '0 auto 10px' }} />
              <p style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>Failed to load session details</p>
              <p style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>{detailError}</p>
            </div>
          ) : sessionDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Header Details */}
              <div
                style={{
                  backgroundColor: 'var(--color-canvas)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-muted-text)', display: 'block' }}>Student</span>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-dark-text)' }}>
                    {sessionDetail.student_name || 'Unassigned Student'}
                  </span>
                  {sessionDetail.class_name && (
                    <span style={{ color: 'var(--color-muted-text)', display: 'block' }}>
                      Class: {sessionDetail.class_name}
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ color: 'var(--color-muted-text)', display: 'block' }}>Outcome</span>
                  <div style={{ marginTop: '4px' }}>
                    {renderOutcomeBadge(sessionDetail.outcome_category)}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--color-muted-text)', display: 'block' }}>Points Awarded</span>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--color-primary)' }}>
                    +{sessionDetail.points_awarded} Bubsy Points
                  </span>
                </div>

                <div>
                  <span style={{ color: 'var(--color-muted-text)', display: 'block' }}>AI Models & Engines</span>
                  <span style={{ color: 'var(--color-dark-text)', display: 'block' }}>
                    Model: {sessionDetail.model_version || 'v1.0'}
                  </span>
                  <span style={{ color: 'var(--color-muted-text)', display: 'block' }}>
                    Scoring: {sessionDetail.scoring_version}
                  </span>
                </div>
              </div>

              {/* Uncertainty Reasons (if any) */}
              {sessionDetail.uncertainty_reasons && sessionDetail.uncertainty_reasons.length > 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#92400e',
                      margin: '0 0 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <HelpCircle size={14} />
                    Recognition Uncertainty Factors
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#78350f' }}>
                    {sessionDetail.uncertainty_reasons.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                  <p style={{ fontSize: '11px', color: '#b45309', margin: '6px 0 0', fontStyle: 'italic' }}>
                    * Inconclusive evidence does not imply improper hygiene by the child.
                  </p>
                </div>
              )}

              {/* Score Breakdown */}
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                }}
              >
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px', color: 'var(--color-dark-text)' }}>
                  Scoring Breakdown & Penalties
                </h4>
                <div style={{ display: 'flex', gap: '20px', fontSize: '12px', marginBottom: '8px' }}>
                  <span>
                    Recognized Steps: <strong>{sessionDetail.score_breakdown.steps_recognized}</strong> / {sessionDetail.score_breakdown.total_protocol_steps}
                  </span>
                  <span>
                    Qualifying Status: <strong>{sessionDetail.score_breakdown.qualifies ? 'Passed' : 'Incomplete'}</strong>
                  </span>
                </div>

                {sessionDetail.score_breakdown.penalty_reasons.length > 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>
                    <strong>Disqualification / Penalty Reasons:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                      {sessionDetail.score_breakdown.penalty_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--color-success)' }}>
                    Full protocol satisfied with all required Rubbing movements completed.
                  </div>
                )}
              </div>

              {/* Step Sequence Table */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', color: 'var(--color-dark-text)' }}>
                  Handwashing Sequence Forensic Record
                </h4>
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
                      <th style={{ padding: '8px 10px' }}>Step Name</th>
                      <th style={{ padding: '8px 10px' }}>Expected Duration</th>
                      <th style={{ padding: '8px 10px' }}>Recognized Duration</th>
                      <th style={{ padding: '8px 10px' }}>Confidence</th>
                      <th style={{ padding: '8px 10px' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionDetail.recognized_sequence.map((st) => (
                      <tr key={st.session_step_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{st.step_name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted-text)' }}>
                          {sessionDetail.expected_sequence.find((e) => e.step_code === st.step_code)
                            ?.target_duration_seconds ?? 5}s
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {st.duration_ms ? `${(st.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted-text)' }}>
                          {st.confidence_summary ? `${Math.round(st.confidence_summary * 100)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <StatusBadge
                            status={st.result === 'recognized' ? 'success' : st.result === 'uncertain' ? 'warning' : 'neutral'}
                            label={st.result}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legal / Medical Hygiene Disclaimer */}
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-muted-text)',
                  backgroundColor: 'var(--color-canvas)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  lineHeight: 1.4,
                }}
              >
                <strong>Scientific Disclaimer:</strong> Bubsy vision models detect posture and motion adherence
                relative to WHO / NHS handwashing guidance. Sequence recognition does not prove microbiological cleanliness,
                nor does it guarantee pathogen elimination.
              </div>
            </div>
          ) : null}
        </Dialog>
      )}
    </div>
  );
};
