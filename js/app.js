// ─── State ──────────────────────────────────────────────────────────────────
let state = {
  bancaTotal: 1000,
  bancaCurrent: 1000,
  unitPercent: 1,
  bets: [],
  filter: 'all'
};

// ─── Persistence ────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('bancaos_v1', JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem('bancaos_v1');
  if (raw) {
    try { state = JSON.parse(raw); } catch(e) {}
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────
load();
document.getElementById('bancaTotal').value = state.bancaTotal;
document.getElementById('unitPercent').value = state.unitPercent;
renderAll();

// ─── Config ──────────────────────────────────────────────────────────────────
function onConfigChange() {
  const bt = parseFloat(document.getElementById('bancaTotal').value) || 0;
  const up = parseFloat(document.getElementById('unitPercent').value) || 1;
  state.bancaTotal = bt;
  state.unitPercent = up;
  // recalculate current banca relative to changes: keep the delta invested
  // current = total - sum of pending bets
  const invested = state.bets.filter(b => b.status === 'pending').reduce((a, b) => a + b.amount, 0);
  state.bancaCurrent = bt - invested;
  save();
  renderAll();
}

function unitValue() {
  return (state.bancaTotal * state.unitPercent) / 100;
}

// ─── Form Mask ───────────────────────────────────────────────────────────────
function applyMask(inputEl, divisor, decimals) {
  let digits = inputEl.value.replace(/\D/g, '');
  if (!digits) { inputEl.value = ''; updatePreview(); return; }
  const num = parseInt(digits, 10) / divisor;
  inputEl.value = num.toFixed(decimals);
  updatePreview();
}

document.getElementById('fOdd').addEventListener('input', function() {
  applyMask(this, 100, 2); // 145 → 1.45
});

document.getElementById('fUnits').addEventListener('input', function() {
  applyMask(this, 10, 1); // 05 → 0.5
});

function updatePreview() {
  const units = parseFloat(document.getElementById('fUnits').value) || 0;
  const uv = unitValue();
  document.getElementById('betPreview').textContent = fmt(units * uv);
}

// ─── Launch ──────────────────────────────────────────────────────────────────
function launchBet() {
  const units = parseFloat(document.getElementById('fUnits').value);
  const odd   = parseFloat(document.getElementById('fOdd').value);
  const note  = document.getElementById('fNote').value.trim();

  if (!units || units <= 0) return toast('Informe as Unidades.');
  if (!odd || odd <= 0)    return toast('Odd deve ser maior que 0.');

  const uv = unitValue();
  const amount = units * uv;

  if (amount > state.bancaCurrent) return toast('Saldo insuficiente na banca.');

  const bet = {
    id: Date.now(),
    units, odd, note,
    amount,
    potential: amount * odd,
    profit: amount * (odd - 1),
    status: 'pending',
    ts: new Date().toISOString()
  };

  state.bets.unshift(bet);
  state.bancaCurrent -= amount;

  save();
  renderAll();
  clearForm();
  toast('Aposta lançada ✓');
}

// ─── Results ─────────────────────────────────────────────────────────────────
function green(id) {
  const bet = state.bets.find(b => b.id === id);
  if (!bet || bet.status !== 'pending') return;
  bet.status = 'green';
  state.bancaCurrent += bet.potential; // amount + profit
  save(); renderAll();
  toast('Green registrado ✓');
}

function red(id) {
  const bet = state.bets.find(b => b.id === id);
  if (!bet || bet.status !== 'pending') return;
  bet.status = 'red';
  // amount already deducted at launch
  save(); renderAll();
  toast('Red registrado.');
}

// ─── Filter ──────────────────────────────────────────────────────────────────
function setFilter(f) {
  state.filter = f;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === f);
  });
  renderBets();
}

// ─── Render ──────────────────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderConfig();
  renderBets();
}

function renderConfig() {
  document.getElementById('unitValue').textContent = fmt(unitValue());
  updatePreview();
}

