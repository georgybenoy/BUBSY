import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ClassesPage } from './ClassesPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { ClassItem } from '../../types/models';

const mockClasses: ClassItem[] = [
  {
    class_id: 'cls_1',
    name: 'Maple 3A',
    grade_level: '3',
    academic_year: '2026-2027',
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
    student_count: 24,
    qualifying_washes: 120,
    completion_rate: 85,
    monthly_points: 360,
  },
  {
    class_id: 'cls_2',
    name: 'Oak 4B',
    grade_level: '4',
    academic_year: '2026-2027',
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
    student_count: 22,
    qualifying_washes: 95,
    completion_rate: 78,
    monthly_points: 290,
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

describe('ClassesPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders class cards with aggregate metrics', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValueOnce({
      data: mockClasses,
      error: null,
      request_id: 'req_1',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <ClassesPage />
      </AuthContext.Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Classes' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Maple 3A')).toBeInTheDocument();
      expect(screen.getByText('Oak 4B')).toBeInTheDocument();
    });

    expect(screen.getByText('120')).toBeInTheDocument(); // Washes
    expect(screen.getByText('85%')).toBeInTheDocument(); // Completion
    expect(screen.getByText('360')).toBeInTheDocument(); // Points
  });

  it('opens Add Class dialog and submits a new class', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: mockClasses,
      error: null,
      request_id: 'req_1',
    });

    const createSpy = vi.spyOn(api, 'createClassApi').mockResolvedValueOnce({
      data: {
        class_id: 'cls_3',
        name: 'Pine 5C',
        grade_level: '5',
        academic_year: '2026-2027',
        is_active: 1,
        created_at: '2026-10-13T00:00:00Z',
      },
      error: null,
      request_id: 'req_2',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <ClassesPage />
      </AuthContext.Provider>,
    );

    const addBtn = screen.getByRole('button', { name: /Add new class/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Add New Class/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Class Name \*/i);
    fireEvent.change(nameInput, { target: { value: 'Pine 5C' } });

    const submitBtn = screen.getByRole('button', { name: /Create Class/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith('mock-valid-token', {
        name: 'Pine 5C',
        grade_level: null,
        academic_year: '2026-2027',
      });
    });
  });

  it('triggers onSelectClass callback when clicking View Students & Roster', async () => {
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValueOnce({
      data: mockClasses,
      error: null,
      request_id: 'req_1',
    });

    const onSelectMock = vi.fn();

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <ClassesPage onSelectClass={onSelectMock} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Maple 3A')).toBeInTheDocument();
    });

    const rosterBtns = screen.getAllByRole('button', { name: /View Students & Roster/i });
    fireEvent.click(rosterBtns[0]);

    expect(onSelectMock).toHaveBeenCalledWith('cls_1');
  });
});
