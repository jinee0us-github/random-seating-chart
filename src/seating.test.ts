import { describe, it, expect } from 'vitest';
import {
  parseSeat, areAdjacent, buildSeatOrder, isHistoryOK,
  pairKey, computePastPairs, partnerPairsOK, isValidPartnerAssignment,
  violatesSeparation, buildConstraints,
} from './seating';

describe('parseSeat', () => {
  it('열 문자를 0-기반 인덱스로, 행을 숫자로 변환', () => {
    expect(parseSeat('A1')).toEqual({ col: 0, row: 1 });
    expect(parseSeat('C3')).toEqual({ col: 2, row: 3 });
    expect(parseSeat('D12')).toEqual({ col: 3, row: 12 });
  });
});

describe('areAdjacent', () => {
  it('좌우 이웃(같은 행, 열차 1)은 인접', () => {
    expect(areAdjacent('A2', 'B2')).toBe(true);
    expect(areAdjacent('B2', 'A2')).toBe(true);
  });
  it('앞뒤 이웃(같은 열, 행차 1)은 인접', () => {
    expect(areAdjacent('A2', 'A3')).toBe(true);
  });
  it('대각선은 비인접', () => {
    expect(areAdjacent('A2', 'B3')).toBe(false);
  });
  it('한 칸 건너뛰면(거리 2) 비인접', () => {
    expect(areAdjacent('A2', 'C2')).toBe(false);
    expect(areAdjacent('A1', 'A3')).toBe(false);
  });
  it('같은 좌석은 비인접', () => {
    expect(areAdjacent('A2', 'A2')).toBe(false);
  });
});

describe('buildSeatOrder', () => {
  it('활성 좌석만 열→행 순서로 반환', () => {
    const active = new Set(['A1', 'A2', 'B1', 'B2']);
    expect(buildSeatOrder(['A', 'B'], 2, active)).toEqual(['A1', 'A2', 'B1', 'B2']);
  });
  it('비활성 좌석은 제외', () => {
    const active = new Set(['A1', 'B2']);
    expect(buildSeatOrder(['A', 'B'], 2, active)).toEqual(['A1', 'B2']);
  });
});

describe('isHistoryOK', () => {
  const base = {
    maleOnlySeats: new Set<string>(),
    pinnedSeats: new Set<string>(),
    ruleMaleExempt: true,
  };
  it('이전에 앉은 자리에 다시 배정되면 false', () => {
    expect(isHistoryOK({
      ...base,
      assignment: { A1: '철수' },
      seatHistory: { 철수: ['A1'] },
    })).toBe(false);
  });
  it('이전 자리와 겹치지 않으면 true', () => {
    expect(isHistoryOK({
      ...base,
      assignment: { A2: '철수' },
      seatHistory: { 철수: ['A1'] },
    })).toBe(true);
  });
  it('남전용석은 ruleMaleExempt면 중복 허용', () => {
    expect(isHistoryOK({
      ...base,
      maleOnlySeats: new Set(['A1']),
      assignment: { A1: '철수' },
      seatHistory: { 철수: ['A1'] },
    })).toBe(true);
  });
  it('고정석(pinnedSeats)은 항상 중복 허용', () => {
    expect(isHistoryOK({
      ...base,
      pinnedSeats: new Set(['A1']),
      assignment: { A1: '철수' },
      seatHistory: { 철수: ['A1'] },
    })).toBe(true);
  });
});

