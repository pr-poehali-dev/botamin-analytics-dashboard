export const PER_PAGE = 50;

export const durColor = (sec: number) => {
  if (sec < 30) return '#ff4444';
  if (sec < 60) return '#ff8c00';
  if (sec >= 300) return 'var(--brand-green)';
  return 'var(--text-secondary)';
};

export type DoneMap = Record<string, {
  replica_count: number; operator_replicas: number; client_replicas: number;
  has_ivr?: boolean;
  ai?: {
    outcome?: string; call_type?: string; qualification?: boolean; client_interest?: string;
    operator_score?: number; operator_followed_script?: boolean; operator_handled_objections?: boolean;
  };
}>;

export interface CallsCounts {
  withTranscript: number; noTranscript: number;
  success: number; failure: number; pending: number;
  target: number; non_target: number; no_ai: number;
  scoreHigh: number; scoreMid: number; scoreLow: number; scoreNone: number;
  interestHigh: number; interestMedium: number; interestLow: number;
  qualYes: number; qualNo: number;
  scriptYes: number; scriptNo: number;
  objYes: number; objNo: number;
  ivrYes: number; ivrNo: number;
}
