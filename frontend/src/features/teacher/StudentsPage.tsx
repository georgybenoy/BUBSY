import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  QrCode,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Printer,
  Sparkles,
  Trophy,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  fetchStudentsApi,
  fetchClassesApi,
  createStudentApi,
  setStudentStatusApi,
  importStudentsCsvApi,
  issueCredentialApi,
  replaceCredentialApi,
  revokeCredentialApi,
  getPrintableQrUrl,
} from '../../services/api';
import type { StudentItem, ClassItem, CSVImportResult, IssuedCredential } from '../../types/models';

interface StudentsPageProps {
  initialClassId?: string | null;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({ initialClassId }) => {
  const { token } = useAuth();

  // State: Data
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const pageSize = 15;

  // State: Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(''); // '' = all, '1' = active, '0' = inactive

  // State: Page Status
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State: Modals
  const [isAddStudentOpen, setIsAddStudentOpen] = useState<boolean>(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState<boolean>(false);
  const [profileStudent, setProfileStudent] = useState<StudentItem | null>(null);
  const [credentialStudent, setCredentialStudent] = useState<StudentItem | null>(null);
  const [printedCredential, setPrintedCredential] = useState<{
    student: StudentItem;
    issued: IssuedCredential;
  } | null>(null);

  // Add Student Form State
  const [addName, setAddName] = useState<string>('');
  const [addClassId, setAddClassId] = useState<string>('');
  const [addSchoolCode, setAddSchoolCode] = useState<string>('');
  const [addGenerateQr, setAddGenerateQr] = useState<boolean>(true);
  const [isAddingStudent, setIsAddingStudent] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // CSV Import State
  const [csvText, setCsvText] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage Credential State
  const [isManagingCredential, setIsManagingCredential] = useState<boolean>(false);
  const [credentialActionError, setCredentialActionError] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('lost');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;
    fetchClassesApi(token).then((res) => {
      if (isMounted && res.data) {
        setClasses(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Sync initialClassId if provided as prop
  const [prevInitialClassId, setPrevInitialClassId] = useState(initialClassId);
  if (initialClassId !== prevInitialClassId) {
    setPrevInitialClassId(initialClassId);
    setSelectedClassId(initialClassId || '');
  }

  // Load Students with pagination and filters
  const loadStudents = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchStudentsApi(token, {
        page: currentPage,
        limit: pageSize,
        class_id: selectedClassId || undefined,
        is_active: selectedStatus !== '' ? Number(selectedStatus) : undefined,
        search: debouncedSearch.trim() || undefined,
      });

      if (res.error) {
        setError(res.error.message || 'Failed to load students.');
      } else if (res.data) {
        setStudents(res.data.items);
        setTotalStudents(res.data.total);
        setTotalPages(res.data.pages || 1);
      }
    } catch {
      setError('A network error occurred while loading students.');
    } finally {
      setIsLoading(false);
    }
  }, [token, currentPage, selectedClassId, selectedStatus, debouncedSearch]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    fetchStudentsApi(token, {
      page: currentPage,
      limit: pageSize,
      class_id: selectedClassId || undefined,
      is_active: selectedStatus !== '' ? Number(selectedStatus) : undefined,
      search: debouncedSearch.trim() || undefined,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setError(res.error.message || 'Failed to load students.');
        } else if (res.data) {
          setStudents(res.data.items);
          setTotalStudents(res.data.total);
          setTotalPages(res.data.pages || 1);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('A network error occurred while loading students.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, currentPage, selectedClassId, selectedStatus, debouncedSearch]);

  // Toggle active status
  const handleToggleStatus = async (student: StudentItem) => {
    if (!token) return;
    const newStatus = student.is_active === 1 ? 0 : 1;
    const confirmMessage =
      newStatus === 0
        ? `Are you sure you want to deactivate ${student.display_name}? Deactivated students cannot identify at kiosks.`
        : `Reactivate ${student.display_name}?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await setStudentStatusApi(token, student.student_id, newStatus);
      if (res.error) {
        alert(res.error.message || 'Failed to change student status.');
      } else {
        loadStudents();
      }
    } catch {
      alert('Network error updating student status.');
    }
  };

  // Handle Add Student Submit
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!addName.trim()) {
      setAddError('Display name is required.');
      return;
    }
    if (!addClassId) {
      setAddError('Please select a class.');
      return;
    }

    setIsAddingStudent(true);
    setAddError(null);

    try {
      const createRes = await createStudentApi(token, {
        display_name: addName.trim(),
        class_id: addClassId,
        school_code: addSchoolCode.trim() || null,
      });

      if (createRes.error || !createRes.data) {
        setAddError(createRes.error?.message || 'Failed to create student.');
        setIsAddingStudent(false);
        return;
      }

      const newStudent = createRes.data;

      // If user selected immediate QR badge generation
      if (addGenerateQr) {
        const credRes = await issueCredentialApi(token, {
          student_id: newStudent.student_id,
          credential_type: 'QR',
        });

        if (credRes.data) {
          setPrintedCredential({
            student: newStudent,
            issued: credRes.data,
          });
        }
      }

      setIsAddStudentOpen(false);
      setAddName('');
      setAddSchoolCode('');
      loadStudents();
    } catch {
      setAddError('An unexpected network error occurred.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Handle CSV Import Submit
  const handleImportCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    let contentToUpload = csvText.trim();

    if (csvFile) {
      try {
        contentToUpload = await csvFile.text();
      } catch {
        setImportError('Failed to read the selected CSV file.');
        return;
      }
    }

    if (!contentToUpload) {
      setImportError('Please select a CSV file or paste CSV text.');
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const res = await importStudentsCsvApi(token, contentToUpload);
      if (res.error) {
        setImportError(res.error.message || 'Failed to import CSV.');
      } else if (res.data) {
        setImportResult(res.data);
        loadStudents();
      }
    } catch {
      setImportError('An unexpected network error occurred during CSV import.');
    } finally {
      setIsImporting(false);
    }
  };

  // Credential Actions: Issue or Replace
  const handleIssueOrReplaceCredential = async () => {
    if (!token || !credentialStudent) return;
    setIsManagingCredential(true);
    setCredentialActionError(null);

    try {
      const isReplacement = Boolean(credentialStudent.active_credential);
      const res = isReplacement
        ? await replaceCredentialApi(token, {
            student_id: credentialStudent.student_id,
            credential_type: 'QR',
            reason: 'Replaced by teacher',
          })
        : await issueCredentialApi(token, {
            student_id: credentialStudent.student_id,
            credential_type: 'QR',
          });

      if (res.error || !res.data) {
        setCredentialActionError(res.error?.message || 'Failed to generate credential.');
      } else {
        const issued = res.data;
        setPrintedCredential({
          student: credentialStudent,
          issued,
        });
        setCredentialStudent(null);
        loadStudents();
      }
    } catch {
      setCredentialActionError('Network error while issuing credential.');
    } finally {
      setIsManagingCredential(false);
    }
  };

  // Credential Actions: Revoke
  const handleRevokeCredential = async () => {
    if (!token || !credentialStudent?.active_credential) return;
    if (
      !window.confirm(
        `Are you sure you want to revoke the active ${credentialStudent.active_credential.credential_type} badge for ${credentialStudent.display_name}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsManagingCredential(true);
    setCredentialActionError(null);

    try {
      const res = await revokeCredentialApi(token, {
        credential_id: credentialStudent.active_credential.credential_id,
        reason: revokeReason,
      });

      if (res.error) {
        setCredentialActionError(res.error.message || 'Failed to revoke credential.');
      } else {
        setCredentialStudent(null);
        loadStudents();
      }
    } catch {
      setCredentialActionError('Network error while revoking credential.');
    } finally {
      setIsManagingCredential(false);
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
            Students
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: 0 }}>
            Manage student rosters, QR credentials, and track monthly Bubsy Points.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadStudents()}
            aria-label="Refresh student roster"
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
            onClick={() => {
              setCsvText('');
              setCsvFile(null);
              setImportResult(null);
              setImportError(null);
              setIsImportCsvOpen(true);
            }}
            aria-label="Import students from CSV"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 14px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-primary)',
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              setAddName('');
              setAddClassId(selectedClassId || (classes[0]?.class_id ?? ''));
              setAddSchoolCode('');
              setAddGenerateQr(true);
              setAddError(null);
              setIsAddStudentOpen(true);
            }}
            aria-label="Add new student"
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
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          backgroundColor: 'var(--color-surface)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Search */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 240px',
            minWidth: '220px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={18}
            color="var(--color-muted-text)"
            style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search by student name or school ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search students"
            style={{
              width: '100%',
              padding: '9px 36px 9px 38px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              fontSize: '14px',
              backgroundColor: 'var(--color-canvas)',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '10px',
                padding: '2px',
                color: 'var(--color-muted-text)',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Class Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--color-muted-text)" />
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by class"
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-canvas)',
              fontSize: '14px',
              color: 'var(--color-dark-text)',
              cursor: 'pointer',
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

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by status"
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-canvas)',
              fontSize: '14px',
              color: 'var(--color-dark-text)',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            <option value="1">Active Only</option>
            <option value="0">Inactive Only</option>
          </select>
        </div>

        {/* Active Filters Clear Button */}
        {(searchTerm || selectedClassId || selectedStatus) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedClassId('');
              setSelectedStatus('');
              setCurrentPage(1);
            }}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-primary)',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Reset Filters
          </button>
        )}
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
            onClick={() => loadStudents()}
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

      {/* Students Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--color-canvas)',
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-muted-text)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '14px 20px' }}>Student</th>
                <th style={{ padding: '14px 20px' }}>Class</th>
                <th style={{ padding: '14px 20px' }}>Monthly Points</th>
                <th style={{ padding: '14px 20px' }}>Qualifying Washes</th>
                <th style={{ padding: '14px 20px' }}>Credential</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: 'var(--color-muted-text)',
                      }}
                    >
                      <RefreshCw size={18} className="spin-animation" />
                      <span>Loading student records...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--color-soft-blue)',
                          color: 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Users size={24} />
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '16px',
                          color: 'var(--color-dark-text)',
                        }}
                      >
                        No students found
                      </span>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--color-muted-text)',
                          maxWidth: '380px',
                          margin: 0,
                        }}
                      >
                        {searchTerm || selectedClassId || selectedStatus
                          ? 'Try clearing or broadening your search and filter criteria.'
                          : 'Add your first student or import a roster via CSV to get started.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const hasCredential = Boolean(student.active_credential);
                  return (
                    <tr
                      key={student.student_id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* Student Name & School Code */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button
                            onClick={() => setProfileStudent(student)}
                            style={{
                              textAlign: 'left',
                              fontWeight: 700,
                              color: 'var(--color-primary)',
                              fontSize: '14px',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            {student.display_name}
                          </button>
                          {student.school_code && (
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--color-muted-text)',
                                marginTop: '2px',
                              }}
                            >
                              ID: {student.school_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Class */}
                      <td style={{ padding: '14px 20px', color: 'var(--color-dark-text)' }}>
                        {student.class_name || '—'}
                      </td>

                      {/* Monthly Points */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Trophy size={14} color="var(--color-amber)" />
                          <span style={{ fontWeight: 700, color: 'var(--color-dark-text)' }}>
                            {student.monthly_points ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Qualifying Washes */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={14} color="var(--color-primary)" />
                          <span style={{ fontWeight: 600 }}>{student.qualifying_washes ?? 0}</span>
                        </div>
                      </td>

                      {/* Credential Status */}
                      <td style={{ padding: '14px 20px' }}>
                        {hasCredential ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'var(--color-soft-blue)',
                              color: 'var(--color-primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            <QrCode size={13} />
                            <span>{student.active_credential?.credential_type} Badge</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-muted-text)',
                              fontStyle: 'italic',
                            }}
                          >
                            No Badge
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor:
                              student.is_active === 1
                                ? 'rgba(22, 163, 74, 0.1)'
                                : 'var(--color-canvas)',
                            color:
                              student.is_active === 1
                                ? 'var(--color-success)'
                                : 'var(--color-muted-text)',
                          }}
                        >
                          {student.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <button
                            onClick={() => setCredentialStudent(student)}
                            title="Manage Badge / Credential"
                            aria-label={`Manage credentials for ${student.display_name}`}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <QrCode size={14} />
                            <span>Badge</span>
                          </button>

                          <button
                            onClick={() => handleToggleStatus(student)}
                            title={student.is_active === 1 ? 'Deactivate' : 'Reactivate'}
                            aria-label={`${student.is_active === 1 ? 'Deactivate' : 'Reactivate'} ${student.display_name}`}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              fontSize: '12px',
                              fontWeight: 600,
                              color:
                                student.is_active === 1
                                  ? 'var(--color-error)'
                                  : 'var(--color-success)',
                              cursor: 'pointer',
                            }}
                          >
                            {student.is_active === 1 ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalStudents > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
              Showing {students.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, totalStudents)} of {totalStudents} students
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: currentPage <= 1 ? 'var(--color-muted-text)' : 'var(--color-dark-text)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.6 : 1,
                }}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-dark-text)',
                  padding: '0 8px',
                }}
              >
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color:
                    currentPage >= totalPages
                      ? 'var(--color-muted-text)'
                      : 'var(--color-dark-text)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.6 : 1,
                }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Modal 1: Add Student Dialog */}
      {/* ---------------------------------------------------------------------- */}
      {isAddStudentOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-student-title"
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
            if (e.target === e.currentTarget && !isAddingStudent) setIsAddStudentOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
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
                id="add-student-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-dark-text)',
                  margin: 0,
                }}
              >
                Add New Student
              </h3>
              <button
                onClick={() => setIsAddStudentOpen(false)}
                disabled={isAddingStudent}
                aria-label="Close add student dialog"
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-muted-text)' }}
              >
                <X size={20} />
              </button>
            </div>

            {addError && (
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
                {addError}
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="add-student-name"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--color-dark-text)',
                  }}
                >
                  Student Display Name *
                </label>
                <input
                  id="add-student-name"
                  type="text"
                  placeholder="e.g. Maya Lin"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
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
                  htmlFor="add-student-class"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--color-dark-text)',
                  }}
                >
                  Assigned Class *
                </label>
                <select
                  id="add-student-class"
                  value={addClassId}
                  onChange={(e) => setAddClassId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <option value="">Select a class...</option>
                  {classes.map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {cls.name} ({cls.academic_year})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="add-student-school-code"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--color-dark-text)',
                  }}
                >
                  School Student ID / Code (optional)
                </label>
                <input
                  id="add-student-school-code"
                  type="text"
                  placeholder="e.g. STU-2026-09"
                  value={addSchoolCode}
                  onChange={(e) => setAddSchoolCode(e.target.value)}
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

              <div
                style={{
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  backgroundColor: 'var(--color-canvas)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <input
                  id="add-generate-qr-checkbox"
                  type="checkbox"
                  checked={addGenerateQr}
                  onChange={(e) => setAddGenerateQr(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="add-generate-qr-checkbox"
                  style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Generate QR Badge immediately for kiosk check-in
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  disabled={isAddingStudent}
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
                  disabled={isAddingStudent}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isAddingStudent ? 'not-allowed' : 'pointer',
                    opacity: isAddingStudent ? 0.7 : 1,
                  }}
                >
                  {isAddingStudent ? 'Creating...' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal 2: Import CSV Dialog */}
      {/* ---------------------------------------------------------------------- */}
      {isImportCsvOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-csv-title"
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
            if (e.target === e.currentTarget && !isImporting) setIsImportCsvOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3
                id="import-csv-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-dark-text)',
                  margin: 0,
                }}
              >
                Import Students from CSV
              </h3>
              <button
                onClick={() => setIsImportCsvOpen(false)}
                disabled={isImporting}
                aria-label="Close CSV import dialog"
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-muted-text)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Instruction Tip */}
            <div
              style={{
                backgroundColor: 'var(--color-canvas)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--color-dark-text)',
                marginBottom: '16px',
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                <Info size={16} color="var(--color-primary)" />
                <span>CSV Format Requirements:</span>
              </div>
              <p style={{ margin: '0 0 6px 0' }}>
                Required headers: <code>display_name,class_name,school_code</code>
              </p>
              <p style={{ margin: 0, color: 'var(--color-muted-text)', fontSize: '12px' }}>
                Formulas and leading symbols (=, +, -, @) are automatically sanitized for
                spreadsheet safety. Limit: 500 rows, 1MB maximum.
              </p>
            </div>

            {importError && (
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
                {importError}
              </div>
            )}

            {importResult ? (
              /* Success / Result State */
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    border: '1px solid var(--color-success)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--color-success)',
                      fontWeight: 700,
                      marginBottom: '6px',
                    }}
                  >
                    <CheckCircle size={18} />
                    <span>CSV Processing Complete</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-dark-text)' }}>
                    Successfully imported: <strong>{importResult.imported}</strong> student(s).
                    {importResult.skipped > 0 && (
                      <span> Skipped: {importResult.skipped} row(s).</span>
                    )}
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div
                    style={{
                      maxHeight: '140px',
                      overflowY: 'auto',
                      padding: '10px',
                      backgroundColor: 'var(--color-canvas)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      color: 'var(--color-error)',
                    }}
                  >
                    <strong>Row Warnings/Errors:</strong>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '20px',
                  }}
                >
                  <button
                    onClick={() => {
                      setIsImportCsvOpen(false);
                      setImportResult(null);
                    }}
                    style={{
                      padding: '9px 18px',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImportCsvSubmit}>
                {/* File picker */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '6px',
                      color: 'var(--color-dark-text)',
                    }}
                  >
                    Choose CSV File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCsvFile(e.target.files[0]);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div
                  style={{
                    textAlign: 'center',
                    margin: '8px 0',
                    color: 'var(--color-muted-text)',
                    fontSize: '12px',
                  }}
                >
                  — OR PASTE CSV DATA BELOW —
                </div>

                {/* Paste Area */}
                <div style={{ marginBottom: '20px' }}>
                  <textarea
                    rows={6}
                    placeholder="display_name,class_name,school_code&#10;Alice Wang,Grade 3 - Room B,STU-101&#10;Bob Dylan,Grade 3 - Room B,STU-102"
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      if (e.target.value.trim()) setCsvFile(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsImportCsvOpen(false)}
                    disabled={isImporting}
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
                    disabled={isImporting}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: isImporting ? 'not-allowed' : 'pointer',
                      opacity: isImporting ? 0.7 : 1,
                    }}
                  >
                    {isImporting ? 'Importing...' : 'Upload & Import'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal 3: Manage Credential Dialog */}
      {/* ---------------------------------------------------------------------- */}
      {credentialStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-credential-title"
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
            if (e.target === e.currentTarget && !isManagingCredential) setCredentialStudent(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3
                  id="manage-credential-title"
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--color-dark-text)',
                    margin: '0 0 2px 0',
                  }}
                >
                  Manage Credential Badge
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
                  Student: <strong>{credentialStudent.display_name}</strong>
                </span>
              </div>
              <button
                onClick={() => setCredentialStudent(null)}
                disabled={isManagingCredential}
                aria-label="Close credential dialog"
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-muted-text)' }}
              >
                <X size={20} />
              </button>
            </div>

            {credentialActionError && (
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
                {credentialActionError}
              </div>
            )}

            {/* Current Credential Status Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-canvas)',
                border: '1px solid var(--color-border)',
                marginBottom: '20px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-muted-text)',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Current Badge Status
              </span>
              {credentialStudent.active_credential ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--color-success)',
                      fontWeight: 700,
                      fontSize: '14px',
                      marginBottom: '4px',
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>
                      Active {credentialStudent.active_credential.credential_type} Credential
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>
                    Issued on:{' '}
                    {new Date(credentialStudent.active_credential.issued_at).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-muted-text)',
                    fontSize: '14px',
                  }}
                >
                  <XCircle size={16} />
                  <span>No active credential badge assigned.</span>
                </div>
              )}
            </div>

            {/* Action 1: Issue or Replace QR Badge */}
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 6px 0' }}>
                {credentialStudent.active_credential
                  ? 'Replace with New QR Badge'
                  : 'Issue New QR Badge'}
              </h4>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-muted-text)',
                  margin: '0 0 12px 0',
                  lineHeight: 1.4,
                }}
              >
                {credentialStudent.active_credential
                  ? 'Generating a new badge revokes the old badge immediately. The student record, points, and session history remain intact.'
                  : 'Generates a random, privacy-preserving QR badge token for this student to scan at kiosk check-in.'}
              </p>
              <button
                onClick={handleIssueOrReplaceCredential}
                disabled={isManagingCredential}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  cursor: isManagingCredential ? 'not-allowed' : 'pointer',
                  opacity: isManagingCredential ? 0.7 : 1,
                }}
              >
                <QrCode size={15} />
                <span>
                  {credentialStudent.active_credential ? 'Replace QR Badge' : 'Issue QR Badge'}
                </span>
              </button>
            </div>

            {/* Action 2: Revoke Credential (if active) */}
            {credentialStudent.active_credential && (
              <div
                style={{
                  border: '1px solid rgba(185, 28, 28, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  backgroundColor: 'rgba(254, 242, 242, 0.4)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--color-error)',
                    fontWeight: 700,
                    fontSize: '14px',
                    marginBottom: '6px',
                  }}
                >
                  <ShieldAlert size={16} />
                  <span>Revoke Badge Without Replacement</span>
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-muted-text)',
                    margin: '0 0 10px 0',
                  }}
                >
                  The current badge will immediately stop working at school kiosks.
                </p>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    <option value="lost">Lost badge</option>
                    <option value="damaged">Damaged badge</option>
                    <option value="compromised">Security/compromised</option>
                    <option value="student_left">Student departed</option>
                  </select>

                  <button
                    onClick={handleRevokeCredential}
                    disabled={isManagingCredential}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-error)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isManagingCredential ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Revoke Badge
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal 4: Printable QR Badge Dialog */}
      {/* ---------------------------------------------------------------------- */}
      {printedCredential && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-qr-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintedCredential(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '440px',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3
                id="print-qr-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-dark-text)',
                  margin: 0,
                }}
              >
                Printable QR Credential Badge
              </h3>
              <button
                onClick={() => setPrintedCredential(null)}
                aria-label="Close QR badge dialog"
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-muted-text)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Privacy Alert */}
            <div
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid var(--color-soft-blue)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--color-primary)',
                marginBottom: '20px',
                textAlign: 'left',
                lineHeight: 1.4,
              }}
            >
              <strong>Privacy Guaranteed:</strong> This badge encodes an opaque, random security
              token with zero embedded personal data. In compliance with security policy, the raw
              token is never stored in the database and is shown here only once.
            </div>

            {/* Printable Badge Card Preview */}
            <div
              id="printable-badge-area"
              style={{
                border: '2px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px 16px',
                backgroundColor: '#ffffff',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--color-primary)',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                }}
              >
                BUBSY ADVENTURE PASS
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--color-dark-text)',
                  marginBottom: '4px',
                }}
              >
                {printedCredential.student.display_name}
              </div>
              {printedCredential.student.school_code && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-muted-text)',
                    marginBottom: '16px',
                  }}
                >
                  ID: {printedCredential.student.school_code}
                </div>
              )}

              {/* QR Code Image from in-memory endpoint */}
              <div
                style={{
                  padding: '8px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#ffffff',
                  marginBottom: '12px',
                }}
              >
                <img
                  src={getPrintableQrUrl(printedCredential.issued.raw_token)}
                  alt={`QR Badge for ${printedCredential.student.display_name}`}
                  style={{
                    width: '200px',
                    height: '200px',
                    display: 'block',
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                Hold badge up to school kiosk webcam to sign in
              </div>
            </div>

            {/* Print and Close Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <Printer size={16} />
                <span>Print Badge</span>
              </button>

              <button
                onClick={() => setPrintedCredential(null)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-dark-text)',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal 5: Student Profile Drawer / Modal */}
      {/* ---------------------------------------------------------------------- */}
      {profileStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-profile-title"
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
            if (e.target === e.currentTarget) setProfileStudent(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '20px',
              }}
            >
              <div>
                <h3
                  id="student-profile-title"
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: 'var(--color-dark-text)',
                    margin: '0 0 4px 0',
                  }}
                >
                  {profileStudent.display_name}
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
                  Class: {profileStudent.class_name || 'Unassigned'} • Student ID:{' '}
                  {profileStudent.school_code || 'None'}
                </span>
              </div>
              <button
                onClick={() => setProfileStudent(null)}
                aria-label="Close profile dialog"
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-muted-text)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Metric Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--color-canvas)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-muted-text)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Monthly Bubsy Points
                </span>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: 'var(--color-amber)',
                  }}
                >
                  {profileStudent.monthly_points ?? 0}
                </span>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-canvas)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-muted-text)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Qualifying Washes
                </span>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                  }}
                >
                  {profileStudent.qualifying_washes ?? 0}
                </span>
              </div>
            </div>

            {/* Credential Status Section */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-canvas)',
                border: '1px solid var(--color-border)',
                marginBottom: '24px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-muted-text)',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Credential & Identification
              </span>

              {profileStudent.active_credential ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <QrCode size={18} color="var(--color-primary)" />
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>
                        Active {profileStudent.active_credential.credential_type} Badge
                      </span>
                      <div style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>
                        Issued:{' '}
                        {new Date(profileStudent.active_credential.issued_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const studentToManage = profileStudent;
                      setProfileStudent(null);
                      setCredentialStudent(studentToManage);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Manage
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--color-muted-text)' }}>
                    No badge currently assigned to this student.
                  </span>
                  <button
                    onClick={() => {
                      const studentToManage = profileStudent;
                      setProfileStudent(null);
                      setCredentialStudent(studentToManage);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Issue Badge
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setProfileStudent(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
