// @ts-nocheck
// 진입점: 상태 + 에디터 + 배치 + 렌더 + 저장 + 이벤트 연결
import './styles/main.css';
import { DEFAULTS } from './config';
import { toast, uiConfirm, uiAlert, showTab, showLoading, hideLoading, initTheme, toggleTheme } from './ui';
import { readRosterXlsx, downloadRosterTemplate, exportHistoryXlsx, readHistoryXlsx } from './excel';


  // ===== 기본값 =====
  ;

  // ===== 상태 =====
  let columns = [];
  let maxRows = 5;
  let activeSeats = new Set();
  let maleOnlySeats = new Set();
  let partnerGroups = [];
  let seatOrder = [];
  let maleStudents = [];
  let femaleStudents = [];
  let students = [];
  let seatHistory = {};
  let periods = [];
  let currentAssignment = null;
  let displayedAssignment = null;

  // 에디터 상태
  let editMode = 'seat';
  let editorColumns = [];
  let editorMaxRows = 5;
  let editorActive = new Set();
  let editorMale = new Set();
  let editorPartners = [];
  let partnerSelection = new Set();

  // ===== 유틸 =====
  function colLetter(i){ return String.fromCharCode(65 + i); }
  
  function buildSeatOrder(cols, rows, active){
    const order = [];
    for(const c of cols){ for(let r=1;r<=rows;r++){ const l=c+r; if(active.has(l)) order.push(l);} }
    return order;
  }

  // ===== 초기화 =====
  if(!loadState()){ loadDefaults(true); }
  setDefaultMonth('periodInput');
  attachPaintHandlers();
  wireEvents();
  initTheme();

  function loadDefaults(silent){
    document.getElementById('maleInput').value = DEFAULTS.male.join(',');
    document.getElementById('femaleInput').value = DEFAULTS.female.join(',');
    document.getElementById('colCount').value = DEFAULTS.columns.length;
    document.getElementById('rowCount').value = DEFAULTS.maxRows;
    if(document.getElementById('ruleWindow')){
      document.getElementById('ruleWindow').value = 6;
      document.getElementById('ruleHistoryDup').checked = true;
      document.getElementById('ruleMaleExempt').checked = true;
      document.getElementById('ruleMaxTries').value = 2000000;
    }
    editorColumns = DEFAULTS.columns.slice();
    editorMaxRows = DEFAULTS.maxRows;
    editorActive = new Set();
    for(const c of editorColumns){ for(let i=1;i<=editorMaxRows;i++) editorActive.add(c+i); }
    editorMale = new Set();
    editorPartners = [];
    partnerSelection.clear();
    renderEditor();
    applySettings(true);
    if(!silent) toast('기본값을 불러왔습니다.');
  }

  function setDefaultMonth(id){
    const el = document.getElementById(id); if(!el) return;
    const n = new Date();
    el.value = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  }

  // ===== 탭 전환 =====
  

  // ===== 설정 패널 토글 (구버전 호환) =====
  function toggleSettings(){
    document.getElementById('settingsToggle').classList.toggle('open');
    document.getElementById('settingsCollapse').classList.toggle('open');
  }

  // ===== 에디터 =====
  function setMode(m){
    editMode = m;
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===m));
    document.getElementById('groupBtn').style.display = (m==='partner') ? 'inline-flex' : 'none';
    if(m!=='partner'){ partnerSelection.clear(); }
    renderEditor();
  }

  function stepCol(d){
    const el=document.getElementById('colCount');
    el.value = Math.max(1, Math.min(10, (parseInt(el.value)||1)+d));
    rebuildEditor();
  }
  function stepRow(d){
    const el=document.getElementById('rowCount');
    el.value = Math.max(1, Math.min(12, (parseInt(el.value)||1)+d));
    rebuildEditor();
  }

  function rebuildEditor(){
    const c = Math.max(1, Math.min(10, parseInt(document.getElementById('colCount').value)||1));
    const r = Math.max(1, Math.min(12, parseInt(document.getElementById('rowCount').value)||1));
    editorColumns = Array.from({length:c}, (_,i)=>colLetter(i));
    editorMaxRows = r;
    // 범위 밖 좌석 정리
    const valid = new Set();
    for(const col of editorColumns){ for(let i=1;i<=r;i++) valid.add(col+i); }
    editorActive = new Set([...editorActive].filter(s=>valid.has(s)));
    editorMale = new Set([...editorMale].filter(s=>valid.has(s)));
    editorPartners = editorPartners.map(g=>g.filter(s=>valid.has(s))).filter(g=>g.length>=2);
    partnerSelection = new Set([...partnerSelection].filter(s=>valid.has(s)));
    renderEditor();
  }

  function renderEditor(){
    const grid = document.getElementById('editorGrid');
    grid.style.gridTemplateColumns = `repeat(${editorColumns.length}, 56px)`;
    grid.style.setProperty('--ecols', editorColumns.length);
    grid.classList.toggle('seat-mode', editMode==='seat');
    grid.classList.toggle('drag-mode', editMode==='seat'||editMode==='partner');
    grid.innerHTML = '';
    // 짝꿍 그룹 번호 매핑
    const pgMap = {};
    editorPartners.forEach((g,gi)=>g.forEach(s=>pgMap[s]=gi+1));
    for(let r=1;r<=editorMaxRows;r++){
      for(const col of editorColumns){
        const label = col+r;
        const cell = document.createElement('div');
        cell.className = 'ecell';
        const txt = document.createElement('span'); txt.textContent = label; cell.appendChild(txt);
        const isActive = editorActive.has(label);
        if(!isActive){ cell.classList.add('off'); }
        else if(editorMale.has(label)){ cell.classList.add('male'); }
        if(partnerSelection.has(label)) cell.classList.add('sel');
        if(pgMap[label]){ const tag=document.createElement('span'); tag.className='pg'; tag.textContent='♥'+pgMap[label]; cell.appendChild(tag); }
        const hint=document.createElement('span'); hint.className='hint-tag';
        hint.textContent = isActive ? '비우기' : (editMode==='seat' ? '+ 좌석' : '빈칸');
        cell.appendChild(hint);
        cell.dataset.label = label;
        if(editMode==='male') cell.onclick = ()=>onEditorClick(label);
        grid.appendChild(cell);
      }
    }
    renderPartnerChips();
  }

  // ===== 드래그 칠하기 (좌석↔빈칸) =====
  let isPainting=false, paintValue=null, paintTarget=null;
  function paintSeat(label,cell){ if(paintValue){ editorActive.add(label); } else { editorActive.delete(label); } if(cell) cell.classList.toggle('off', !editorActive.has(label)); }
  function paintPartner(label,cell){ if(!editorActive.has(label)) return; if(paintValue){ partnerSelection.add(label); } else { partnerSelection.delete(label); } if(cell) cell.classList.toggle('sel', partnerSelection.has(label)); }
  function cellUnder(x,y){ const t=document.elementFromPoint(x,y); return t ? t.closest('.ecell') : null; }
  function startPaint(e){
    if(isPainting) return;
    if(editMode!=='seat' && editMode!=='partner') return;
    const cell = e.target.closest('.ecell'); if(!cell) return;
    const label = cell.dataset.label; if(!label) return;
    if(editMode==='partner' && !editorActive.has(label)) return; // 빈칸은 짝꿍 선택 불가
    e.preventDefault();
    isPainting=true; paintTarget=editMode;
    if(editMode==='seat'){ paintValue = !editorActive.has(label); paintSeat(label,cell); }
    else { paintValue = !partnerSelection.has(label); paintPartner(label,cell); }
    document.getElementById('editorGrid').classList.add('painting');
  }
  function movePaint(e){
    if(!isPainting) return;
    const pt = e.touches ? e.touches[0] : e;
    const cell = cellUnder(pt.clientX, pt.clientY); if(!cell) return;
    const label = cell.dataset.label; if(!label) return;
    if(paintTarget==='seat'){ if(editorActive.has(label)===paintValue) return; paintSeat(label,cell); }
    else { if(!editorActive.has(label)) return; if(partnerSelection.has(label)===paintValue) return; paintPartner(label,cell); }
  }
  function endPaint(){
    if(!isPainting) return;
    isPainting=false;
    document.getElementById('editorGrid').classList.remove('painting');
    if(paintTarget==='seat'){
      // 제거된 좌석에 묶인 남전용/짝꿍 정리
      editorMale = new Set([...editorMale].filter(s=>editorActive.has(s)));
      editorPartners = editorPartners.map(g=>g.filter(s=>editorActive.has(s))).filter(g=>g.length>=2);
      partnerSelection = new Set([...partnerSelection].filter(s=>editorActive.has(s)));
    }
    renderEditor();
  }
  function attachPaintHandlers(){
    const grid = document.getElementById('editorGrid');
    grid.addEventListener('pointerdown', startPaint);
    document.addEventListener('pointermove', movePaint);
    document.addEventListener('pointerup', endPaint);
    document.addEventListener('pointercancel', endPaint);
    // 터치 보조 (일부 환경의 pointer 미지원 대비)
    grid.addEventListener('touchstart', startPaint, {passive:false});
    document.addEventListener('touchmove', movePaint, {passive:false});
    document.addEventListener('touchend', endPaint);
  }

  function onEditorClick(label){
    if(editMode==='seat'){
      if(editorActive.has(label)){
        editorActive.delete(label); editorMale.delete(label);
        editorPartners = editorPartners.map(g=>g.filter(s=>s!==label)).filter(g=>g.length>=2);
        partnerSelection.delete(label);
      } else { editorActive.add(label); }
    } else if(editMode==='male'){
      if(!editorActive.has(label)){ toast('먼저 좌석으로 켜주세요.'); return; }
      editorMale.has(label) ? editorMale.delete(label) : editorMale.add(label);
    } else if(editMode==='partner'){
      if(!editorActive.has(label)){ toast('좌석만 묶을 수 있습니다.'); return; }
      partnerSelection.has(label) ? partnerSelection.delete(label) : partnerSelection.add(label);
    }
    renderEditor();
  }

  function fillAllSeats(){
    for(const col of editorColumns){ for(let r=1;r<=editorMaxRows;r++) editorActive.add(col+r); }
    renderEditor();
  }
  function clearAllSeats(){
    editorActive.clear(); editorMale.clear(); editorPartners=[]; partnerSelection.clear();
    renderEditor();
  }

  function createGroupFromSelection(){
    const sel = [...partnerSelection];
    if(sel.length < 2){ toast('짝꿍은 2자리 이상 선택하세요.'); return; }
    // 기존 그룹에서 선택 좌석 제거 후 새 그룹 추가
    editorPartners = editorPartners.map(g=>g.filter(s=>!sel.includes(s))).filter(g=>g.length>=2);
    editorPartners.push(sel);
    partnerSelection.clear();
    renderEditor();
    toast('짝꿍 그룹이 추가되었습니다.');
  }

  function renderPartnerChips(){
    const box = document.getElementById('partnerChips');
    box.innerHTML = '';
    if(editorPartners.length===0){ box.innerHTML = '<span class="hint">아직 짝꿍 그룹이 없습니다.</span>'; return; }
    editorPartners.forEach((g,i)=>{
      const chip = document.createElement('div'); chip.className='chip';
      chip.innerHTML = `<span>♥${i+1} · ${g.join(', ')}</span>`;
      const x = document.createElement('button'); x.textContent='×';
      x.onclick = ()=>{ editorPartners.splice(i,1); renderEditor(); };
      chip.appendChild(x); box.appendChild(chip);
    });
  }

  // ===== 설정 적용 =====
  function isStructureChanged(){
    const eq=(a,b)=>a.length===b.length && a.every((v,i)=>v===b[i]);
    const setEq=(a,b)=>a.size===b.size && [...a].every(x=>b.has(x));
    const pgKey=g=>JSON.stringify(g.map(x=>x.slice().sort()).sort());
    return !(eq(editorColumns,columns) && editorMaxRows===maxRows && setEq(editorActive,activeSeats)
             && setEq(editorMale,maleOnlySeats) && pgKey(editorPartners)===pgKey(partnerGroups));
  }
  async function applySettings(silent){
    const newMale = parseNames(document.getElementById('maleInput').value);
    const newFemale = parseNames(document.getElementById('femaleInput').value);
    const newOrder = buildSeatOrder(editorColumns, editorMaxRows, editorActive);
    const structChanged = isStructureChanged();

    if(!silent){
      if(newMale.length + newFemale.length !== newOrder.length){
        if(!(await uiConfirm(`인원 수(${newMale.length+newFemale.length})와 좌석 수(${newOrder.length})가 다릅니다. 그래도 적용할까요? (배치 시 수가 맞아야 합니다)`))) return;
      }
      if(structChanged && periods.length>0 && !(await uiConfirm('좌석 구조가 바뀌어 저장된 히스토리가 초기화됩니다. 계속할까요?'))) return;
    }

    columns = editorColumns.slice();
    maxRows = editorMaxRows;
    activeSeats = new Set(editorActive);
    maleOnlySeats = new Set(editorMale);
    partnerGroups = editorPartners.map(g=>g.slice());
    seatOrder = newOrder;
    maleStudents = newMale;
    femaleStudents = newFemale;
    students = maleStudents.concat(femaleStudents);

    if(structChanged){ resetSeatHistory(); }
    else { students.forEach(st=>{ if(!seatHistory[st]) seatHistory[st]=[]; }); }
    currentAssignment = null;
    renderSeatGrid(null);
    renderSeatInfo();
    showHistory();
    persist();
    if(!silent) toast(structChanged ? '설정이 적용되었습니다.' : '명단/규칙이 적용되었습니다. (히스토리 유지)');
  }

  function parseNames(v){ return (v||'').split(',').map(s=>s.trim()).filter(Boolean); }

  function resetSeatHistory(){
    seatHistory = {}; periods = [];
    students.forEach(s=>seatHistory[s]=[]);
  }

  // ===== 자동 저장 (localStorage) =====
  const LS_KEY='seatArrangement_v1';
  function persist(){
    try{
      readRules();
      const data={columns,maxRows,activeSeats:[...activeSeats],maleOnlySeats:[...maleOnlySeats],
        partnerGroups,maleStudents,femaleStudents,seatHistory,periods,
        rules:{ruleWindow,ruleHistoryDup,ruleMaleExempt,ruleMaxTries}};
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    }catch(e){}
  }
  function loadState(){
    try{
      const raw=localStorage.getItem(LS_KEY); if(!raw) return false;
      const d=JSON.parse(raw); if(!d||!d.columns) return false;
      columns=d.columns.slice(); maxRows=d.maxRows;
      activeSeats=new Set(d.activeSeats||[]); maleOnlySeats=new Set(d.maleOnlySeats||[]);
      partnerGroups=(d.partnerGroups||[]).map(g=>g.slice());
      seatOrder=buildSeatOrder(columns,maxRows,activeSeats);
      maleStudents=(d.maleStudents||[]).slice(); femaleStudents=(d.femaleStudents||[]).slice();
      students=maleStudents.concat(femaleStudents);
      seatHistory=d.seatHistory||{}; periods=d.periods||[];
      editorColumns=columns.slice(); editorMaxRows=maxRows;
      editorActive=new Set(activeSeats); editorMale=new Set(maleOnlySeats);
      editorPartners=partnerGroups.map(g=>g.slice()); partnerSelection.clear();
      document.getElementById('maleInput').value=maleStudents.join(',');
      document.getElementById('femaleInput').value=femaleStudents.join(',');
      document.getElementById('colCount').value=columns.length;
      document.getElementById('rowCount').value=maxRows;
      const r=d.rules||{};
      if(document.getElementById('ruleWindow')){
        document.getElementById('ruleWindow').value = (r.ruleWindow!=null?r.ruleWindow:6);
        document.getElementById('ruleHistoryDup').checked = r.ruleHistoryDup!==false;
        document.getElementById('ruleMaleExempt').checked = r.ruleMaleExempt!==false;
        document.getElementById('ruleMaxTries').value = (r.ruleMaxTries!=null?r.ruleMaxTries:2000000);
      }
      renderEditor(); renderSeatGrid(null); renderSeatInfo(); showHistory();
      return true;
    }catch(e){ return false; }
  }

  // ===== 규칙 설정 (랜덤 배치에 즉시 반영) =====
  let ruleWindow=6, ruleHistoryDup=true, ruleMaleExempt=true, ruleMaxTries=2000000;
  function readRules(){
    const w=document.getElementById('ruleWindow'); if(w) ruleWindow=Math.max(0, parseInt(w.value)||0);
    const h=document.getElementById('ruleHistoryDup'); if(h) ruleHistoryDup=h.checked;
    const m=document.getElementById('ruleMaleExempt'); if(m) ruleMaleExempt=m.checked;
    const t=document.getElementById('ruleMaxTries'); if(t) ruleMaxTries=Math.max(1000, parseInt(t.value)||2000000);
  }

  // 성별 판별
  function genderOf(name){
    if(maleStudents.includes(name)) return 'male';
    if(femaleStudents.includes(name)) return 'female';
    return null;
  }

  // ===== 좌석 그리드 렌더 =====
  function renderSeatGrid(assignment, animate){
    displayedAssignment=assignment||null;
    const grid = document.getElementById('seatGrid');
    grid.style.gridTemplateColumns = `repeat(${columns.length}, minmax(60px, 110px))`;
    grid.classList.toggle('anim', !!animate);
    grid.innerHTML = '';
    let order = 0;
    for(let r=1;r<=maxRows;r++){
      for(const col of columns){
        const label = col+r;
        const cell = document.createElement('div');
        if(!activeSeats.has(label)){ cell.className='seat empty'; grid.appendChild(cell); continue; }
        cell.className = 'seat';
        if(maleOnlySeats.has(label)) cell.classList.add('male-only');
        const lbl = document.createElement('span'); lbl.className='lbl'; lbl.textContent=label; cell.appendChild(lbl);
        const nm = assignment && assignment[label];
        if(nm){
          const pill=document.createElement('span');
          const g=genderOf(nm);
          pill.className='name-pill '+(g||'');
          pill.innerHTML=(g?`<span class="gm">${g==='male'?'\u25CF':'\u25B2'}</span>`:'')+nm.replace(/</g,'&lt;');
          if(animate) pill.style.animationDelay=(order++*0.025)+'s';
          cell.appendChild(pill);
        }
        grid.appendChild(cell);
      }
    }
  }

  function renderSeatInfo(){
    const info = document.getElementById('seatInfo');
    info.innerHTML =
      `<span>총 좌석 <b>${seatOrder.length}</b>개</span>`+
      `<span><i class="sw" style="background:#ccfbf1;border-color:#5eead4;"></i> ● 남학생 ${maleStudents.length}명</span>`+
      `<span><i class="sw" style="background:#fef3c7;border-color:#fcd34d;"></i> ▲ 여학생 ${femaleStudents.length}명</span>`+
      `<span><i class="sw" style="background:var(--accent-soft);border:1.5px solid #c7cbff;"></i> 남학생 전용 ${maleOnlySeats.size}석</span>`+
      `<span>♥ 짝꿍 ${partnerGroups.length}그룹</span>`;
  }

  // ===== 알고리즘 =====
  function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

  function isHistoryOK(assignment){
    for(const [seat, student] of Object.entries(assignment)){
      if(ruleMaleExempt && maleOnlySeats.has(seat)) continue;
      if((seatHistory[student]||[]).includes(seat)) return false;
    }
    return true;
  }

  function isValidPartnerAssignment(assignment){
    const recent = Math.max(0, periods.length - ruleWindow);
    const pastPairs = new Set();
    for(let i=recent;i<periods.length;i++){
      for(const group of partnerGroups){
        const names = group.map(seat=>Object.keys(seatHistory).find(st=>seatHistory[st][i]===seat)).filter(Boolean);
        for(let a=0;a<names.length;a++) for(let b=a+1;b<names.length;b++) pastPairs.add([names[a],names[b]].sort().join('|'));
      }
    }
    for(const group of partnerGroups){
      const names = group.map(seat=>assignment[seat]).filter(Boolean);
      for(let a=0;a<names.length;a++) for(let b=a+1;b<names.length;b++){
        if(pastPairs.has([names[a],names[b]].sort().join('|'))) return false;
      }
    }
    return true;
  }

  // ===== 이미지로 저장 (canvas, 라이브러리 불필요) =====
  function roundRect(x,px,py,w,h,r){ x.beginPath(); x.moveTo(px+r,py); x.arcTo(px+w,py,px+w,py+h,r); x.arcTo(px+w,py+h,px,py+h,r); x.arcTo(px,py+h,px,py,r); x.arcTo(px,py,px+w,py,r); x.closePath(); }
  function exportImage(){
    const a=displayedAssignment;
    if(!a){ toast('먼저 랜덤 배치를 실행하세요.'); return; }
    const cw=150, ch=92, pad=24, gap=12, headerH=64;
    const W=pad*2+columns.length*cw+(columns.length-1)*gap;
    const H=headerH+pad+maxRows*ch+(maxRows-1)*gap+pad;
    const scale=2;
    const c=document.createElement('canvas'); c.width=W*scale; c.height=H*scale;
    const x=c.getContext('2d'); x.scale(scale,scale);
    x.fillStyle='#ffffff'; x.fillRect(0,0,W,H);
    const title=(document.getElementById('periodInput').value||'자리 배치');
    x.fillStyle='#1f2330'; x.font='bold 22px sans-serif'; x.textBaseline='middle'; x.textAlign='left';
    x.fillText('🎲 랜덤 자리 배치   '+title, pad, headerH/2+6);
    for(let r=0;r<maxRows;r++){
      for(let ci=0;ci<columns.length;ci++){
        const label=columns[ci]+(r+1);
        if(!activeSeats.has(label)) continue;
        const px=pad+ci*(cw+gap), py=headerH+pad+r*(ch+gap);
        let bg='#ffffff', bd='#e8eaf2';
        if(maleOnlySeats.has(label)){ bg='#eef0ff'; bd='#c7cbff'; }
        roundRect(x,px,py,cw,ch,14); x.fillStyle=bg; x.fill(); x.lineWidth=1.5; x.strokeStyle=bd; x.stroke();
        x.fillStyle='#9aa0b4'; x.font='bold 11px sans-serif'; x.textAlign='left'; x.textBaseline='middle';
        x.fillText(label, px+10, py+14);
        const name=a[label]||'';
        if(name){
          const g=genderOf(name);
          const mark = g==='male' ? '● ' : (g==='female' ? '▲ ' : '');
          x.font='bold 16px sans-serif'; x.textAlign='center';
          const tw=x.measureText(mark+name).width;
          const pillW=Math.min(cw-16, tw+24), pillH=30;
          const pillX=px+(cw-pillW)/2, pillY=py+(ch-pillH)/2+6;
          roundRect(x,pillX,pillY,pillW,pillH,15);
          x.fillStyle = g==='male' ? '#ccfbf1' : (g==='female' ? '#fef3c7' : '#eef0ff'); x.fill();
          x.fillStyle = g==='male' ? '#0f766e' : (g==='female' ? '#b45309' : '#3730a3');
          x.textBaseline='middle';
          x.fillText(mark+name, px+cw/2, pillY+pillH/2+1);
        }
      }
    }
    try{
      const url=c.toDataURL('image/png');
      const link=document.createElement('a'); link.href=url; link.download='자리배치_'+title+'.png'; link.click();
      toast('이미지를 저장했어요.');
    }catch(e){ uiAlert('이미지 저장에 실패했어요: '+e.message); }
  }

  // ===== 커스텀 모달 (iOS의 네이티브 대화상자 차단 회피) =====
  
  

  
  

  function assignSeats(){
    if(seatOrder.length===0){ toast('먼저 설정을 적용해 좌석을 만들어주세요.'); return; }
    if(students.length !== seatOrder.length){ uiAlert(`인원 수(${students.length})와 좌석 수(${seatOrder.length})가 일치해야 합니다.`); return; }
    if(maleStudents.length < maleOnlySeats.size){ uiAlert(`남학생 전용 좌석(${maleOnlySeats.size})을 채우기에 남학생 수가 부족합니다.`); return; }

    readRules();
    showLoading();
    setTimeout(()=>{
      const maxTries = ruleMaxTries;
      let found = false, assignment = null;
      for(let t=0;t<maxTries;t++){
        assignment = {};
        const males = shuffle(maleStudents.slice());
        const chosen = males.slice(0, maleOnlySeats.size);
        let idx=0; for(const seat of maleOnlySeats) assignment[seat]=chosen[idx++];
        const rest = seatOrder.filter(s=>!maleOnlySeats.has(s));
        const assigned = new Set(Object.values(assignment));
        const restStudents = students.filter(s=>!assigned.has(s));
        shuffle(restStudents);
        for(let i=0;i<rest.length;i++) assignment[rest[i]]=restStudents[i];
        if(ruleHistoryDup && !isHistoryOK(assignment)) continue;
        if(!isValidPartnerAssignment(assignment)) continue;
        found = true; break;
      }
      hideLoading();
      if(found){ currentAssignment = assignment; renderSeatGrid(assignment, true); toast('배치 완료! 마음에 들면 저장하세요.'); }
      else { uiAlert('조건(짝꿍 및 히스토리)을 만족하는 배치를 찾지 못했습니다. 짝꿍/히스토리 조건을 완화해보세요.'); }
    }, 60);
  }

  // ===== 저장 / 히스토리 =====
  function saveArrangement(){
    if(!currentAssignment){ toast('랜덤 배치를 먼저 실행하세요.'); return; }
    const base = document.getElementById('periodInput').value || '회차';
    const label = nextPeriodLabel(base);
    periods.push(label);
    for(const seat of seatOrder){
      const st = currentAssignment[seat];
      if(!seatHistory[st]) seatHistory[st]=[];
      seatHistory[st].push(seat);
    }
    showHistory(); currentAssignment = null;
    persist();
    toast(`회차 ${label} 저장됨`);
  }

  function nextPeriodLabel(base){
    const same = periods.filter(p=>p===base || p.startsWith(base+'-'));
    return same.length===0 ? base : `${base}-${same.length+1}`;
  }

  function showHistory(){
    const c = document.getElementById('history');
    c.innerHTML = '';
    if(periods.length===0){ c.innerHTML='<div class="empty-state">아직 저장된 배치가 없습니다.</div>'; return; }
    for(let i=0;i<periods.length;i++){
      const block = document.createElement('div'); block.className='history-block'+(i===periods.length-1?' open':'');
      const title = document.createElement('div'); title.className='htitle';
      title.innerHTML = `<span class="badge">회차</span><span>${periods[i]}</span><span class="count">좌석 ${seatOrder.length}석</span><span class="hchev">▼</span>`;
      title.onclick = ()=>block.classList.toggle('open');
      block.appendChild(title);
      const body = document.createElement('div'); body.className='history-body';
      const inner = document.createElement('div'); inner.className='history-body-inner';
      const grid = document.createElement('div'); grid.className='seat-grid';
      grid.style.gridTemplateColumns = `repeat(${columns.length}, minmax(54px, 92px))`;
      for(let r=1;r<=maxRows;r++){
        for(const col of columns){
          const label = col+r;
          const cell = document.createElement('div');
          if(!activeSeats.has(label)){ cell.className='seat empty'; grid.appendChild(cell); continue; }
          cell.className='seat';
          if(maleOnlySeats.has(label)) cell.classList.add('male-only');
          const lbl=document.createElement('span'); lbl.className='lbl'; lbl.textContent=label; cell.appendChild(lbl);
          const st = Object.keys(seatHistory).find(s=>seatHistory[s][i]===label);
          if(st){ const g=genderOf(st); const pill=document.createElement('span'); pill.className='name-pill '+(g||''); pill.innerHTML=(g?`<span class="gm">${g==='male'?'\u25CF':'\u25B2'}</span>`:'')+st.replace(/</g,'&lt;'); cell.appendChild(pill); }
          grid.appendChild(cell);
        }
      }
      inner.appendChild(grid); body.appendChild(inner); block.appendChild(body); c.appendChild(block);
    }
  }

  // ===== 엑셀 입출력 =====
  
  function exportCSV(){
    if(periods.length===0){ toast('내보낼 히스토리가 없습니다.'); return; }
    exportHistoryXlsx({periods, seatOrder, seatHistory});
    toast('엑셀로 내보냈습니다.');
  }

  // ===== 명단 엑셀 불러오기 =====
  
  async function importRoster(event){
    const file=event.target.files[0]; if(!file) return;
    try{
      const {males,females,unknown}=await readRosterXlsx(file);
      if(males.length+females.length===0){ uiAlert('이름/성별을 인식하지 못했습니다.\n성별은 남/여 또는 M/F로 입력해주세요.'); return; }
      document.getElementById('maleInput').value=males.join(',');
      document.getElementById('femaleInput').value=females.join(',');
      event.target.value='';
      let msg=`명단 불러옴: 남 ${males.length} · 여 ${females.length}. '설정 적용'을 눌러주세요.`;
      if(unknown.length) msg+=` (성별 미인식 ${unknown.length}명 제외)`;
      toast(msg);
    }catch(err){ uiAlert('엑셀 읽기 오류: '+((err&&err.message)||err)); }
  }


  async function importCSV(event){
    const file=event.target.files[0]; if(!file) return;
    try{
      const d=await readHistoryXlsx(file);
      columns=d.columns; maxRows=d.maxRows; activeSeats=new Set(d.activeSeats);
      seatOrder=buildSeatOrder(columns, maxRows, activeSeats);
      periods=d.periods; seatHistory=d.seatHistory;
      renderSeatGrid(null); renderSeatInfo(); showHistory(); persist();
      toast(`${periods.length}개 회차를 불러왔습니다.`);
      event.target.value='';
    }catch(err){ uiAlert('엑셀 읽기 오류: '+((err&&err.message)||err)); }
  }

  // ===== 이벤트 연결 (인라인 핸들러 대체) =====
  function wireEvents(){
    const A={assignSeats,saveArrangement,exportImage,applySettings,loadDefaults,
      colPlus:()=>stepCol(1), colMinus:()=>stepCol(-1), rowPlus:()=>stepRow(1), rowMinus:()=>stepRow(-1),
      createGroupFromSelection,fillAllSeats,clearAllSeats,downloadRosterTemplate,exportCSV,toggleTheme,
      print:()=>window.print(),
      pickRoster:()=>document.getElementById('rosterFile').click(),
      pickCsv:()=>document.getElementById('csvFile').click()};
    document.addEventListener('click', e=>{
      const a=e.target.closest('[data-action]'); if(a){ const f=A[a.dataset.action]; if(f){ e.preventDefault(); f(); } return; }
      const tb=e.target.closest('.tab-btn'); if(tb){ showTab(tb.dataset.tab); return; }
      const mb=e.target.closest('.mode-btn'); if(mb){ setMode(mb.dataset.mode); return; }
    });
    const on=(id,ev,fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener(ev,fn); };
    on('colCount','input',rebuildEditor); on('rowCount','input',rebuildEditor);
    ['ruleWindow','ruleHistoryDup','ruleMaleExempt','ruleMaxTries'].forEach(id=>on(id,'change',persist));
    on('csvFile','change',importCSV); on('rosterFile','change',importRoster);
  }
