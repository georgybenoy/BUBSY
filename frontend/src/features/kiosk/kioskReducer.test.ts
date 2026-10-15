import { describe, it, expect } from 'vitest';
import { kioskReducer, initialKioskState } from './kioskReducer';
import type {
  KioskChildSafeEvent,
  KioskCompleteSessionData,
  KioskIdentifyResult,
  KioskStudentProgress,
} from '../../types/kiosk';

describe('Kiosk State Machine Reducer', () => {
  it('starts at HOME state with default config', () => {
    expect(initialKioskState.screen).toBe('HOME');
    expect(initialKioskState.config.kiosk_id).toBe('kiosk-1');
  });

  it('transitions from HOME to IDENTIFY on START_WASH', () => {
    const next = kioskReducer(initialKioskState, { type: 'START_WASH' });
    expect(next.screen).toBe('IDENTIFY');
    expect(next.retryCount).toBe(0);
    expect(next.teacherAssistanceRequired).toBe(false);
  });

  it('transitions from IDENTIFY to CONFIRM on IDENTIFY_SUCCESS', () => {
    const student: KioskIdentifyResult = {
      student_id: 'student-123',
      display_handle: 'Liam',
      first_name: 'Liam',
      retry_count: 0,
      teacher_assistance_required: false,
    };
    const s1 = kioskReducer(initialKioskState, { type: 'START_WASH' });
    const s2 = kioskReducer(s1, { type: 'IDENTIFY_SUCCESS', payload: student });
    expect(s2.screen).toBe('CONFIRM');
    expect(s2.student?.first_name).toBe('Liam');
  });

  it('increments retry count and sets teacherAssistanceRequired when limit reached', () => {
    const s1 = kioskReducer(initialKioskState, { type: 'START_WASH' });
    const s2 = kioskReducer(s1, {
      type: 'IDENTIFY_FAIL',
      payload: { retryCount: 3, teacherAssistanceRequired: true, message: 'Card not found' },
    });
    expect(s2.retryCount).toBe(3);
    expect(s2.teacherAssistanceRequired).toBe(true);
    expect(s2.errorMessage).toBe('Card not found');
  });

  it('transitions to PREPARATION on CHOOSE_UNASSIGNED', () => {
    const s1 = kioskReducer(initialKioskState, { type: 'START_WASH' });
    const s2 = kioskReducer(s1, { type: 'CHOOSE_UNASSIGNED' });
    expect(s2.screen).toBe('PREPARATION');
    expect(s2.isUnassigned).toBe(true);
    expect(s2.student).toBeNull();
  });

  it('transitions to PREPARATION on CONFIRM_STUDENT', () => {
    const s1 = { ...initialKioskState, screen: 'CONFIRM' as const };
    const s2 = kioskReducer(s1, { type: 'CONFIRM_STUDENT' });
    expect(s2.screen).toBe('PREPARATION');
  });

  it('transitions to ACTIVE_WASH on PREPARATION_FINISHED', () => {
    const s1 = { ...initialKioskState, screen: 'PREPARATION' as const, sessionId: 'sess-1' };
    const s2 = kioskReducer(s1, { type: 'PREPARATION_FINISHED' });
    expect(s2.screen).toBe('ACTIVE_WASH');
    expect(s2.activeEvent?.step_code).toBe('STEP_1');
    expect(s2.activeEvent?.step_name).toBe('Palm to Palm');
  });

  it('updates live step data on WS_EVENT_RECEIVED', () => {
    const s1 = { ...initialKioskState, screen: 'ACTIVE_WASH' as const, sessionId: 'sess-1' };
    const wsEvent: KioskChildSafeEvent = {
      session_id: 'sess-1',
      step_code: 'STEP_3',
      sequence_index: 3,
      step_number: 3,
      total_steps: 6,
      step_name: 'Between Fingers',
      prompt_text: 'Rub between your fingers!',
      status_hint: 'KEEP_RUBBING',
      progress_ratio: 0.65,
      is_verified_step: true,
      is_completed: false,
    };
    const s2 = kioskReducer(s1, { type: 'WS_EVENT_RECEIVED', payload: wsEvent });
    expect(s2.activeEvent?.step_code).toBe('STEP_3');
    expect(s2.activeEvent?.status_hint).toBe('KEEP_RUBBING');
    expect(s2.activeEvent?.progress_ratio).toBe(0.65);
  });

  it('transitions to RESULT on SESSION_COMPLETED', () => {
    const s1 = { ...initialKioskState, screen: 'ACTIVE_WASH' as const, sessionId: 'sess-1' };
    const comp: KioskCompleteSessionData = {
      session_id: 'sess-1',
      outcome: 'completed',
      technique_score: 95.0,
      points_awarded: 15,
      qualifies_for_points: true,
      reason_code: 'VALIDATED_COMPLETION',
      duration_seconds: 45,
      status: 'awarded',
      breakdown: {},
    };
    const s2 = kioskReducer(s1, { type: 'SESSION_COMPLETED', payload: comp });
    expect(s2.screen).toBe('RESULT');
    expect(s2.completionData?.points_awarded).toBe(15);
  });

  it('transitions to MY_PROGRESS on VIEW_MY_PROGRESS', () => {
    const progress: KioskStudentProgress = {
      student_id: 'student-1',
      display_handle: 'Liam',
      monthly_points: 60,
      qualifying_sessions: 5,
      badges: [
        { achievement_id: 'b-1', name: 'Soap Star', description: 'Washed 5 times', awarded_at: '2026-10-01' },
      ],
    };
    const s1 = { ...initialKioskState, screen: 'RESULT' as const };
    const s2 = kioskReducer(s1, { type: 'VIEW_MY_PROGRESS', payload: progress });
    expect(s2.screen).toBe('MY_PROGRESS');
    expect(s2.progressData?.monthly_points).toBe(60);
    expect(s2.progressData?.badges.length).toBe(1);
  });

  it('returns to HOME on DONE_RETURN_HOME', () => {
    const s1 = { ...initialKioskState, screen: 'RESULT' as const, sessionId: 'sess-1' };
    const s2 = kioskReducer(s1, { type: 'DONE_RETURN_HOME' });
    expect(s2.screen).toBe('HOME');
    expect(s2.sessionId).toBeNull();
  });

  it('transitions to ERROR on ERROR_OCCURRED and recovers on RETRY_FROM_ERROR', () => {
    const s1 = kioskReducer(initialKioskState, {
      type: 'ERROR_OCCURRED',
      payload: { message: 'Camera connection lost' },
    });
    expect(s1.screen).toBe('ERROR');
    expect(s1.errorMessage).toBe('Camera connection lost');

    const s2 = kioskReducer(s1, { type: 'RETRY_FROM_ERROR' });
    expect(s2.screen).toBe('HOME');
    expect(s2.errorMessage).toBeNull();
  });

  it('toggles accessibility audio, text size, and language settings', () => {
    const s1 = kioskReducer(initialKioskState, { type: 'TOGGLE_AUDIO' });
    expect(s1.accessibility.audioEnabled).toBe(true);

    const s2 = kioskReducer(s1, { type: 'TOGGLE_TEXT_SIZE' });
    expect(s2.accessibility.textSize).toBe('large');

    const s3 = kioskReducer(s2, { type: 'SET_LANGUAGE', payload: 'es' });
    expect(s3.accessibility.language).toBe('es');
  });
});
