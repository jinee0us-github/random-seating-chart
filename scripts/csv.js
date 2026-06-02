// CSV 유틸 (순수 함수)
export function escapeCSVCell(v){ const s=(v??'').toString(); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
export function parseCSV(text){
    const out=[]; const rows=text.split(/\r\n|\n|\r/);
    for(const row of rows){
      if(!row.trim()) continue;
      const cells=[]; let cur=''; let q=false;
      for(let i=0;i<row.length;i++){
        const ch=row[i], nx=row[i+1];
        if(ch==='"'){ if(q&&nx==='"'){cur+='"'; i++;} else q=!q; }
        else if(ch===','&&!q){ cells.push(cur); cur=''; }
        else cur+=ch;
      }
      cells.push(cur); out.push(cells);
    }
    return out;
  }
export function classifyGender(v){
    const t=(v||'').toString().trim().toLowerCase();
    if(['남','남자','남학생','m','male','boy','1'].includes(t)) return 'male';
    if(['여','여자','여학생','f','female','girl','2'].includes(t)) return 'female';
    return null;
  }
