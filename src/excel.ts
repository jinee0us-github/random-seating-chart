// 엑셀(.xlsx) 입출력 — SheetJS 기반
import * as XLSX from 'xlsx';

export type Gender = 'male' | 'female';

export interface RosterResult {
  males: string[];
  females: string[];
  unknown: string[];
}

export interface HistoryExport {
  periods: string[];
  seatOrder: string[];
  seatHistory: Record<string, string[]>;
}

export interface ParsedHistory {
  columns: string[];
  maxRows: number;
  activeSeats: string[];
  seatOrder: string[];
  periods: string[];
  seatHistory: Record<string, string[]>;
}

export function classifyGender(v: unknown): Gender | null {
  const t = (v ?? '').toString().trim().toLowerCase();
  if (['남', '남자', '남학생', 'm', 'male', 'boy', '1'].includes(t)) return 'male';
  if (['여', '여자', '여학생', 'f', 'female', 'girl', '2'].includes(t)) return 'female';
  return null;
}

function firstSheetRows(buf: ArrayBuffer): string[][] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as unknown[][];
  return rows.map((r) => r.map((c) => (c ?? '').toString()));
}

function writeAoa(aoa: (string | number)[][], sheetName: string, filename: string): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** 명단 엑셀(.xlsx) 읽기 — '이름','성별' 두 열(머리글 없으면 1·2열로 가정) */
export async function readRosterXlsx(file: File): Promise<RosterResult> {
  const rows = firstSheetRows(await file.arrayBuffer());
  let nameIdx = 0;
  let genderIdx = 1;
  let start = 0;
  if (rows.length) {
    const h = rows[0].map((c) => c.trim());
    const ni = h.findIndex((c) => c.includes('이름') || c.toLowerCase() === 'name');
    const gi = h.findIndex((c) => c.includes('성별') || ['gender', 'sex'].includes(c.toLowerCase()));
    if (ni !== -1 && gi !== -1) {
      nameIdx = ni;
      genderIdx = gi;
      start = 1;
    }
  }
  const males: string[] = [];
  const females: string[] = [];
  const unknown: string[] = [];
  for (let i = start; i < rows.length; i++) {
    const name = (rows[i][nameIdx] || '').trim();
    if (!name) continue;
    const g = classifyGender(rows[i][genderIdx]);
    if (g === 'male') males.push(name);
    else if (g === 'female') females.push(name);
    else unknown.push(name);
  }
  return { males, females, unknown };
}

/** 빈 명단 양식(.xlsx) 다운로드 */
export function downloadRosterTemplate(): void {
  const aoa: string[][] = [
    ['이름', '성별'],
    ['김민준', '남'],
    ['이준호', '남'],
    ['이서연', '여'],
    ['김지우', '여']
  ];
  writeAoa(aoa, '명단', '명단양식.xlsx');
}

/** 히스토리(회차별 배치) 엑셀(.xlsx) 내보내기 */
export function exportHistoryXlsx(data: HistoryExport): void {
  const { periods, seatOrder, seatHistory } = data;
  const aoa: string[][] = [['회차', ...seatOrder]];
  for (let i = 0; i < periods.length; i++) {
    const row = [periods[i]];
    for (const seat of seatOrder) {
      const student = Object.keys(seatHistory).find((s) => seatHistory[s][i] === seat) || '';
      row.push(student);
    }
    aoa.push(row);
  }
  writeAoa(aoa, '히스토리', 'seatHistory.xlsx');
}

/** 히스토리 엑셀(.xlsx) 읽기 — 좌석 구조와 회차 기록 복원 */
export async function readHistoryXlsx(file: File): Promise<ParsedHistory> {
  const rows = firstSheetRows(await file.arrayBuffer());
  if (rows.length < 2) throw new Error('빈 파일이거나 형식이 올바르지 않습니다.');
  const header = rows[0].map((c) => c.trim());
  if (header[0] !== '회차') throw new Error("형식이 올바르지 않습니다. 첫 열은 '회차'여야 합니다.");

  const importedSeats = header.slice(1).filter(Boolean);
  const colSet = new Set<string>();
  const rowSet = new Set<number>();
  importedSeats.forEach((s) => {
    const m = s.match(/^([A-Z]+)(\d+)$/);
    if (m) {
      colSet.add(m[1]);
      rowSet.add(parseInt(m[2], 10));
    }
  });
  const columns = [...colSet].sort();
  const maxRows = Math.max(...rowSet, 1);

  const periods: string[] = [];
  const seatHistory: Record<string, string[]> = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.length || !row[0]) continue;
    periods.push(row[0].trim());
    for (let j = 0; j < importedSeats.length; j++) {
      const student = (row[j + 1] || '').trim();
      if (student) (seatHistory[student] ||= []).push(importedSeats[j]);
    }
  }
  return { columns, maxRows, activeSeats: importedSeats.slice(), seatOrder: importedSeats.slice(), periods, seatHistory };
}
