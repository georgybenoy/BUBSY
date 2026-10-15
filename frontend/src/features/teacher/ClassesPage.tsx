import React, { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  Users,
  Sparkles,
  Trophy,
  Activity,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createClassApi, fetchClassesApi } from '../../services/api';
import type { ClassItem } from '../../types/models';

interface ClassesPageProps {
  onSelectClass?: (classId: string) => void;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({ onSelectClass }) => {
  const { token } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add Class Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [className, setClassName] = useState<string>('');
  const [gradeLevel, setGradeLevel] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchClassesApi(token);
      if (res.error) {
        setError(res.error.message || 'Failed to load classes.');
      } else if (res.data) {
        setClasses(res.data);
      }
    } catch {
      setError('An unexpected network error occurred while loading classes.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    fetchClassesApi(token)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setError(res.error.message || 'Failed to load classes.');
        } else if (res.data) {
          setClasses(res.data);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('An unexpected network error occurred while loading classes.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleOpenModal = () => {
    setClassName('');
    setGradeLevel('');
    setAcademicYear('2026-2027');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!className.trim()) {
      setModalError('Class name is required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await createClassApi(token, {
        name: className.trim(),
        grade_level: gradeLevel.trim() || null,
        academic_year: academicYear.trim() || '2026-2027',
      });

      if (res.error) {
        setModalError(res.error.message || 'Failed to create class.');
      } else {
        setIsModalOpen(false);
        loadClasses();
      }
    } catch {
      setModalError('An unexpected error occurred while saving the class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--color-dark-text)',
              margin: '0 0 4px 0',
            }}
          >
            Classes
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: 0 }}>
            Create classes, assign students, and compare aggregate handwashing results.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => loadClasses()}
            aria-label="Refresh class list"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-dark-text)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenModal}
            aria-label="Add new class"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Plus size={16} />
            <span>Add Class</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} color="var(--color-error)" />
            <span style={{ fontSize: '14px', color: 'var(--color-error)' }}>{error}</span>
          </div>
          <button
            onClick={() => loadClasses()}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-error)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {[1, 2, 3].map((skeleton) => (
            <div
              key={skeleton}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '24px',
                height: '200px',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            >
              <div
                style={{
                  height: '20px',
                  backgroundColor: 'var(--color-canvas)',
                  width: '60%',
                  borderRadius: '4px',
                  marginBottom: '16px',
                }}
              />
              <div
                style={{
                  height: '14px',
                  backgroundColor: 'var(--color-canvas)',
                  width: '40%',
                  borderRadius: '4px',
                  marginBottom: '24px',
                }}
              />
              <div
                style={{
                  height: '40px',
                  backgroundColor: 'var(--color-canvas)',
                  width: '100%',
                  borderRadius: '4px',
                }}
              />
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        /* Empty state */
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-soft-blue)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <GraduationCap size={28} />
          </div>
          <h3
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--color-dark-text)',
              marginBottom: '6px',
            }}
          >
            No classes registered yet
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-muted-text)',
              maxWidth: '420px',
              margin: '0 auto 20px auto',
            }}
          >
            Add your first classroom or grade group to begin tracking student participation and
            handwashing adventure progress.
          </p>
          <button
            onClick={handleOpenModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            <span>Create First Class</span>
          </button>
        </div>
      ) : (
        /* Class Cards Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {classes.map((cls) => (
            <div
              key={cls.class_id}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: 'var(--color-dark-text)',
                      margin: 0,
                    }}
                  >
                    {cls.name}
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor:
                        cls.is_active === 1 ? 'var(--color-soft-blue)' : 'var(--color-canvas)',
                      color:
                        cls.is_active === 1 ? 'var(--color-primary)' : 'var(--color-muted-text)',
                    }}
                  >
                    {cls.is_active === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-muted-text)',
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  {cls.grade_level && <span>Grade: {cls.grade_level}</span>}
                  <span>Academic Year: {cls.academic_year}</span>
                </div>

                {/* Aggregate Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--color-canvas)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: 'var(--color-muted-text)',
                        marginBottom: '4px',
                      }}
                    >
                      <Users size={14} />
                      <span>Students</span>
                    </div>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--color-dark-text)',
                      }}
                    >
                      {cls.student_count ?? 0}
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: 'var(--color-muted-text)',
                        marginBottom: '4px',
                      }}
                    >
                      <Sparkles size={14} />
                      <span>Washes</span>
                    </div>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                      }}
                    >
                      {cls.qualifying_washes ?? 0}
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: 'var(--color-muted-text)',
                        marginBottom: '4px',
                      }}
                    >
                      <Activity size={14} />
                      <span>Completion</span>
                    </div>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--color-success)',
                      }}
                    >
                      {cls.completion_rate ?? 0}%
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: 'var(--color-muted-text)',
                        marginBottom: '4px',
                      }}
                    >
                      <Trophy size={14} />
                      <span>Points</span>
                    </div>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--color-amber)',
                      }}
                    >
                      {cls.monthly_points ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {onSelectClass && (
                <button
                  onClick={() => onSelectClass(cls.class_id)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  View Students & Roster
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Class Modal Dialog */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-class-dialog-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3
                id="add-class-dialog-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-dark-text)',
                  margin: 0,
                }}
              >
                Add New Class
              </h3>
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Close dialog"
                style={{
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-muted-text)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                style={{
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--color-error)',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="class-name-input"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--color-dark-text)',
                  }}
                >
                  Class Name *
                </label>
                <input
                  id="class-name-input"
                  type="text"
                  placeholder="e.g. Grade 3 - Room B or Maple 3A"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-surface)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="grade-level-input"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--color-dark-text)',
                  }}
                >
                  Grade Level (optional)
                </label>
                <input
                  id="grade-level-input"
                  type="text"
                  placeholder="e.g. 3, Kindergarten, 4th"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-surface)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="academic-year-input"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--color-dark-text)',
                  }}
                >
                  Academic Year
                </label>
                <input
                  id="academic-year-input"
                  type="text"
                  placeholder="2026-2027"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-surface)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--color-dark-text)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
