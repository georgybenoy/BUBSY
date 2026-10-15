import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StudentsPage } from './StudentsPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { ClassItem, StudentItem } from '../../types/models';

const mockClasses: ClassItem[] = [
  {
    class_id: 'cls_1',
    name: 'Maple 3A',
    grade_level: '3',
    academic_year: '2026-2027',
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
  },
];

const mockStudents: StudentItem[] = [
  {
    student_id: 'stu_1',
    display_name: 'Maya Lin',
    class_id: 'cls_1',
    class_name: 'Maple 3A',
    school_code: 'STU-101',
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
    monthly_points: 150,
    qualifying_washes: 15,
    active_credential: {
      credential_id: 'cred_1',
      credential_type: 'QR',
      issued_at: '2026-10-10T00:00:00Z',
    },
  },
  {
    student_id: 'stu_2',
    display_name: 'Lucas Diaz',
    class_id: 'cls_1',
    class_name: 'Maple 3A',
    school_code: null,
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
    monthly_points: 80,
    qualifying_washes: 8,
    active_credential: null,
  },
];

const mockAuthValue = {
  user: {
    teacher_id: 'teach_1',
    username: 'teacher1',
    role: 'teacher' as const,
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
  },
  token: 'mock-valid-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
};

describe('StudentsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders student table with metrics and credential status', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValueOnce({
      data: mockClasses,
      error: null,
      request_id: 'req_cls',
    });
    vi.spyOn(api, 'fetchStudentsApi').mockResolvedValueOnce({
      data: {
        items: mockStudents,
        total: 2,
        page: 1,
        limit: 15,
        pages: 1,
      },
      error: null,
      request_id: 'req_stu',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <StudentsPage />
      </AuthContext.Provider>,
    );

    expect(screen.getByText(/Students/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Maya Lin')).toBeInTheDocument();
      expect(screen.getByText('Lucas Diaz')).toBeInTheDocument();
    });

    // Check credential tags
    expect(screen.getByText('QR Badge')).toBeInTheDocument();
    expect(screen.getByText('No Badge')).toBeInTheDocument();

    // Check metrics
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('opens Add Student modal and can submit a new student', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: mockClasses,
      error: null,
      request_id: 'req_cls',
    });
    vi.spyOn(api, 'fetchStudentsApi').mockResolvedValue({
      data: {
        items: mockStudents,
        total: 2,
        page: 1,
        limit: 15,
        pages: 1,
      },
      error: null,
      request_id: 'req_stu',
    });

    const createStudentSpy = vi.spyOn(api, 'createStudentApi').mockResolvedValueOnce({
      data: {
        student_id: 'stu_3',
        display_name: 'Emma Watson',
        class_id: 'cls_1',
        school_code: 'STU-103',
        is_active: 1,
        created_at: '2026-10-13T00:00:00Z',
      },
      error: null,
      request_id: 'req_c_stu',
    });

    const issueCredSpy = vi.spyOn(api, 'issueCredentialApi').mockResolvedValueOnce({
      data: {
        credential_id: 'cred_new',
        student_id: 'stu_3',
        credential_type: 'QR',
        raw_token: 'opaque-token-12345',
        issued_at: '2026-10-13T00:00:00Z',
      },
      error: null,
      request_id: 'req_cred',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <StudentsPage />
      </AuthContext.Provider>,
    );

    await screen.findByText('Maya Lin');

    const addBtn = screen.getByRole('button', { name: /Add new student/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Add New Student/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Student Display Name \*/i);
    fireEvent.change(nameInput, { target: { value: 'Emma Watson' } });

    const classSelect = screen.getByLabelText(/Assigned Class \*/i);
    fireEvent.change(classSelect, { target: { value: 'cls_1' } });

    const submitBtn = screen.getByRole('button', { name: /Create Student/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(createStudentSpy).toHaveBeenCalled();
      expect(issueCredSpy).toHaveBeenCalledWith('mock-valid-token', {
        student_id: 'stu_3',
        credential_type: 'QR',
      });
    });

    // Check that Printable QR badge modal is shown
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Printable QR Credential Badge/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Privacy Guaranteed/i)).toBeInTheDocument();
    });
  });

  it('opens Manage Credential modal and allows issuing or replacing badge', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: mockClasses,
      error: null,
      request_id: 'req_cls',
    });
    vi.spyOn(api, 'fetchStudentsApi').mockResolvedValue({
      data: {
        items: mockStudents,
        total: 2,
        page: 1,
        limit: 15,
        pages: 1,
      },
      error: null,
      request_id: 'req_stu',
    });

    const replaceCredSpy = vi.spyOn(api, 'replaceCredentialApi').mockResolvedValueOnce({
      data: {
        credential_id: 'cred_replaced',
        student_id: 'stu_1',
        credential_type: 'QR',
        raw_token: 'new-opaque-token-xyz',
        issued_at: '2026-10-13T00:00:00Z',
      },
      error: null,
      request_id: 'req_replace',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <StudentsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Maya Lin')).toBeInTheDocument();
    });

    const manageBtn = screen.getByRole('button', { name: /Manage credentials for Maya Lin/i });
    fireEvent.click(manageBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Manage Credential Badge/i })).toBeInTheDocument();

    const replaceBtn = screen.getByRole('button', { name: /Replace QR Badge/i });
    fireEvent.click(replaceBtn);

    await waitFor(() => {
      expect(replaceCredSpy).toHaveBeenCalledWith('mock-valid-token', {
        student_id: 'stu_1',
        credential_type: 'QR',
        reason: 'Replaced by teacher',
      });
    });
  });

  it('opens Import CSV modal and handles bulk upload with sanitized feedback', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: mockClasses,
      error: null,
      request_id: 'req_cls',
    });
    vi.spyOn(api, 'fetchStudentsApi').mockResolvedValue({
      data: {
        items: mockStudents,
        total: 2,
        page: 1,
        limit: 15,
        pages: 1,
      },
      error: null,
      request_id: 'req_stu',
    });

    const importSpy = vi.spyOn(api, 'importStudentsCsvApi').mockResolvedValueOnce({
      data: {
        imported: 5,
        skipped: 0,
        errors: [],
      },
      error: null,
      request_id: 'req_imp',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <StudentsPage />
      </AuthContext.Provider>,
    );

    const importBtn = screen.getByRole('button', { name: /Import students from CSV/i });
    fireEvent.click(importBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Import Students from CSV/i })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Alice Wang,Grade 3 - Room B,STU-101/i);
    fireEvent.change(textarea, {
      target: { value: 'display_name,class_name,school_code\nJohn Doe,Maple 3A,STU-99' },
    });

    const uploadBtn = screen.getByRole('button', { name: /Upload & Import/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        'mock-valid-token',
        'display_name,class_name,school_code\nJohn Doe,Maple 3A,STU-99',
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/CSV Processing Complete/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
