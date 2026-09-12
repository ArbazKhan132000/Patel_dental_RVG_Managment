/* ═══════════════════════════════════════════
   Patel Dental Clinic — RVG Manager
   Application Logic (Complete Rebuild)
   ═══════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ── State ──
const S = {
  step: 1,
  file: null,
  dataUrl: null,
  name: '',
  tooth: '',
  db: null,
  listening: false,
  recog: null,
};

/* ════════════════ SUPABASE ════════════════ */
function cfgGet() {
  return { url: localStorage.getItem('sb_url') || '', key: localStorage.getItem('sb_key') || '' };
}

function sbInit() {
  const c = cfgGet();
  if (c.url && c.key) {
    try { S.db = supabase.createClient(c.url, c.key); return true; }
    catch(e) { S.db = null; return false; }
  }
  return false;
}

// Settings modal
$('#btn-settings').onclick = () => {
  const c = cfgGet();
  $('#cfg-url').value = c.url;
  $('#cfg-key').value = c.key;
  $('#modal').style.display = '';
};
$('#cfg-cancel').onclick = () => $('#modal').style.display = 'none';
$('#cfg-save').onclick = () => {
  const u = $('#cfg-url').value.trim(), k = $('#cfg-key').value.trim();
  if (!u || !k) return toast('Enter both fields', 'err');
  localStorage.setItem('sb_url', u);
  localStorage.setItem('sb_key', k);
  if (sbInit()) { toast('Connected!', 'ok'); $('#modal').style.display = 'none'; updateStats(); }
  else toast('Connection failed', 'err');
};

/* ════════════════ TOAST ════════════════ */
function toast(msg, type = 'info') {
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.textContent = msg;
  $('#toasts').appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

/* ════════════════ LOADING ════════════════ */
function showLoad(t = 'Saving…') { $('#load-text').textContent = t; $('#loading').style.display = ''; }
function hideLoad() { $('#loading').style.display = 'none'; }

/* ════════════════ NAV TABS ════════════════ */
$$('.nav-pill').forEach(p => p.onclick = () => {
  $$('.nav-pill').forEach(x => x.classList.remove('active'));
  p.classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${p.dataset.view}`).classList.add('active');
  if (p.dataset.view === 'search') loadRecent();
});

/* ════════════════ STEP NAV ════════════════ */
function goStep(n) {
  $$('.step').forEach(s => { s.classList.remove('active'); s.style.display = ''; });
  const el = $(`#s${n}`);
  if (el) { el.style.display = 'block'; void el.offsetHeight; el.classList.add('active'); }

  $$('.prog-step').forEach(p => {
    const sn = +p.dataset.s;
    p.classList.remove('active', 'done');
    if (sn === n) p.classList.add('active');
    else if (sn < n) p.classList.add('done');
  });
  $$('.prog-line').forEach(l => {
    const ln = +l.dataset.l;
    l.classList.remove('done', 'active');
    if (ln < n) l.classList.add('done');
    else if (ln === n - 1) l.classList.add('active');
  });
  S.step = n;
  if (n === 4) fillConfirm();
}

/* ════════════════ STEP 1: UPLOAD ════════════════ */
const dropZone = $('#drop-zone');
const fileInput = $('#file-input');

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('over'); };
dropZone.ondragleave = () => dropZone.classList.remove('over');
dropZone.ondrop = e => {
  e.preventDefault(); dropZone.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) handleFile(f);
  else toast('Please drop an image file', 'err');
};
fileInput.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };

function handleFile(f) {
  S.file = f;
  const r = new FileReader();
  r.onload = e => {
    S.dataUrl = e.target.result;
    $('#preview-img').src = S.dataUrl;
    $('#file-name-display').textContent = `${f.name} — ${(f.size/1024).toFixed(1)} KB`;
    $('#preview-box').classList.add('show');
    dropZone.style.display = 'none';
    $('#next1').disabled = false;
    toast('Image loaded', 'ok');
  };
  r.readAsDataURL(f);
}

$('#btn-remove').onclick = () => {
  S.file = null; S.dataUrl = null;
  $('#preview-box').classList.remove('show');
  dropZone.style.display = '';
  fileInput.value = '';
  $('#next1').disabled = true;
};

$('#next1').onclick = () => { if (S.file) goStep(2); };

/* ════════════════ STEP 2: NAME (VOICE) ════════════════ */
$('#mic-name').onclick = () => {
  if (S.listening) stopListen();
  else startListen('name');
};

$('#apply-name').onclick = () => {
  const v = $('#manual-name').value.trim();
  if (v) { setName(v); toast('Name set', 'ok'); }
};
$('#manual-name').onkeypress = e => { if (e.key === 'Enter') $('#apply-name').click(); };

function setName(v) {
  S.name = v;
  const el = $('#name-val');
  el.textContent = v;
  el.classList.add('filled');
  $('#next2').disabled = false;
}

$('#back2').onclick = () => goStep(1);
$('#next2').onclick = () => { if (S.name) goStep(3); };

