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

// 학생별 과거 좌석을 O(1) 조회용 Set으로 변환(합성 시 1회 호출 의도).
function buildPastSeatSets(
  seatHistory: Record<string, SeatLabel[]>
): Record<string, Set<SeatLabel>> {
  const sets: Record<string, Set<SeatLabel>> = {};
  for (const student of Object.keys(seatHistory)) {
    sets[student] = new Set(seatHistory[student]);
  }
  return sets;
}

// 히스토리 검사 핵심: 미리 만든 학생별 좌석 Set으로 O(1) 조회.
// pinnedSeats는 좌석 라벨 Set(좌석→학생 맵이 아님).
function isHistoryOKFast(args: {
  assignment: Assignment;
  pastSeatSets: Record<string, Set<SeatLabel>>;
  maleOnlySeats: Set<SeatLabel>;
  pinnedSeats: Set<SeatLabel>;
  ruleMaleExempt: boolean;
}): boolean {
  const { assignment, pastSeatSets, maleOnlySeats, pinnedSeats, ruleMaleExempt } = args;
  for (const seat of Object.keys(assignment)) {
    if (pinnedSeats.has(seat)) continue;
    if (ruleMaleExempt && maleOnlySeats.has(seat)) continue;
    const student = assignment[seat];
    if (pastSeatSets[student]?.has(seat)) return false;
  }
  return true;
}

// pinnedSeats는 좌석 라벨 Set(좌석→학생 맵이 아님).
export function isHistoryOK(args: {
  assignment: Assignment;
  seatHistory: Record<string, SeatLabel[]>;
  maleOnlySeats: Set<SeatLabel>;
  pinnedSeats: Set<SeatLabel>;
  ruleMaleExempt: boolean;
}): boolean {
  const { assignment, seatHistory, maleOnlySeats, pinnedSeats, ruleMaleExempt } = args;
  return isHistoryOKFast({
    assignment,
    pastSeatSets: buildPastSeatSets(seatHistory),
    maleOnlySeats,
    pinnedSeats,
    ruleMaleExempt,
  });
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

// 그룹별 좌석 목록에서 인접한 한 쌍이라도 있으면 true(분리 위반).
function anyGroupSeatsAdjacent(seatGroups: SeatLabel[][]): boolean {
  for (const seats of seatGroups) {
    for (let a = 0; a < seats.length; a++) {
      for (let b = a + 1; b < seats.length; b++) {
        if (areAdjacent(seats[a], seats[b])) return true;
      }
    }
  }
  return false;
}

// 분리 검사 핵심: 분리 멤버 Set으로 assignment를 순방향 순회해
// 해당 멤버의 좌석만 그룹별로 모은 뒤 인접쌍 검사.
function violatesSeparationFast(
  assignment: Assignment,
  separationGroups: string[][],
  separationMembers: Set<string>
): boolean {
  const seatOf: Record<string, SeatLabel> = {};
  for (const seat of Object.keys(assignment)) {
    const student = assignment[seat];
    if (separationMembers.has(student)) seatOf[student] = seat;
  }
  const seatGroups = separationGroups.map(
    (group) => group.map((name) => seatOf[name]).filter(Boolean) as SeatLabel[]
  );
  return anyGroupSeatsAdjacent(seatGroups);
}

export function violatesSeparation(assignment: Assignment, separationGroups: string[][]): boolean {
  const separationMembers = new Set<string>(separationGroups.flat());
  return violatesSeparationFast(assignment, separationGroups, separationMembers);
}

export type Constraint = (assignment: Assignment) => boolean;

export function buildConstraints(args: {
  seatHistory: Record<string, SeatLabel[]>;
  periods: string[];
  maleOnlySeats: Set<SeatLabel>;
  pinnedSeats: Set<SeatLabel>; // 좌석 라벨 Set(좌석→학생 맵이 아님)
  pinnedStudents: Set<string>;
  partnerGroups: SeatLabel[][];
  separationGroups: string[][];
  ruleWindow: number;
  ruleHistoryDup: boolean;
  ruleMaleExempt: boolean;
}): Constraint[] {
  const cs: Constraint[] = [];
  if (args.ruleHistoryDup) {
    // 학생별 과거 좌석 Set을 합성 시점 1회 구성 → 술어는 O(1) 조회.
    const pastSeatSets = buildPastSeatSets(args.seatHistory);
    cs.push((assignment) =>
      isHistoryOKFast({
        assignment,
        pastSeatSets,
        maleOnlySeats: args.maleOnlySeats,
        pinnedSeats: args.pinnedSeats,
        ruleMaleExempt: args.ruleMaleExempt,
      })
    );
  }
  if (args.partnerGroups.length > 0) {
    const pastPairs = computePastPairs(args.partnerGroups, args.periods, args.seatHistory, args.ruleWindow);
    cs.push((assignment) => partnerPairsOK(assignment, args.partnerGroups, pastPairs, args.pinnedStudents));
  }
  if (args.separationGroups.length > 0) {
    // 분리 멤버 Set을 합성 시점 1회 구성 → 술어는 assignment 순방향 순회만.
    const separationMembers = new Set<string>(args.separationGroups.flat());
    cs.push((assignment) => !violatesSeparationFast(assignment, args.separationGroups, separationMembers));
  }
  return cs;
}
