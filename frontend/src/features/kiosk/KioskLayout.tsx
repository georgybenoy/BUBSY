import React, { useEffect, useReducer, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  kioskReducer,
  initialKioskState,
} from './kioskReducer';
import { HomeScreen } from './screens/HomeScreen';
import { IdentifyScreen } from './screens/IdentifyScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { PreparationScreen } from './screens/PreparationScreen';
import { ActiveWashScreen } from './screens/ActiveWashScreen';
import { ResultScreen } from './screens/ResultScreen';
import { MyProgressScreen } from './screens/MyProgressScreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { useIdleTimeout } from './useIdleTimeout';
import { useKioskWebSocket } from './useKioskWebSocket';
import {
  fetchKioskConfig,
  identifyStudentApi,
  createKioskSessionApi,
  completeKioskSessionApi,
  getKioskStudentProgressApi,
} from '../../services/api';
import { HealthStatus } from '../../components/HealthStatus';
import { setSpeechEnabled, speakInstruction } from '../../services/speech';

export const KioskLayout: React.FC = () => {
  const [state, dispatch] = useReducer(kioskReducer, initialKioskState);

  // Sync speech enabled state
  useEffect(() => {
    setSpeechEnabled(state.accessibility.audioEnabled);
  }, [state.accessibility.audioEnabled]);

  // Load kiosk config on startup
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      const res = await fetchKioskConfig();
      if (res.data && isMounted) {
        dispatch({ type: 'SET_CONFIG', payload: res.data });
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Idle timeout: automatically returns to HOME after 30s on final/idle screens
  const isIdleScreen =
    state.screen === 'RESULT' ||
    state.screen === 'MY_PROGRESS' ||
    state.screen === 'ERROR' ||
    (state.screen === 'IDENTIFY' && state.retryCount === 0);

  const handleIdleTimeout = useCallback(() => {
    dispatch({ type: 'DONE_RETURN_HOME' });
  }, []);

  useIdleTimeout(handleIdleTimeout, 30000, isIdleScreen);

  // Real-time WebSocket connection during ACTIVE_WASH
  const handleWsEvent = useCallback((event: import('../../types/kiosk').KioskChildSafeEvent) => {
    dispatch({ type: 'WS_EVENT_RECEIVED', payload: event });
    if (event.prompt_text) {
      speakInstruction(event.prompt_text);
    }
  }, []);

  useKioskWebSocket({
    sessionId: state.sessionId,
    isActive: state.screen === 'ACTIVE_WASH',
    onEvent: handleWsEvent,
  });

  // Handler: Scan or tap credential
  const handleScanToken = async (token: string, type: 'QR' | 'NFC') => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const res = await identifyStudentApi(type, token);
    if (res.data) {
      dispatch({ type: 'IDENTIFY_SUCCESS', payload: res.data });
      speakInstruction(`Hello ${res.data.first_name || 'friend'}! Ready to wash?`);
    } else {
      const errorMsg = res.error?.message || 'Could not find student card.';
      dispatch({
        type: 'IDENTIFY_FAIL',
        payload: {
          retryCount: state.retryCount + 1,
          teacherAssistanceRequired: state.retryCount + 1 >= state.config.max_id_retries,
          message: errorMsg,
        },
      });
      speakInstruction('Let’s try scanning your card again.');
    }
  };

  // Handler: Teacher assisted identification
  const handleTeacherAssist = async (studentId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    // In kiosk mode, manual identification sets the student directly
    dispatch({
      type: 'IDENTIFY_SUCCESS',
      payload: {
        student_id: studentId,
        display_handle: studentId,
        first_name: studentId,
        retry_count: 0,
        teacher_assistance_required: false,
      },
    });
  };

  // Handler: Confirm student and start session
  const handleConfirmStudent = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const studentId = state.student ? state.student.student_id : null;
    const res = await createKioskSessionApi(studentId, state.isUnassigned);
    if (res.data) {
      dispatch({ type: 'START_SESSION_SUCCESS', payload: res.data });
      dispatch({ type: 'CONFIRM_STUDENT' });
      speakInstruction('First, wet your hands with water, then apply soapy bubbles!');
    } else {
      dispatch({
        type: 'ERROR_OCCURRED',
        payload: { message: res.error?.message || 'Could not start wash session.' },
      });
    }
  };

  // Handler: Choose anonymous / unassigned session
  const handleChooseUnassigned = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const res = await createKioskSessionApi(null, true);
    if (res.data) {
      dispatch({ type: 'START_SESSION_SUCCESS', payload: res.data });
      dispatch({ type: 'CHOOSE_UNASSIGNED' });
      speakInstruction('Wet your hands with water and apply soap!');
    } else {
      dispatch({
        type: 'ERROR_OCCURRED',
        payload: { message: res.error?.message || 'Could not start wash session.' },
      });
    }
  };

  // Handler: Finish preparation
  const handlePreparationFinished = () => {
    dispatch({ type: 'PREPARATION_FINISHED' });
    speakInstruction('Rub your palms together!');
  };

  // Handler: Finalize active session
  const handleFinishSession = async () => {
    if (!state.sessionId) {
      dispatch({ type: 'DONE_RETURN_HOME' });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    const res = await completeKioskSessionApi(state.sessionId);
    if (res.data) {
      dispatch({ type: 'SESSION_COMPLETED', payload: res.data });
      speakInstruction('You did it! Clean hands, happy days!');
    } else {
      dispatch({
        type: 'ERROR_OCCURRED',
        payload: { message: res.error?.message || 'Could not complete session.' },
      });
    }
  };

  // Handler: Load and view private student progress
  const handleViewProgress = async () => {
    if (!state.student?.student_id) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    const res = await getKioskStudentProgressApi(state.student.student_id);
    if (res.data) {
      dispatch({ type: 'VIEW_MY_PROGRESS', payload: res.data });
    } else {
      dispatch({ type: 'VIEW_MY_PROGRESS' });
    }
  };

  const isLargeText = state.accessibility.textSize === 'large';

  return (
    <div
      className="kiosk-root"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-canvas)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-family-kiosk)',
        userSelect: 'none',
      }}
    >
      {/* Minimal Top Brand Bar */}
      <header
        style={{
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '24px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
            }}
          >
            B
          </div>
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: 'var(--color-primary)',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Bubsy
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', margin: 0, fontWeight: 700 }}>
              The AI Handwashing Adventure
            </p>
          </div>
        </div>

        {/* Small subtle teacher link at top corner */}
        <Link
          to="/teacher/login"
          style={{
            fontSize: '13px',
            color: 'var(--color-muted-text)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          aria-label="Teacher Portal Sign In"
        >
          Teacher Portal
        </Link>
      </header>

      {/* Main Kiosk Screen Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        {state.screen === 'HOME' && (
          <HomeScreen
            onStartWash={() => dispatch({ type: 'START_WASH' })}
            accessibility={state.accessibility}
            onToggleAudio={() => dispatch({ type: 'TOGGLE_AUDIO' })}
            onToggleTextSize={() => dispatch({ type: 'TOGGLE_TEXT_SIZE' })}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'IDENTIFY' && (
          <IdentifyScreen
            config={state.config}
            retryCount={state.retryCount}
            teacherAssistanceRequired={state.teacherAssistanceRequired}
            errorMessage={state.errorMessage}
            isLoading={state.isLoading}
            onScanToken={handleScanToken}
            onChooseUnassigned={handleChooseUnassigned}
            onCancel={() => dispatch({ type: 'CANCEL_IDENTIFY' })}
            onTeacherAssist={handleTeacherAssist}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'CONFIRM' && (
          <ConfirmScreen
            student={state.student}
            config={state.config}
            onConfirm={handleConfirmStudent}
            onCancel={() => dispatch({ type: 'CANCEL_IDENTIFY' })}
            isLoading={state.isLoading}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'PREPARATION' && (
          <PreparationScreen
            onPreparationFinished={handlePreparationFinished}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'ACTIVE_WASH' && (
          <ActiveWashScreen
            activeEvent={state.activeEvent}
            onFinishSession={handleFinishSession}
            isLoading={state.isLoading}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'RESULT' && (
          <ResultScreen
            completionData={state.completionData}
            isUnassigned={state.isUnassigned}
            onDone={() => dispatch({ type: 'DONE_RETURN_HOME' })}
            onViewProgress={handleViewProgress}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'MY_PROGRESS' && (
          <MyProgressScreen
            progressData={state.progressData}
            onBackToHome={() => dispatch({ type: 'DONE_RETURN_HOME' })}
            isLargeText={isLargeText}
          />
        )}

        {state.screen === 'ERROR' && (
          <ErrorScreen
            errorMessage={state.errorMessage}
            onRetry={() => dispatch({ type: 'RETRY_FROM_ERROR' })}
            onHome={() => dispatch({ type: 'DONE_RETURN_HOME' })}
            isLargeText={isLargeText}
          />
        )}
      </main>

      {/* System Health Status Footer */}
      <footer
        style={{
          padding: '8px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <HealthStatus />
      </footer>
    </div>
  );
};

export default KioskLayout;