/* ════════════════ STEP 3: TOOTH (VOICE) ════════════════ */
$('#mic-tooth').onclick = () => {
  if (S.listening) stopListen();
  else startListen('tooth');
};

$('#apply-tooth').onclick = () => {
  const v = $('#manual-tooth').value.trim();
  if (v) { setTooth(v); toast('Tooth set', 'ok'); }
};
$('#manual-tooth').onkeypress = e => { if (e.key === 'Enter') $('#apply-tooth').click(); };

function setTooth(v) {
  S.tooth = v;
  const el = $('#tooth-val');
  el.textContent = v;
  el.classList.add('filled');
  $('#next3').disabled = false;
  $$('.t').forEach(t => t.classList.remove('sel'));
  const tn = document.querySelector(`.t[data-t="${v}"]`);
  if (tn) tn.classList.add('sel');
}

$$('.t').forEach(t => t.onclick = () => { setTooth(t.dataset.t); toast(`Tooth ${t.dataset.t} selected`, 'info'); });

$('#back3').onclick = () => goStep(2);
$('#next3').onclick = () => { if (S.tooth) goStep(4); };

/* ════════════════ SPEECH RECOGNITION ════════════════ */
function startListen(mode) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Speech not supported — please type manually', 'err'); return; }

  const r = new SR();
  r.lang = 'en-IN';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  S.recog = r;
  S.listening = true;

  const btn = mode === 'name' ? $('#mic-name') : $('#mic-tooth');
  const lbl = mode === 'name' ? $('#mic-name-label') : $('#mic-tooth-label');
  btn.classList.add('listening');
  lbl.textContent = 'Listening…';

  r.onresult = ev => {
    let txt = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
    txt = txt.trim();
    if (mode === 'name') {
      txt = txt.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      setName(txt);
    } else {
      const num = extractNum(txt);
      setTooth(num || txt);
    }
  };

  r.onend = () => {
    btn.classList.remove('listening');
    lbl.textContent = 'Tap to speak again';
    S.listening = false;
    S.recog = null;
    if (mode === 'name' && S.name) toast(`Captured: ${S.name}`, 'ok');
    else if (mode === 'tooth' && S.tooth) toast(`Captured: ${S.tooth}`, 'ok');
  };

  r.onerror = ev => {
    btn.classList.remove('listening');
    lbl.textContent = 'Tap to try again';
    S.listening = false; S.recog = null;
    if (ev.error === 'no-speech') toast('No speech detected — try again', 'err');
    else if (ev.error === 'not-allowed') toast('Mic access denied — allow in browser settings', 'err');
    else toast(`Error: ${ev.error}`, 'err');
  };

  r.start();
}

function stopListen() { if (S.recog) { S.recog.stop(); S.listening = false; } }

function extractNum(txt) {
  const map = {
    'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,
    'twenty one':21,'twenty two':22,'twenty three':23,'twenty four':24,'twenty five':25,'twenty six':26,'twenty seven':27,'twenty eight':28,
    'thirty one':31,'thirty two':32,'thirty three':33,'thirty four':34,'thirty five':35,'thirty six':36,'thirty seven':37,'thirty eight':38,
    'forty one':41,'forty two':42,'forty three':43,'forty four':44,'forty five':45,'forty six':46,'forty seven':47,'forty eight':48,
  };
  const lower = txt.toLowerCase();
  for (const [w, n] of Object.entries(map)) if (lower.includes(w)) return String(n);
  const nums = txt.replace(/[^0-9]/g, '');
  if (nums.length >= 2) return nums.substring(0, 2);
  return nums || txt;
}

/* ════════════════ STEP 4: CONFIRM ════════════════ */
function fillConfirm() {
  $('#confirm-img').src = S.dataUrl;
  $('#cf-name').textContent = S.name;
  $('#cf-tooth').textContent = S.tooth;
  $('#cf-date').textContent = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
}

$('#back4').onclick = () => goStep(3);

/* ════════════════ SAVE ════════════════ */
$('#btn-save').onclick = save;

