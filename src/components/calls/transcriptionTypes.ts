export const TRANSCRIBE_URL   = 'https://functions.poehali.dev/1cc0b8dc-c71b-4292-815d-cdae4f93cea8';
export const ANALYZE_URL      = 'https://functions.poehali.dev/6f70becf-3fb4-43a7-98a5-747436055b2d';
export const BATCH_STATUS_URL = 'https://functions.poehali.dev/f43c5cc1-1b9b-41aa-ac2a-416878c7f5b9?action=status';

export type JobStatus = 'idle' | 'transcribing' | 'analyzing' | 'done' | 'error';

export interface Replica {
  speaker: 'operator' | 'client';
  speaker_label: string;
  text: string;
  start_time: number;
  segment?: 'ivr' | 'live';
}

export interface Analysis {
  call_type: string;
  call_type_label: string;
  qualification: boolean;
  qualification_label: string;
  client_interest: 'high' | 'medium' | 'low';
  client_interest_label: string;
  outcome: 'success' | 'failure' | 'pending';
  outcome_label: string;
  fail_reason: string | null;
  success_factor: string | null;
  operator_score: number;
  operator_followed_script: boolean;
  operator_handled_objections: boolean;
  operator_comment: string;
  summary: string;
  key_phrases_client: string[];
  key_phrases_operator: string[];
}

export interface TranscriptResult {
  comm_id: string;
  full_text: string;
  replicas: Replica[];
  replica_count: number;
  operator_replicas: number;
  client_replicas: number;
  analysis?: Analysis;
  status: JobStatus;
  error?: string;
  cached?: boolean;
  has_ivr?: boolean;
  ivr_end_idx?: number;
}

export const interestColor: Record<string, string> = {
  high: 'var(--brand-green)',
  medium: '#ff8c00',
  low: '#ff4444',
};

export const outcomeColor: Record<string, string> = {
  success: 'var(--brand-green)',
  failure: '#ff4444',
  pending: '#ff8c00',
};

export const scoreColor = (s: number) =>
  s >= 8 ? 'var(--brand-green)' : s >= 6 ? '#ff8c00' : '#ff4444';