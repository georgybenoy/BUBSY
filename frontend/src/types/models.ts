export interface ClassItem {
  class_id: string;
  name: string;
  grade_level?: string | null;
  academic_year: string;
  is_active: number;
  created_at: string;
  student_count?: number;
  qualifying_washes?: number;
  completion_rate?: number;
  monthly_points?: number;
}

export interface StudentActiveCredential {
  credential_id: string;
  credential_type: 'QR' | 'NFC';
  issued_at: string;
}

export interface StudentItem {
  student_id: string;
  display_name: string;
  class_id: string;
  class_name?: string;
  school_code?: string | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
  monthly_points?: number;
  qualifying_washes?: number;
  active_credential?: StudentActiveCredential | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CSVImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface IssuedCredential {
  credential_id: string;
  student_id: string;
  credential_type: 'QR' | 'NFC';
  raw_token: string;
  issued_at: string;
}