async function save() {
  if (!S.db) { toast('Configure Supabase first (⚙️)', 'err'); return; }
  showLoad('Uploading image…');
  try {
    const pid = await genId();
    const ext = S.file.name.split('.').pop();
    const path = `${pid}.${ext}`;

    const { error: upErr } = await S.db.storage.from('rvg-images').upload(path, S.file, { cacheControl: '3600', upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: urlData } = S.db.storage.from('rvg-images').getPublicUrl(path);

    showLoad('Saving record…');
    const { error: insErr } = await S.db.from('patients').insert([{
      patient_id: pid, patient_name: S.name, tooth_number: S.tooth,
      image_url: urlData.publicUrl, image_path: path,
    }]).select();
    if (insErr) throw new Error(insErr.message);

    hideLoad();
    showSuccess(pid);
    toast('Saved!', 'ok');
    updateStats();
  } catch(e) { hideLoad(); toast(e.message || 'Save failed', 'err'); console.error(e); }
}

async function genId() {
  try {
    const { data, error } = await S.db.rpc('get_next_patient_seq');
    if (error) throw error;
    return String(data).padStart(4, '0');
  } catch {
    return String(Math.floor(Math.random() * 9000) + 1000);
  }
}

function showSuccess(pid) {
  $$('.step').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const el = $('#s-success');
  el.style.display = 'block'; void el.offsetHeight; el.classList.add('active');
  $('#gen-id').textContent = pid;
  $$('.prog-step').forEach(p => { p.classList.remove('active'); p.classList.add('done'); });
  $$('.prog-line').forEach(l => l.classList.add('done'));
}

$('#btn-copy').onclick = () => {
  navigator.clipboard.writeText($('#gen-id').textContent)
    .then(() => toast('Copied!', 'ok')).catch(() => toast('Copy failed', 'err'));
};
$('#btn-print').onclick = () => window.print();
$('#btn-new').onclick = resetWiz;

function resetWiz() {
  S.file = null; S.dataUrl = null; S.name = ''; S.tooth = ''; S.step = 1;
  $('#preview-box').classList.remove('show');
  dropZone.style.display = '';
  fileInput.value = '';
  $('#next1').disabled = true;
  $('#name-val').innerHTML = '<span class="placeholder-text">Name will appear here…</span>';
  $('#name-val').classList.remove('filled');
  $('#next2').disabled = true;
  $('#manual-name').value = '';
  $('#tooth-val').innerHTML = '<span class="placeholder-text">Tooth # will appear here…</span>';
  $('#tooth-val').classList.remove('filled');
  $('#next3').disabled = true;
  $('#manual-tooth').value = '';
  $$('.t').forEach(t => t.classList.remove('sel'));
  $$('.prog-step').forEach(p => p.classList.remove('active','done'));
  $$('.prog-line').forEach(l => l.classList.remove('active','done'));
  $$('.step').forEach(s => { s.classList.remove('active'); s.style.display = ''; });
  goStep(1);
}

/* ════════════════ SEARCH ════════════════ */
$('#btn-search').onclick = doSearch;
$('#search-input').onkeypress = e => { if (e.key === 'Enter') doSearch(); };

async function doSearch() {
  const q = $('#search-input').value.trim().toUpperCase();
  if (!q) return toast('Enter a Patient ID', 'err');
  if (!S.db) return toast('Configure Supabase first', 'err');
  $('#result-card').style.display = 'none';
  $('#no-result').style.display = 'none';
  try {
    const { data, error } = await S.db.from('patients').select('*').eq('patient_id', q).single();
    if (error || !data) { $('#no-result').style.display = ''; return; }
    showResult(data);
  } catch { toast('Search failed', 'err'); }
}

function showResult(r) {
  $('#res-badge').textContent = r.patient_id;
  $('#res-img').src = r.image_url;
  $('#res-name').textContent = r.patient_name;
  $('#res-tooth').textContent = r.tooth_number;
  $('#res-pid').textContent = r.patient_id;
  $('#res-date').textContent = new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
  $('#result-card').style.display = '';
  $('#no-result').style.display = 'none';
}

$('#btn-print-res').onclick = () => window.print();

async function loadRecent() {
  if (!S.db) { $('#recent-list').innerHTML = '<p style="color:var(--t3);text-align:center;padding:1rem;font-size:.82rem">Configure Supabase to see records</p>'; return; }
  try {
    const { data } = await S.db.from('patients').select('patient_id,patient_name,tooth_number,created_at').order('created_at', { ascending: false }).limit(10);
    if (!data || !data.length) { $('#recent-list').innerHTML = '<p style="color:var(--t3);text-align:center;padding:1rem;font-size:.82rem">No records yet</p>'; return; }
    $('#recent-list').innerHTML = data.map(r => {
      const ini = r.patient_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const dt = new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
      return `<div class="rec-item" data-pid="${r.patient_id}">
        <div class="rec-left"><div class="rec-avatar">${ini}</div><div><div class="rec-name">${r.patient_name}</div><div class="rec-id">${r.patient_id}</div></div></div>
        <div class="rec-right"><div class="rec-tooth">Tooth ${r.tooth_number}</div><div class="rec-date">${dt}</div></div>
      </div>`;
    }).join('');
    $$('.rec-item').forEach(i => i.onclick = () => { $('#search-input').value = i.dataset.pid; doSearch(); });
  } catch { $('#recent-list').innerHTML = '<p style="color:var(--t3);text-align:center;padding:1rem;font-size:.82rem">Failed to load</p>'; }
}

/* ════════════════ WELCOME & STATS ════════════════ */
function updateDate() {
  const d = new Date();
  $('#welcome-date').textContent = d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ' • ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}

async function updateStats() {
  if (!S.db) return;
  try {
    const { count: tot } = await S.db.from('patients').select('*', { count: 'exact', head: true });
    $('#stat-total').textContent = tot ?? 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const { count: td } = await S.db.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
    $('#stat-today').textContent = td ?? 0;
  } catch {}
}

/* ════════════════ INIT ════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const ok = sbInit();
  if (!ok) { const c = cfgGet(); if (!c.url || !c.key) $('#modal').style.display = ''; }
  updateDate();
  setInterval(updateDate, 60000);
  updateStats();
  goStep(1);
});