describe('짝꿍 검증', () => {
  it('pairKey는 정렬된 키를 반환', () => {
    expect(pairKey('나', '가')).toBe('가|나');
    expect(pairKey('가', '나')).toBe('가|나');
  });

  it('computePastPairs는 window 내 같은 그룹의 짝을 수집', () => {
    // 0회차: A1=가, A2=나 (같은 짝꿍 그룹 [A1,A2])
    const seatHistory = { 가: ['A1'], 나: ['A2'] };
    const pp = computePastPairs([['A1', 'A2']], ['1회'], seatHistory, 6);
    expect(pp.has('가|나')).toBe(true);
  });

  it('partnerPairsOK는 과거 짝이 다시 묶이면 false', () => {
    const pastPairs = new Set(['가|나']);
    const ok = partnerPairsOK({ A1: '가', A2: '나' }, [['A1', 'A2']], pastPairs, new Set());
    expect(ok).toBe(false);
  });

  it('고정 학생이 낀 짝은 예외(true)', () => {
    const pastPairs = new Set(['가|나']);
    const ok = partnerPairsOK({ A1: '가', A2: '나' }, [['A1', 'A2']], pastPairs, new Set(['가']));
    expect(ok).toBe(true);
  });

  it('isValidPartnerAssignment: window=0이면 항상 true', () => {
    const seatHistory = { 가: ['A1'], 나: ['A2'] };
    const ok = isValidPartnerAssignment({
      assignment: { A1: '가', A2: '나' },
      partnerGroups: [['A1', 'A2']],
      periods: ['1회'],
      seatHistory,
      ruleWindow: 0,
      pinnedStudents: new Set(),
    });
    expect(ok).toBe(true);
  });
});

describe('violatesSeparation', () => {
  it('분리 그룹 두 명이 좌우 인접이면 위반(true)', () => {
    expect(violatesSeparation({ A1: '가', B1: '나' }, [['가', '나']])).toBe(true);
  });
  it('분리 그룹 두 명이 앞뒤 인접이면 위반(true)', () => {
    expect(violatesSeparation({ A1: '가', A2: '나' }, [['가', '나']])).toBe(true);
  });
  it('떨어져 있으면 통과(false)', () => {
    expect(violatesSeparation({ A1: '가', C1: '나' }, [['가', '나']])).toBe(false);
  });
  it('3인 그룹 중 한 쌍이라도 인접하면 위반', () => {
    expect(violatesSeparation({ A1: '가', B1: '나', D1: '다' }, [['가', '나', '다']])).toBe(true);
  });
  it('그룹 멤버가 배치에 없으면 무시', () => {
    expect(violatesSeparation({ A1: '가' }, [['가', '나']])).toBe(false);
  });
});

describe('buildConstraints', () => {
  const baseArgs = {
    seatHistory: {} as Record<string, string[]>,
    periods: [] as string[],
    maleOnlySeats: new Set<string>(),
    pinnedSeats: new Set<string>(),
    pinnedStudents: new Set<string>(),
    partnerGroups: [] as string[][],
    separationGroups: [] as string[][],
    ruleWindow: 6,
    ruleHistoryDup: true,
    ruleMaleExempt: true,
  };

  it('ruleHistoryDup=false면 히스토리 술어 제외', () => {
    const withHist = buildConstraints({ ...baseArgs, seatHistory: { 가: ['A1'] }, ruleHistoryDup: true });
    const noHist = buildConstraints({ ...baseArgs, seatHistory: { 가: ['A1'] }, ruleHistoryDup: false });
    expect(withHist.length).toBe(1);
    expect(noHist.length).toBe(0);
  });

  it('짝꿍/분리 그룹이 있을 때만 해당 술어 포함', () => {
    const cs = buildConstraints({
      ...baseArgs,
      ruleHistoryDup: false,
      partnerGroups: [['A1', 'A2']],
      separationGroups: [['가', '나']],
    });
    expect(cs.length).toBe(2);
  });

  it('합성된 술어가 분리 위반 배치를 false 처리', () => {
    const cs = buildConstraints({
      ...baseArgs,
      ruleHistoryDup: false,
      separationGroups: [['가', '나']],
    });
    const adjacent = { A1: '가', B1: '나' };
    const apart = { A1: '가', C1: '나' };
    expect(cs.every((c) => c(adjacent))).toBe(false);
    expect(cs.every((c) => c(apart))).toBe(true);
  });

  it('합성된 술어가 같은 자리 재배정을 false 처리(히스토리 행위 검증)', () => {
    const cs = buildConstraints({
      ...baseArgs,
      ruleHistoryDup: true,
      seatHistory: { 가: ['A1'] },
    });
    const repeat = { A1: '가' };
    const moved = { A2: '가' };
    expect(cs.every((c) => c(repeat))).toBe(false);
    expect(cs.every((c) => c(moved))).toBe(true);
  });
});
