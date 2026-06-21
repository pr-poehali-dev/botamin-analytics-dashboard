import { useMemo } from 'react';
import { type CallRecord } from '@/lib/dataParser';

export interface AiOverviewStats {
  analyzed: number;
  target: number; nonTarget: number;
  success: number; failure: number; pending: number;
  qualYes: number; qualNo: number;
  scriptYes: number; scriptNo: number;
  objYes: number; objNo: number;
  interestHigh: number; interestMedium: number; interestLow: number;
  avgScore: string | null;
  targetRate: number; convRate: number; qualRate: number;
  scriptRate: number; objRate: number;
  hasPrev: boolean;
  delta: {
    targetRate: number | null; convRate: number | null; qualRate: number | null;
    scriptRate: number | null; objRate: number | null; avgScore: number | null;
  };
}

type Acc = {
  analyzed: number; target: number; nonTarget: number;
  success: number; failure: number; pending: number;
  qualYes: number; qualNo: number; scriptYes: number; scriptNo: number;
  objYes: number; objNo: number;
  interestHigh: number; interestMedium: number; interestLow: number;
  totalScore: number; scoreCount: number;
};

function emptyAcc(): Acc {
  return {
    analyzed: 0, target: 0, nonTarget: 0, success: 0, failure: 0, pending: 0,
    qualYes: 0, qualNo: 0, scriptYes: 0, scriptNo: 0, objYes: 0, objNo: 0,
    interestHigh: 0, interestMedium: 0, interestLow: 0, totalScore: 0, scoreCount: 0,
  };
}

function computeRates(a: Acc) {
  return {
    targetRate:  a.analyzed > 0 ? Math.round(a.target / a.analyzed * 100) : 0,
    convRate:    a.analyzed > 0 ? Math.round(a.success / a.analyzed * 100) : 0,
    qualRate:    a.analyzed > 0 ? Math.round(a.qualYes / a.analyzed * 100) : 0,
    scriptRate:  (a.scriptYes + a.scriptNo) > 0 ? Math.round(a.scriptYes / (a.scriptYes + a.scriptNo) * 100) : 0,
    objRate:     (a.objYes + a.objNo) > 0 ? Math.round(a.objYes / (a.objYes + a.objNo) * 100) : 0,
    avgScore:    a.scoreCount > 0 ? +(a.totalScore / a.scoreCount).toFixed(1) : null,
  };
}

function computeDelta(curVal: number | null, prevVal: number | null): number | null {
  if (curVal == null || prevVal == null || prevVal === 0) return null;
  return Math.round((curVal - prevVal) * 10) / 10;
}

function toIso(d: string): string {
  if (!d) return '';
  if (d.includes('.')) { const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; }
  return d.slice(0, 10);
}

export function useAiStats(calls: CallRecord[]): AiOverviewStats | null {
  return useMemo(() => {
    try {
      const dm = JSON.parse(localStorage.getItem('transcription_done_map') || '{}');

      const dateByCommId: Record<string, string> = {};
      for (const c of calls) dateByCommId[c.comm_id] = toIso(c.date);

      const allDates = Object.entries(dm)
        .filter(([, v]) => (v as { ai?: unknown }).ai)
        .map(([id]) => dateByCommId[id] || '')
        .filter(Boolean)
        .sort();
      const midDate = allDates.length > 1 ? allDates[Math.floor(allDates.length / 2)] : '';

      const cur = emptyAcc(), prev = emptyAcc();

      for (const [id, entry] of Object.entries(dm) as [string, { ai?: Record<string, unknown> }][]) {
        const ai = entry?.ai;
        if (!ai) continue;
        const isoDate = dateByCommId[id] || '';
        const acc = (midDate && isoDate && isoDate < midDate) ? prev : cur;
        acc.analyzed++;
        if (ai.call_type === 'target') acc.target++; else if (ai.call_type === 'non_target') acc.nonTarget++;
        if (ai.outcome === 'success') acc.success++; else if (ai.outcome === 'failure') acc.failure++; else if (ai.outcome === 'pending') acc.pending++;
        if (ai.qualification === true) acc.qualYes++; else if (ai.qualification === false) acc.qualNo++;
        if (ai.operator_followed_script === true) acc.scriptYes++; else if (ai.operator_followed_script === false) acc.scriptNo++;
        if (ai.operator_handled_objections === true) acc.objYes++; else if (ai.operator_handled_objections === false) acc.objNo++;
        if (ai.client_interest === 'high') acc.interestHigh++; else if (ai.client_interest === 'medium') acc.interestMedium++; else if (ai.client_interest === 'low') acc.interestLow++;
        if (typeof ai.operator_score === 'number') { acc.totalScore += ai.operator_score as number; acc.scoreCount++; }
      }

      const c = computeRates(cur), p = computeRates(prev);
      const total = cur.analyzed + prev.analyzed;

      return {
        analyzed: total,
        target: cur.target, nonTarget: cur.nonTarget,
        success: cur.success, failure: cur.failure, pending: cur.pending,
        qualYes: cur.qualYes, qualNo: cur.qualNo,
        scriptYes: cur.scriptYes, scriptNo: cur.scriptNo,
        objYes: cur.objYes, objNo: cur.objNo,
        interestHigh: cur.interestHigh, interestMedium: cur.interestMedium, interestLow: cur.interestLow,
        avgScore: c.avgScore != null ? c.avgScore.toFixed(1) : null,
        targetRate: c.targetRate, convRate: c.convRate, qualRate: c.qualRate,
        scriptRate: c.scriptRate, objRate: c.objRate,
        hasPrev: prev.analyzed > 0,
        delta: {
          targetRate: computeDelta(c.targetRate, p.targetRate),
          convRate:   computeDelta(c.convRate,   p.convRate),
          qualRate:   computeDelta(c.qualRate,   p.qualRate),
          scriptRate: computeDelta(c.scriptRate, p.scriptRate),
          objRate:    computeDelta(c.objRate,    p.objRate),
          avgScore:   computeDelta(c.avgScore,   p.avgScore),
        },
      };
    } catch { return null; }
  }, [calls]);
}
