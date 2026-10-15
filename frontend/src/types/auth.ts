export interface TeacherUser {
  teacher_id: string;
  username: string;
  role: 'admin' | 'teacher' | 'operator';
  is_active: number;
  created_at: string;
  last_login_at?: string | null;
}

export interface LoginPayload {
  token: string;
  csrf_token: string;
  teacher: TeacherUser;
}

export interface AuthContextType {
  user: TeacherUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}
