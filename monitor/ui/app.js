// Monitor UI — polling + actions for the local Flask API

const POLL_INTERVAL = 800;

let configOpen = false;
let tokenVisible = false;
let currentMode = 'RACE';

async function pollState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const s = await res.json();
    updateUI(s);
  } catch (_) {
    setServerDot(false);
  }
}

function updateUI(s) {
  // Server connectivity dots
  setServerDot(s.server_reachable);
  setSendDot(s.server_ok, s.last_send_status);

  // Mode buttons
  document.getElementById('btn-race').classList.toggle('active', s.mode === 'RACE');
  document.getElementById('btn-record').classList.toggle('active', s.mode === 'RECORD');
  document.getElementById('record-card').style.display = s.mode === 'RECORD' ? '' : 'none';
  currentMode = s.mode;
  const cpSection = document.getElementById('cfg-checkpoint-section');
  cpSection.style.display = s.mode === 'RECORD' ? 'flex' : 'none';

  // Position
  if (s.position) {
    document.getElementById('pos-x').textContent = s.position[0].toFixed(3);
    document.getElementById('pos-y').textContent = s.position[1].toFixed(3);
    document.getElementById('pos-z').textContent = s.position[2].toFixed(3);
  } else {
    ['pos-x', 'pos-y', 'pos-z'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }

  // OCR timestamp
  const ocrEl = document.getElementById('ocr-time');
  if (s.last_ocr_at) {
    const d = new Date(s.last_ocr_at);
    ocrEl.textContent = `Last read: ${d.toLocaleTimeString()}`;
  } else {
    ocrEl.textContent = 'Star Citizen not detected';
  }

  // Record: trace count
  document.getElementById('trace-count').textContent = `${s.trace_count} point${s.trace_count !== 1 ? 's' : ''} recorded`;

  // Record buttons state
  const started = s.recording;
  document.getElementById('btn-start').disabled = started;
  document.getElementById('btn-checkpoint').disabled = !started;
  document.getElementById('btn-finish').disabled = !started;
  document.getElementById('btn-cancel').disabled = false;
}

function setServerDot(ok) {
  const dot = document.getElementById('server-dot');
  const label = document.getElementById('server-label');
  dot.className = 'dot' + (ok ? ' ok' : ' error');
  label.textContent = ok ? 'connected' : 'unreachable';
}

function setSendDot(ok, status) {
  const dot = document.getElementById('send-dot');
  const label = document.getElementById('send-dot-label');
  if (status === null || status === undefined) {
    dot.className = 'dot';
    label.textContent = 'not sent yet';
  } else if (ok) {
    dot.className = 'dot ok';
    label.textContent = 'sent';
  } else {
    dot.className = 'dot error';
    label.textContent = 'send failed';
  }
}

async function setMode(mode) {
  await fetch('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  pollState();
}

async function recordMark(action) {
  const name = document.getElementById('circuit-name').value.trim() || 'Circuit';
  const type = document.getElementById('circuit-type').value || 'LOOP';
  await fetch('/api/record/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, name, circuit_type: type }),
  });
  pollState();
}

async function saveConfig() {
  const data = {
    token: document.getElementById('cfg-token').value,
    url: document.getElementById('cfg-url').value,
    monitor_index: parseInt(document.getElementById('cfg-monitor').value) || 1,
    checkpoint_save: document.getElementById('cfg-checkpoint-save').selected,
    checkpoint_save_distance: parseInt(document.getElementById('cfg-checkpoint-distance').value) || 150,
  };
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

function toggleConfig() {
  configOpen = !configOpen;
  document.getElementById('config-fields').style.display = configOpen ? '' : 'none';
  const icon = document.getElementById('config-icon');
  icon.textContent = configOpen ? 'expand_less' : 'expand_more';
  icon.classList.toggle('open', configOpen);
  if (configOpen) loadConfig();
}

async function loadConfig() {
  const [cfgRes, monRes] = await Promise.all([fetch('/api/config'), fetch('/api/monitors')]);
  if (!cfgRes.ok) return;
  const c = await cfgRes.json();

  document.getElementById('cfg-token').value = c.token || '';
  document.getElementById('cfg-url').value = c.url || '';
  document.getElementById('cfg-checkpoint-save').selected = !!c.checkpoint_save;
  document.getElementById('cfg-checkpoint-distance').value = c.checkpoint_save_distance || 150;

  if (monRes.ok) {
    const monitors = await monRes.json();
    const sel = document.getElementById('cfg-monitor');
    sel.innerHTML = monitors.map(m =>
      `<md-select-option value="${m.index}"><div slot="headline">Monitor ${m.index} — ${m.width}×${m.height}</div></md-select-option>`
    ).join('');
    sel.value = String(c.monitor_index || 1);
  }
}

function toggleToken() {
  tokenVisible = !tokenVisible;
  document.getElementById('cfg-token').type = tokenVisible ? 'text' : 'password';
  document.getElementById('token-eye').textContent = tokenVisible ? 'visibility_off' : 'visibility';
}

// Start polling
setInterval(pollState, POLL_INTERVAL);
pollState();
