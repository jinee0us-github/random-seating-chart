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
