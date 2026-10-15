import type {
  KioskAccessibilitySettings,
  KioskChildSafeEvent,
  KioskCompleteSessionData,
  KioskConfig,
  KioskIdentifyResult,
  KioskScreenState,
  KioskSessionData,
  KioskStudentProgress,
} from '../../types/kiosk';

export interface KioskState {
  screen: KioskScreenState;
  config: KioskConfig;
  student: KioskIdentifyResult | null;
  isUnassigned: boolean;
  sessionId: string | null;
  sessionData: KioskSessionData | null;
  activeEvent: KioskChildSafeEvent | null;
  completionData: KioskCompleteSessionData | null;
  progressData: KioskStudentProgress | null;
  errorMessage: string | null;
  retryCount: number;
  teacherAssistanceRequired: boolean;
  accessibility: KioskAccessibilitySettings;
  preparationSecondsLeft: number;
  isLoading: boolean;
}

export type KioskAction =
  | { type: 'SET_CONFIG'; payload: KioskConfig }
  | { type: 'START_WASH' }
  | { type: 'IDENTIFY_SUCCESS'; payload: KioskIdentifyResult }
  | {
      type: 'IDENTIFY_FAIL';
      payload: { retryCount: number; teacherAssistanceRequired: boolean; message?: string };
    }
  | { type: 'CHOOSE_UNASSIGNED' }
  | { type: 'CONFIRM_STUDENT' }
  | { type: 'CANCEL_IDENTIFY' }
  | { type: 'START_SESSION_SUCCESS'; payload: KioskSessionData }
  | { type: 'TICK_PREPARATION' }
  | { type: 'PREPARATION_FINISHED' }
  | { type: 'WS_EVENT_RECEIVED'; payload: KioskChildSafeEvent }
  | { type: 'SESSION_COMPLETED'; payload: KioskCompleteSessionData }
  | { type: 'VIEW_MY_PROGRESS'; payload?: KioskStudentProgress }
  | { type: 'SET_PROGRESS_DATA'; payload: KioskStudentProgress }
  | { type: 'DONE_RETURN_HOME' }
  | { type: 'ERROR_OCCURRED'; payload: { message: string } }
  | { type: 'RETRY_FROM_ERROR' }
  | { type: 'TOGGLE_AUDIO' }
  | { type: 'TOGGLE_TEXT_SIZE' }
  | { type: 'SET_LANGUAGE'; payload: 'en' | 'es' }
  | { type: 'SET_LOADING'; payload: boolean };

export const initialKioskState: KioskState = {
  screen: 'HOME',
  config: {
    kiosk_id: 'kiosk-1',
    allow_unassigned_sessions: true,
    nfc_available: false,
    max_id_retries: 3,
    first_name_display_allowed: true,
  },
  student: null,
  isUnassigned: false,
  sessionId: null,
  sessionData: null,
  activeEvent: null,
  completionData: null,
  progressData: null,
  errorMessage: null,
  retryCount: 0,
  teacherAssistanceRequired: false,
  accessibility: {
    audioEnabled: false,
    textSize: 'standard',
    language: 'en',
  },
  preparationSecondsLeft: 5,
  isLoading: false,
};

export function kioskReducer(state: KioskState, action: KioskAction): KioskState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        config: action.payload,
      };

    case 'START_WASH':
      return {
        ...state,
        screen: 'IDENTIFY',
        errorMessage: null,
        retryCount: 0,
        teacherAssistanceRequired: false,
        student: null,
        isUnassigned: false,
        isLoading: false,
      };

    case 'IDENTIFY_SUCCESS':
      return {
        ...state,
        screen: 'CONFIRM',
        student: action.payload,
        isUnassigned: false,
        retryCount: 0,
        teacherAssistanceRequired: false,
        errorMessage: null,
        isLoading: false,
      };

    case 'IDENTIFY_FAIL':
      return {
        ...state,
        retryCount: action.payload.retryCount,
        teacherAssistanceRequired: action.payload.teacherAssistanceRequired,
        errorMessage: action.payload.message || 'We could not scan that card. Let’s try again!',
        isLoading: false,
      };

    case 'CHOOSE_UNASSIGNED':
      return {
        ...state,
        screen: 'PREPARATION',
        student: null,
        isUnassigned: true,
        preparationSecondsLeft: 5,
        errorMessage: null,
        isLoading: false,
      };

    case 'CONFIRM_STUDENT':
      return {
        ...state,
        screen: 'PREPARATION',
        preparationSecondsLeft: 5,
        errorMessage: null,
        isLoading: false,
      };

    case 'CANCEL_IDENTIFY':
      return {
        ...state,
        screen: 'HOME',
        student: null,
        isUnassigned: false,
        retryCount: 0,
        teacherAssistanceRequired: false,
        errorMessage: null,
        isLoading: false,
      };

    case 'START_SESSION_SUCCESS':
      return {
        ...state,
        sessionId: action.payload.session_id,
        sessionData: action.payload,
        isLoading: false,
      };

    case 'TICK_PREPARATION':
      return {
        ...state,
        preparationSecondsLeft: Math.max(0, state.preparationSecondsLeft - 1),
      };

    case 'PREPARATION_FINISHED':
      return {
        ...state,
        screen: 'ACTIVE_WASH',
        activeEvent: {
          session_id: state.sessionId || '',
          step_code: 'STEP_1',
          sequence_index: 1,
          step_number: 1,
          total_steps: 6,
          step_name: 'Palm to Palm',
          prompt_text: 'Rub your palms together!',
          status_hint: 'GREAT_START',
          progress_ratio: 0.0,
          is_verified_step: false,
          is_completed: false,
        },
      };

    case 'WS_EVENT_RECEIVED': {
      const event = action.payload;
      return {
        ...state,
        activeEvent: event,
      };
    }

    case 'SESSION_COMPLETED':
      return {
        ...state,
        screen: 'RESULT',
        completionData: action.payload,
        isLoading: false,
      };

    case 'VIEW_MY_PROGRESS':
      return {
        ...state,
        screen: 'MY_PROGRESS',
        progressData: action.payload || state.progressData,
        isLoading: false,
      };

    case 'SET_PROGRESS_DATA':
      return {
        ...state,
        progressData: action.payload,
      };

    case 'DONE_RETURN_HOME':
      return {
        ...initialKioskState,
        config: state.config,
        accessibility: state.accessibility,
      };

    case 'ERROR_OCCURRED':
      return {
        ...state,
        screen: 'ERROR',
        errorMessage: action.payload.message,
        isLoading: false,
      };

    case 'RETRY_FROM_ERROR':
      return {
        ...state,
        screen: 'HOME',
        errorMessage: null,
        isLoading: false,
      };

    case 'TOGGLE_AUDIO':
      return {
        ...state,
        accessibility: {
          ...state.accessibility,
          audioEnabled: !state.accessibility.audioEnabled,
        },
      };

    case 'TOGGLE_TEXT_SIZE':
      return {
        ...state,
        accessibility: {
          ...state.accessibility,
          textSize: state.accessibility.textSize === 'standard' ? 'large' : 'standard',
        },
      };

    case 'SET_LANGUAGE':
      return {
        ...state,
        accessibility: {
          ...state.accessibility,
          language: action.payload,
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}