function renderStats() {
  // Banca stats
  const statsRow = document.getElementById('statsRow');
  statsRow.innerHTML = `
    <div class="stat-card">
      <p class="mono" style="font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.1em">Banca Total</p>
      <p class="mono font-bold text-xl mt-1" style="color:var(--text)">${fmt(state.bancaTotal)}</p>
    </div>
    <div class="stat-card">
      <p class="mono" style="font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.1em">Banca Atual</p>
      <p class="mono font-bold text-xl mt-1" style="color:var(--accent)">${fmt(state.bancaCurrent)}</p>
    </div>
  `;

  // ROI + PnL
  const closed = state.bets.filter(b => b.status !== 'pending');
  const invested = closed.reduce((a, b) => a + b.amount, 0);
  const returned = closed.filter(b => b.status === 'green').reduce((a, b) => a + b.potential, 0);
  const pnl = returned - invested;
  const roi = invested > 0 ? (pnl / invested) * 100 : 0;

  const roiEl = document.getElementById('roiDisplay');
  const pnlEl = document.getElementById('pnlDisplay');

  const cls = roi > 0 ? 'roi-positive' : roi < 0 ? 'roi-negative' : 'roi-neutral';
  roiEl.className = `mono font-bold text-2xl mt-1 ${cls}`;
  roiEl.textContent = invested > 0 ? (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%' : '—';

  pnlEl.className = `mono font-bold text-xl mt-1 ${cls}`;
  pnlEl.textContent = invested > 0 ? (pnl >= 0 ? '+' : '') + fmt(pnl) : '—';
}

function renderBets() {
  const container = document.getElementById('betList');
  let bets = state.bets;

  if (state.filter !== 'all') bets = bets.filter(b => b.status === state.filter);

  if (!bets.length) {
    container.innerHTML = `<p class="mono text-xs text-center mt-16" style="color:var(--muted)">Nenhum registro.</p>`;
    return;
  }

  container.innerHTML = bets.map(bet => {
    const d = new Date(bet.ts);
    const dateStr = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' +
                    d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

    const rowClass = `bet-row ${bet.status}-row`;
    const badgeMap = { pending: 'badge-pending', green: 'badge-green', red: 'badge-red' };
    const labelMap = { pending: 'Aguard.', green: 'Green', red: 'Red' };

    const actions = bet.status === 'pending' ? `
      <div class="flex gap-2 mt-3">
        <button class="btn btn-green flex-1" onclick="green(${bet.id})">✓ Green</button>
        <button class="btn btn-red flex-1" onclick="red(${bet.id})">✗ Red</button>
      </div>` : '';

    return `
      <div class="${rowClass}">
        <div class="flex items-start justify-between gap-2">
          <div style="flex:1; min-width:0">
            <p class="font-semibold truncate" style="font-size:14px">${bet.note || '—'}</p>
            <p class="mono mt-1" style="font-size:11px; color:var(--muted)">${dateStr} · ${bet.units}u @ ${bet.odd.toFixed(2)}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="mono font-bold" style="font-size:14px">${fmt(bet.amount)}</p>
            <p class="mono" style="font-size:10px; color:var(--muted)">→ ${fmt(bet.potential)}</p>
          </div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <span class="badge ${badgeMap[bet.status]}">${labelMap[bet.status]}</span>
          ${bet.status === 'green' ? `<span class="mono" style="font-size:11px; color:var(--accent)">+${fmt(bet.profit)}</span>` : ''}
          ${bet.status === 'red' ? `<span class="mono" style="font-size:11px; color:var(--accent2)">-${fmt(bet.amount)}</span>` : ''}
        </div>
        ${actions}
      </div>`;
  }).join('');
}

// ─── Export CSV ──────────────────────────────────────────────────────────────
function exportCSV() {
  if (!state.bets.length) return toast('Sem apostas para exportar.');
  const header = 'Data,Observação,Unidades,Odd,Valor Investido,Retorno Potencial,Lucro,Status';
  const rows = state.bets.map(b => {
    const d = new Date(b.ts).toLocaleString('pt-BR');
    return [d, `"${b.note}"`, b.units, b.odd.toFixed(2),
            b.amount.toFixed(2), b.potential.toFixed(2),
            b.profit.toFixed(2), b.status].join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `bancaos_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('CSV exportado ✓');
}

// ─── Reset ───────────────────────────────────────────────────────────────────
function confirmReset() {
  if (!confirm('Resetar toda a banca e histórico? Esta ação é irreversível.')) return;
  localStorage.removeItem('bancaos_v1');
  state = { bancaTotal: 1000, bancaCurrent: 1000, unitPercent: 1, bets: [], filter: 'all' };
  document.getElementById('bancaTotal').value = 1000;
  document.getElementById('unitPercent').value = 1;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  save(); renderAll();
  toast('Banca resetada.');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clearForm() {
  document.getElementById('fUnits').value = '10';
  document.getElementById('fOdd').value = '200';
  document.getElementById('fNote').value = '';
  updatePreview();
}

function copyPix() {
  const key = document.getElementById('pixKey').textContent.trim();
  navigator.clipboard.writeText(key).then(() => {
    const msg = document.getElementById('pixCopyMsg');
    msg.style.opacity = '1';
    setTimeout(() => msg.style.opacity = '0', 2000);
  });
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
