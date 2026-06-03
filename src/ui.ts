// @ts-nocheck
// UI 헬퍼 (DOM 전용)
export function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 2200);
  }
export function uiConfirm(msg){
    return new Promise(res=>{
      const m=document.getElementById('modal');
      document.getElementById('modalMsg').textContent=msg;
      document.getElementById('modalCancel').style.display='';
      m.classList.add('show');
      const ok=document.getElementById('modalOk'), cc=document.getElementById('modalCancel');
      const done=v=>{ m.classList.remove('show'); ok.onclick=null; cc.onclick=null; res(v); };
      ok.onclick=()=>done(true); cc.onclick=()=>done(false);
    });
  }
export function uiAlert(msg){
    return new Promise(res=>{
      const m=document.getElementById('modal');
      document.getElementById('modalMsg').textContent=msg;
      document.getElementById('modalCancel').style.display='none';
      m.classList.add('show');
      const ok=document.getElementById('modalOk');
      const done=()=>{ m.classList.remove('show'); ok.onclick=null; res(); };
      ok.onclick=done;
    });
  }
export function uiSelect(title, items, current){
    // items: [{value, label}], 선택 시 value(string) 반환, 취소 시 null
    return new Promise(res=>{
      const m=document.getElementById('pickModal');
      document.getElementById('pickTitle').textContent=title;
      const list=document.getElementById('pickList'); list.innerHTML='';
      const cc=document.getElementById('pickCancel');
      const done=v=>{ m.classList.remove('show'); list.innerHTML=''; cc.onclick=null; res(v); };
      items.forEach(it=>{
        const b=document.createElement('button');
        b.className='pick-item'+(it.value===current?' cur':'');
        b.textContent=it.label;
        b.onclick=()=>done(it.value);
        list.appendChild(b);
      });
      cc.onclick=()=>done(null);
      m.classList.add('show');
    });
  }
export function showTab(name){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
    window.scrollTo({top:0, behavior:'smooth'});
  }
export function showLoading(){ document.getElementById('loadingOverlay').classList.add('show'); }
export function hideLoading(){ document.getElementById('loadingOverlay').classList.remove('show'); }

// ===== 테마 (라이트/다크) =====
const THEME_KEY='seatTheme';
export function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const b=document.getElementById('themeToggle'); if(b) b.textContent = (t==='dark' ? '☀️' : '🌙');
}
export function initTheme(){
  let t=null;
  try{ t=localStorage.getItem(THEME_KEY); }catch(e){}
  if(!t){ t=(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; }
  applyTheme(t);
}
export function toggleTheme(){
  const cur=(document.documentElement.getAttribute('data-theme')==='dark') ? 'dark' : 'light';
  const next=(cur==='dark') ? 'light' : 'dark';
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  applyTheme(next);
}
