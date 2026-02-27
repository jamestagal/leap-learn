// TypeScript interfaces for the Consultation Domain
// Generated from Go backend service layer

export type ConsultationStatus = 'draft' | 'completed' | 'archived';
export type UrgencyLevel = 'low' | 'medium' | 'high';

// Core consultation interfaces
export interface ContactInfo {
  business_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  website?: string;
}

export interface BusinessContext {
  industry: string;
  business_type: string;
  team_size?: number;
  current_platform?: string;
  digital_presence?: string[];
  marketing_channels?: string[];
}

export interface PainPoints {
  primary_challenges: string[];
  technical_issues?: string[];
  urgency_level?: UrgencyLevel;
  impact_assessment?: string;
  current_solution_gaps?: string[];
}

export interface GoalsObjectives {
  primary_goals: string[];
  secondary_goals?: string[];
  success_metrics?: string[];
  kpis?: string[];
  budget_range?: string;
  budget_constraints?: string[];
}

export interface Consultation {
  id: string;
  user_id: string;
  contact_info?: ContactInfo;
  business_context?: BusinessContext;
  pain_points?: PainPoints;
  goals_objectives?: GoalsObjectives;
  status: ConsultationStatus;
  completion_percentage?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ConsultationSummary {
  id: string;
  user_id: string;
  business_name?: string;
  status: ConsultationStatus;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ConsultationDraft {
  consultation_id: string;
  user_id: string;
  draft_data: Record<string, any>;
  last_saved: string;
  conflict_detected: boolean;
}

export interface ConsultationVersion {
  id: string;
  consultation_id: string;
  version_number: number;
  change_summary: string;
  changed_fields: string[];
  snapshot_data: Record<string, any>;
  created_at: string;
}

export interface ConsultationProgress {
  consultation_id: string;
  completion_percentage: number;
  completed_sections: Record<string, boolean>;
  last_updated: string;
}

export interface ConsultationStats {
  user_id: string;
  total_count: number;
  draft_count: number;
  completed_count: number;
  archived_count: number;
  completion_rate: number;
}

// Request/Response interfaces
export interface CreateConsultationRequest {
  contact_info?: ContactInfo;
  business_context?: BusinessContext;
  pain_points?: PainPoints;
  goals_objectives?: GoalsObjectives;
  status?: ConsultationStatus;
}

export interface UpdateConsultationRequest {
  contact_info?: ContactInfo;
  business_context?: BusinessContext;
  pain_points?: PainPoints;
  goals_objectives?: GoalsObjectives;
  status?: ConsultationStatus;
}

export interface ConsultationsResponse {
  consultations: ConsultationSummary[];
  count: number;
  page?: number;
  limit?: number;
  has_more?: boolean;
}

export interface ConsultationVersionsResponse {
  versions: ConsultationVersion[];
  consultation_id: string;
  page?: number;
  limit?: number;
  has_more?: boolean;
}

// API parameter interfaces
export interface ListConsultationsParams {
  page?: number;
  limit?: number;
  status?: ConsultationStatus;
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'completion_percentage';
  sort_order?: 'asc' | 'desc';
}

export interface GetVersionHistoryParams {
  consultation_id: string;
  page?: number;
  limit?: number;
}

// Draft management interfaces
export interface AutoSaveDraftRequest {
  consultation_id: string;
  draft_data: Record<string, any>;
}

export interface DraftSummary {
  consultation_id: string;
  business_name?: string;
  last_saved: string;
  has_changes: boolean;
}

// Validation interfaces
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, any>;
  };
}