export type SeatLabel = string;            // 예: "A2"
export type Assignment = Record<SeatLabel, string>; // 좌석 → 학생 이름

export function parseSeat(label: SeatLabel): { col: number; row: number } {
  const col = label.charCodeAt(0) - 65; // 'A' -> 0
  const row = parseInt(label.slice(1), 10);
  return { col, row };
}

export function areAdjacent(a: SeatLabel, b: SeatLabel): boolean {
  if (a === b) return false;
  const pa = parseSeat(a);
  const pb = parseSeat(b);
  if (pa.col === pb.col && Math.abs(pa.row - pb.row) === 1) return true; // 앞뒤
  if (pa.row === pb.row && Math.abs(pa.col - pb.col) === 1) return true; // 좌우
  return false;
}

export function buildSeatOrder(cols: string[], rows: number, active: Set<string>): SeatLabel[] {
  const order: SeatLabel[] = [];
  for (const c of cols) {
    for (let r = 1; r <= rows; r++) {
      const l = c + r;
      if (active.has(l)) order.push(l);
    }
  }
  return order;
}

export function isHistoryOK(args: {
  assignment: Assignment;
  seatHistory: Record<string, SeatLabel[]>;
  maleOnlySeats: Set<SeatLabel>;
  pinnedSeats: Set<SeatLabel>;
  ruleMaleExempt: boolean;
}): boolean {
  const { assignment, seatHistory, maleOnlySeats, pinnedSeats, ruleMaleExempt } = args;
  for (const seat of Object.keys(assignment)) {
    if (pinnedSeats.has(seat)) continue;
    if (ruleMaleExempt && maleOnlySeats.has(seat)) continue;
    const student = assignment[seat];
    if ((seatHistory[student] || []).includes(seat)) return false;
  }
  return true;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function computePastPairs(
  partnerGroups: SeatLabel[][],
  periods: string[],
  seatHistory: Record<string, SeatLabel[]>,
  ruleWindow: number
): Set<string> {
  const recent = Math.max(0, periods.length - ruleWindow);
  const pastPairs = new Set<string>();
  const students = Object.keys(seatHistory);
  for (let i = recent; i < periods.length; i++) {
    for (const group of partnerGroups) {
      const names = group
        .map((seat) => students.find((st) => seatHistory[st][i] === seat))
        .filter(Boolean) as string[];
      for (let a = 0; a < names.length; a++) {
        for (let b = a + 1; b < names.length; b++) {
          pastPairs.add(pairKey(names[a], names[b]));
        }
      }
    }
  }
  return pastPairs;
}

export function partnerPairsOK(
  assignment: Assignment,
  partnerGroups: SeatLabel[][],
  pastPairs: Set<string>,
  pinnedStudents: Set<string>
): boolean {
  for (const group of partnerGroups) {
    const names = group.map((seat) => assignment[seat]).filter(Boolean) as string[];
    for (let a = 0; a < names.length; a++) {
      for (let b = a + 1; b < names.length; b++) {
        if (pinnedStudents.has(names[a]) || pinnedStudents.has(names[b])) continue;
        if (pastPairs.has(pairKey(names[a], names[b]))) return false;
      }
    }
  }
  return true;
}

export function isValidPartnerAssignment(args: {
  assignment: Assignment;
  partnerGroups: SeatLabel[][];
  periods: string[];
  seatHistory: Record<string, SeatLabel[]>;
  ruleWindow: number;
  pinnedStudents: Set<string>;
}): boolean {
  const { assignment, partnerGroups, periods, seatHistory, ruleWindow, pinnedStudents } = args;
  const pastPairs = computePastPairs(partnerGroups, periods, seatHistory, ruleWindow);
  return partnerPairsOK(assignment, partnerGroups, pastPairs, pinnedStudents);
}

export function violatesSeparation(assignment: Assignment, separationGroups: string[][]): boolean {
  const seatOf: Record<string, SeatLabel> = {};
  for (const seat of Object.keys(assignment)) seatOf[assignment[seat]] = seat;
  for (const group of separationGroups) {
    const seats = group.map((name) => seatOf[name]).filter(Boolean) as SeatLabel[];
    for (let a = 0; a < seats.length; a++) {
      for (let b = a + 1; b < seats.length; b++) {
        if (areAdjacent(seats[a], seats[b])) return true;
      }
    }
  }
  return false;
}
