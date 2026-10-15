import type { LoginPayload, TeacherUser } from '../types/auth';
import type {
  KioskCompleteSessionData,
  KioskConfig,
  KioskIdentifyResult,
  KioskSessionData,
  KioskStudentProgress,
} from '../types/kiosk';
import type {
  ClassItem,
  CSVImportResult,
  IssuedCredential,
  PaginatedResult,
  StudentItem,
} from '../types/models';
import type {
  OverviewData,
  SessionListResponseData,
  SessionDetailData,
  LeaderboardResponseData,
  PointTransactionListResponseData,
  AnalyticsData,
  SettingsData,
} from '../types/teacher';

export interface HealthData {
  status: string;
  app_name: string;
  version: string;
  timestamp: string;
  environment: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponseEnvelope<T> {
  data: T | null;
  error: ApiError | null;
  request_id: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function fetchHealth(): Promise<ApiResponseEnvelope<HealthData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      if (errorJson?.error) {
        return errorJson;
      }
      return {
        data: null,
        error: {
          code: `HTTP_${response.status}`,
          message: `Backend returned HTTP status ${response.status}`,
        },
        request_id: 'network-fallback',
      };
    }

    const payload: ApiResponseEnvelope<HealthData> = await response.json();
    return payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: `Failed to connect to backend at ${API_BASE_URL}: ${message}`,
      },
      request_id: 'network-exception',
    };
  }
}

export async function loginApi(
  username: string,
  password: string,
): Promise<ApiResponseEnvelope<LoginPayload>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return (
        body || {
          data: null,
          error: {
            code: `HTTP_${response.status}`,
            message: `Authentication failed (status ${response.status}).`,
          },
          request_id: 'auth-failed',
        }
      );
    }

    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error during login';
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message,
      },
      request_id: 'login-exception',
    };
  }
}

export async function fetchMeApi(token: string): Promise<ApiResponseEnvelope<TeacherUser>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return (
        body || {
          data: null,
          error: {
            code: `HTTP_${response.status}`,
            message: `Failed to retrieve teacher profile.`,
          },
          request_id: 'me-failed',
        }
      );
    }

    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message,
      },
      request_id: 'me-exception',
    };
  }
}

export async function logoutApi(
  token?: string | null,
): Promise<ApiResponseEnvelope<{ logged_out: boolean }>> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers,
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: {
            code: `HTTP_${response.status}`,
            message: 'Logout failed on backend.',
          },
          request_id: 'logout-fallback',
        }
      );
    }

    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure during logout';
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message,
      },
      request_id: 'logout-exception',
    };
  }
}

// ----------------------------------------------------------------------
// Phase 4: Classes API
// ----------------------------------------------------------------------

export async function fetchClassesApi(
  token: string,
  academicYear?: string,
): Promise<ApiResponseEnvelope<ClassItem[]>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/classes`);
    if (academicYear) url.searchParams.append('academic_year', academicYear);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to fetch classes.' },
          request_id: 'classes-fetch-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'classes-exception',
    };
  }
}

export async function createClassApi(
  token: string,
  payload: { name: string; grade_level?: string | null; academic_year: string },
): Promise<ApiResponseEnvelope<ClassItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to create class.' },
          request_id: 'class-create-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'class-create-exception',
    };
  }
}

// ----------------------------------------------------------------------
// Phase 4: Students API
// ----------------------------------------------------------------------

export async function fetchStudentsApi(
  token: string,
  params: {
    page?: number;
    limit?: number;
    class_id?: string;
    is_active?: number;
    search?: string;
  } = {},
): Promise<ApiResponseEnvelope<PaginatedResult<StudentItem>>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/students`);
    if (params.page !== undefined) url.searchParams.append('page', String(params.page));
    if (params.limit !== undefined) url.searchParams.append('limit', String(params.limit));
    if (params.class_id) url.searchParams.append('class_id', params.class_id);
    if (params.is_active !== undefined)
      url.searchParams.append('is_active', String(params.is_active));
    if (params.search) url.searchParams.append('search', params.search);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to fetch students.' },
          request_id: 'students-fetch-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'students-exception',
    };
  }
}

export async function fetchStudentDetailApi(
  token: string,
  studentId: string,
): Promise<ApiResponseEnvelope<StudentItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/students/${studentId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to fetch student details.' },
          request_id: 'student-detail-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'student-detail-exception',
    };
  }
}

export async function createStudentApi(
  token: string,
  payload: { display_name: string; class_id: string; school_code?: string | null },
): Promise<ApiResponseEnvelope<StudentItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to create student.' },
          request_id: 'student-create-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'student-create-exception',
    };
  }
}

