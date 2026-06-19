export interface AiStats {
  total: number;
  empty: boolean;
  target_count: number;
  target_rate: number;
  qualified_count: number;
  qualification_rate: number;
  success_count: number;
  conversion_rate: number;
  avg_operator_score: number;
  script_rate: number;
  objection_rate: number;
  call_types: Record<string, number>;
  interests: Record<string, number>;
  outcomes: Record<string, number>;
  score_distribution: { score: number; count: number }[];
  top_fail_reasons: { reason: string; count: number }[];
  top_success_factors: { factor: string; count: number }[];
  top_phrases_client: { phrase: string; count: number }[];
  top_phrases_operator: { phrase: string; count: number }[];
  by_date: { date: string; count: number }[];
  quality_by_date: { date: string; avg_score: number; target_rate: number; count: number }[];
  top_best_calls: { comm_id: string; score: number; date: string; summary: string; outcome: string }[];
  top_worst_calls: { comm_id: string; score: number; date: string; summary: string; outcome: string }[];
}

export interface TipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
}
