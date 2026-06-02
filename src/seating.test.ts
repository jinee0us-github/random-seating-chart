import { describe, it, expect } from 'vitest';
import { parseSeat, areAdjacent, buildSeatOrder } from './seating';

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