export async function updateStudentApi(
  token: string,
  studentId: string,
  payload: {
    display_name?: string;
    class_id?: string;
    school_code?: string | null;
    is_active?: number;
  },
): Promise<ApiResponseEnvelope<StudentItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/students/${studentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to update student.' },
          request_id: 'student-update-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'student-update-exception',
    };
  }
}

export async function setStudentStatusApi(
  token: string,
  studentId: string,
  isActive: number,
): Promise<ApiResponseEnvelope<StudentItem>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/students/${studentId}/status?is_active=${isActive}`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to update student status.' },
          request_id: 'student-status-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'student-status-exception',
    };
  }
}

export async function importStudentsCsvApi(
  token: string,
  csvText: string,
): Promise<ApiResponseEnvelope<CSVImportResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/students/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csv_text: csvText }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'CSV import request failed.' },
          request_id: 'csv-import-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'csv-import-exception',
    };
  }
}

// ----------------------------------------------------------------------
// Phase 4: Credentials API
// ----------------------------------------------------------------------

export async function issueCredentialApi(
  token: string,
  payload: { student_id: string; credential_type: 'QR' | 'NFC' },
): Promise<ApiResponseEnvelope<IssuedCredential>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/credentials/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to issue credential.' },
          request_id: 'credential-issue-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'credential-issue-exception',
    };
  }
}

export async function replaceCredentialApi(
  token: string,
  payload: { student_id: string; credential_type: 'QR' | 'NFC'; reason?: string },
): Promise<ApiResponseEnvelope<IssuedCredential>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/credentials/replace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to replace credential.' },
          request_id: 'credential-replace-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'credential-replace-exception',
    };
  }
}

export async function revokeCredentialApi(
  token: string,
  payload: { credential_id: string; reason?: string },
): Promise<ApiResponseEnvelope<{ revoked: boolean; credential_id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/credentials/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to revoke credential.' },
          request_id: 'credential-revoke-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'credential-revoke-exception',
    };
  }
}

export function getPrintableQrUrl(rawToken: string): string {
  return `${API_BASE_URL}/api/v1/credentials/printable-qr?token=${encodeURIComponent(rawToken)}`;
}

// ----------------------------------------------------------------------
// Phase 8: Kiosk API
// ----------------------------------------------------------------------

export async function fetchKioskConfig(): Promise<ApiResponseEnvelope<KioskConfig>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kiosk/config`);
    if (!response.ok) {
      return {
        data: {
          kiosk_id: 'kiosk-1',
          allow_unassigned_sessions: true,
          nfc_available: false,
          max_id_retries: 3,
          first_name_display_allowed: true,
        },
        error: null,
        request_id: 'config-default',
      };
    }
    return await response.json();
  } catch {
    return {
      data: {
        kiosk_id: 'kiosk-1',
        allow_unassigned_sessions: true,
        nfc_available: false,
        max_id_retries: 3,
        first_name_display_allowed: true,
      },
      error: null,
      request_id: 'config-fallback',
    };
  }
}

export async function identifyStudentApi(
  credentialType: 'QR' | 'NFC',
  rawValue: string,
): Promise<ApiResponseEnvelope<KioskIdentifyResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kiosk/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ credential_type: credentialType, raw_value: rawValue }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Identification failed.' },
          request_id: 'identify-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'identify-exception',
    };
  }
}

export async function createKioskSessionApi(
  studentId: string | null,
  isUnassigned: boolean,
): Promise<ApiResponseEnvelope<KioskSessionData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kiosk/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ student_id: studentId, is_unassigned: isUnassigned }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Could not create session.' },
          request_id: 'create-session-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'create-session-exception',
    };
  }
}

export async function completeKioskSessionApi(
  sessionId: string,
): Promise<ApiResponseEnvelope<KioskCompleteSessionData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kiosk/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Could not complete session.' },
          request_id: 'complete-session-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'complete-session-exception',
    };
  }
}

export async function cancelKioskSessionApi(
  sessionId: string,
): Promise<ApiResponseEnvelope<{ cancelled: boolean; session_id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kiosk/sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => null);
    return (
      body || {
        data: { cancelled: true, session_id: sessionId },
        error: null,
        request_id: 'cancel-fallback',
      }
    );
  } catch {
    return {
      data: { cancelled: true, session_id: sessionId },
      error: null,
      request_id: 'cancel-catch',
    };
  }
}

export async function getKioskStudentProgressApi(
  studentId: string,
): Promise<ApiResponseEnvelope<KioskStudentProgress>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kiosk/students/${studentId}/progress`, {
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Could not load student progress.' },
          request_id: 'progress-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'progress-exception',
    };
  }
}

export function getKioskWebSocketUrl(sessionId: string): string {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/api/v1/kiosk/sessions/${sessionId}/events`;
}

// -------------------------------------------------------------
// Teacher Portal APIs
// -------------------------------------------------------------

export async function fetchOverviewApi(
  token: string,
  period?: string,
): Promise<ApiResponseEnvelope<OverviewData>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/overview`);
    if (period) url.searchParams.set('period', period);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load overview data.' },
          request_id: 'overview-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'overview-exception',
    };
  }
}

export interface SessionQueryParams {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  class_id?: string;
  student_id?: string;
  outcome?: string;
  kiosk_id?: string;
}

export async function fetchSessionsApi(
  token: string,
  params: SessionQueryParams = {},
): Promise<ApiResponseEnvelope<SessionListResponseData>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/sessions`);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    if (params.start_date) url.searchParams.set('start_date', params.start_date);
    if (params.end_date) url.searchParams.set('end_date', params.end_date);
    if (params.class_id) url.searchParams.set('class_id', params.class_id);
    if (params.student_id) url.searchParams.set('student_id', params.student_id);
    if (params.outcome) url.searchParams.set('outcome', params.outcome);
    if (params.kiosk_id) url.searchParams.set('kiosk_id', params.kiosk_id);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load sessions.' },
          request_id: 'sessions-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'sessions-exception',
    };
  }
}

export async function fetchSessionDetailApi(
  token: string,
  sessionId: string,
): Promise<ApiResponseEnvelope<SessionDetailData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load session details.' },
          request_id: 'session-detail-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'session-detail-exception',
    };
  }
}

export async function fetchLeaderboardApi(
  token: string,
  month?: string,
  classId?: string,
  page: number = 1,
  limit: number = 50,
): Promise<ApiResponseEnvelope<LeaderboardResponseData>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/leaderboard`);
    if (month) url.searchParams.set('month', month);
    if (classId) url.searchParams.set('class_id', classId);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load leaderboard.' },
          request_id: 'leaderboard-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'leaderboard-exception',
    };
  }
}

export async function fetchPointTransactionsApi(
  token: string,
  params: { student_id?: string; month?: string; page?: number; limit?: number } = {},
): Promise<ApiResponseEnvelope<PointTransactionListResponseData>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/leaderboard/transactions`);
    if (params.student_id) url.searchParams.set('student_id', params.student_id);
    if (params.month) url.searchParams.set('month', params.month);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.limit) url.searchParams.set('limit', String(params.limit));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load point transactions.' },
          request_id: 'transactions-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'transactions-exception',
    };
  }
}

export async function submitPointCorrectionApi(
  token: string,
  payload: {
    student_id: string;
    points_delta: number;
    reason: string;
    notes?: string;
    session_id?: string;
  },
): Promise<ApiResponseEnvelope<{ transaction_id: string; student_id: string; points_delta: number; new_monthly_total: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/leaderboard/corrections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to apply point correction.' },
          request_id: 'correction-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'correction-exception',
    };
  }
}

export async function fetchAnalyticsApi(
  token: string,
  period?: string,
  classId?: string,
): Promise<ApiResponseEnvelope<AnalyticsData>> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/analytics`);
    if (period) url.searchParams.set('period', period);
    if (classId) url.searchParams.set('class_id', classId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load analytics data.' },
          request_id: 'analytics-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'analytics-exception',
    };
  }
}

export async function downloadAnalyticsCsvApi(
  token: string,
  period?: string,
  classId?: string,
): Promise<boolean> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/analytics/export`);
    if (period) url.searchParams.set('period', period);
    if (classId) url.searchParams.set('class_id', classId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return false;

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `bubsy_analytics_${period || '30d'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  } catch {
    return false;
  }
}

export async function fetchSettingsApi(
  token: string,
): Promise<ApiResponseEnvelope<SettingsData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to load settings.' },
          request_id: 'settings-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'settings-exception',
    };
  }
}

export async function updateSettingsApi(
  token: string,
  payload: Partial<SettingsData>,
): Promise<ApiResponseEnvelope<SettingsData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return (
        body || {
          data: null,
          error: { code: `HTTP_${response.status}`, message: 'Failed to update settings.' },
          request_id: 'settings-update-failed',
        }
      );
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
      request_id: 'settings-update-exception',
    };
  }
}


