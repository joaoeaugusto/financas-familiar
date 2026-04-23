/**
 * app.js — Lógica principal da aplicação Finanças Familiar
 *
 * Este ficheiro controla tudo o que o utilizador vê e faz:
 * - Navegação entre páginas
 * - Renderização de dados (transações, subscrições, objetivos)
 * - Gráficos com Chart.js
 * - Importação de CSV
 * - Calculadora de investimento
 */

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
// Aqui guardamos em memória todos os dados carregados do Google Sheets.
// Quando a app sincroniza, estes arrays são atualizados.

const State = {
  transactions:  [],  // Array de objetos {id, data, descricao, valor, tipo, ...}
  subscriptions: [],  // Array de subscrições recorrentes
  goals:         [],  // Array de objetivos de poupança/investimento
  settings: {
    myName:      'Eu',
    partnerName: 'Parceiro/a',
  },
  currentMonth: new Date().getMonth(),  // 0-11
  currentYear:  new Date().getFullYear(),
  reportYear:   new Date().getFullYear(),
  activeOwner:  'all',  // 'all' | 'me' | 'partner'
  editingTx:    null,   // ID da transação a editar (null = nova)
};

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
// Cada categoria tem uma cor, ícone, e subcategorias.
// A propriedade "keywords" é usada para categorização automática no import CSV.

const CATEGORIES = {
  habitacao: {
    label: 'Habitação', color: '#5b8dee', icon: '🏠',
    subcategories: ['Prestação/Renda','Condomínio','Seguro Multirriscos','Água','Eletricidade','Gás','Internet/TV','Reparações'],
    keywords: ['renda','prestacao','condominio','epal','edp','galp','nos ','meo ','vodafone','agua','eletricidade'],
  },
  alimentacao: {
    label: 'Alimentação', color: '#4db87a', icon: '🛒',
    subcategories: ['Supermercado','Restaurantes & Cafés','Takeaway & Delivery','Mercado'],
    keywords: ['pingo doce','continente','lidl','aldi','minipreco','intermarche','mercadona','glovo','uber eats','mcdonalds','burger','pizza','cafe','restaurante','snack'],
  },
  transportes: {
    label: 'Transportes', color: '#e8894a', icon: '🚗',
    subcategories: ['Prestação Carro','Combustível','Portagens','Seguro Auto','Transporte Público','Estacionamento','Revisão/Manutenção'],
    keywords: ['galp','bp ','repsol','cepsa','via verde','scuts','metro','comboio','uber ','bolt ','cp ','tca','rent a car','portagem','estacionamento'],
  },
  subscricoes: {
    label: 'Subscrições', color: '#9b6fe0', icon: '🔄',
    subcategories: ['Streaming','Música','Cloud','Software','Ginásio','Telecomunicações','Outros'],
    keywords: ['netflix','spotify','amazon prime','disney','apple','google one','dropbox','adobe','microsoft','gym','fitnesshut','holmes','hbo','youtube premium'],
  },
  saude: {
    label: 'Saúde', color: '#e05c5c', icon: '🏥',
    subcategories: ['Seguro de Saúde','Consultas','Farmácia','Dentista','Ótica','Análises'],
    keywords: ['farmacia','clinica','hospital','medis','multicare','fidelidade saude','dentista','otica','consulta','analises','exame'],
  },
  filhos: {
    label: 'Filhos', color: '#4ab8c4', icon: '👶',
    subcategories: ['Creche/Escola','Atividades','Roupa','Material Escolar','Mesada','Saúde Infantil'],
    keywords: ['creche','escola','colegio','atividade','desporto','livros escola','material escolar'],
  },
  lazer: {
    label: 'Lazer & Férias', color: '#f0c97a', icon: '✈️',
    subcategories: ['Viagens','Entretenimento','Compras Pessoais','Hobbies','Presentes','Eventos'],
    keywords: ['booking','airbnb','ryanair','tap','easyjet','cinema','teatro','museu','zara','h&m','mango','fnac','worten','presente'],
  },
  financas: {
    label: 'Finanças Pessoais', color: '#d4a853', icon: '📈',
    subcategories: ['PPR','ETFs/Fundos','Fundo de Emergência','Poupança Filhos','Outros Investimentos','Seguros de Vida'],
    keywords: ['ppr','etf','fundo','deposito prazo','seguro vida','cgd investimento','millennium invest'],
  },
  rendimentos: {
    label: 'Rendimentos', color: '#6fcf97', icon: '💰',
    subcategories: ['Salário','Freelance/Extra','Rendas Recebidas','Dividendos','Reembolsos','Outros'],
    keywords: ['salario','vencimento','ordenado','transferencia recebida','reembolso','irs','dividendo'],
  },
  educacao: {
    label: 'Educação & Formação', color: '#bb87fc', icon: '📚',
    subcategories: ['Cursos Online','Livros','Formação Profissional','Universidade','Certificações'],
    keywords: ['udemy','coursera','linkedin learning','livro','formacao','universidade','curso'],
  },
};

// Ordem de exibição das categorias (para filtros e listas)
const CAT_ORDER = Object.keys(CATEGORIES);

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/** Formata um número como moeda: 1234.5 → "€1.234,50" */
function formatEur(n) {
  const v = parseFloat(n) || 0;
  return '€' + v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata uma data ISO como "12 Mai 2025" */
function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Gera um ID único para novas linhas */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Mostra uma notificação temporária no canto inferior direito */
function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), duration);
}

/** Devolve o label de quem pagou (Conjunto / nome próprio / nome parceiro) */
function ownerLabel(owner) {
  if (owner === 'joint')   return 'Conjunto';
  if (owner === 'me')      return State.settings.myName;
  if (owner === 'partner') return State.settings.partnerName;
  return owner;
}

/**
 * Tenta adivinhar a categoria de uma transação com base no texto da descrição.
 * Percorre as keywords de cada categoria e devolve a primeira correspondência.
 * Se não encontrar nada, devolve 'lazer' como fallback.
 */
function guessCategory(description) {
  const desc = description.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.keywords.some(kw => desc.includes(kw))) return key;
  }
  return 'lazer';
}

// ─── NAVEGAÇÃO ────────────────────────────────────────────────────────────────

/** Muda a página visível e atualiza o estado activo na sidebar. */
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.remove('hidden');

  const navBtn = document.querySelector(`[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Renderizamos o conteúdo específico de cada página quando a visitamos
  if (pageId === 'dashboard')     renderDashboard();
  if (pageId === 'transactions')  renderTransactions();
  if (pageId === 'subscriptions') renderSubscriptions();
  if (pageId === 'planning')      renderPlanning();
  if (pageId === 'reports')       renderReports();
}

// ─── MODAIS ───────────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Fechar modal ao clicar no overlay (fora do painel branco)
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Botões de fechar com data-modal
document.querySelectorAll('[data-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});

// ─── FILTROS DE MÊS ──────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function updateMonthLabel() {
  document.getElementById('current-month-label').textContent =
    `${MONTHS_PT[State.currentMonth].slice(0,3)} ${State.currentYear}`;
}

document.getElementById('btn-prev-month').addEventListener('click', () => {
  if (State.currentMonth === 0) { State.currentMonth = 11; State.currentYear--; }
  else State.currentMonth--;
  updateMonthLabel();
  renderDashboard();
});

document.getElementById('btn-next-month').addEventListener('click', () => {
  if (State.currentMonth === 11) { State.currentMonth = 0; State.currentYear++; }
  else State.currentMonth++;
  updateMonthLabel();
  renderDashboard();
});

/** Filtra as transações do State para o mês/ano ativos e o dono selecionado. */
function getMonthTransactions() {
  return State.transactions.filter(tx => {
    if (!tx.data) return false;
    const d = new Date(tx.data);
    const monthOk = d.getMonth() === State.currentMonth && d.getFullYear() === State.currentYear;
    if (!monthOk) return false;
    if (State.activeOwner === 'all') return true;
    return tx.dono === State.activeOwner || tx.dono === 'joint';
  });
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

let chartCategories = null;
let chartMonthly    = null;

function renderDashboard() {
  const txs = getMonthTransactions();

  // Calculamos os totais
  const income   = txs.filter(t => t.tipo === 'income').reduce((s, t) => s + parseFloat(t.valor)||0, 0);
  const expenses = txs.filter(t => t.tipo === 'expense').reduce((s, t) => s + parseFloat(t.valor)||0, 0);
  const savings  = income - expenses;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  // Total de subscrições ativas
  const subTotal = State.subscriptions
    .filter(s => s.ativo !== 'false')
    .reduce((s, sub) => s + parseFloat(sub.valor_mensal)||0, 0);

  // Atualizamos os cartões de resumo
  document.getElementById('summary-income').textContent    = formatEur(income);
  document.getElementById('summary-expenses').textContent  = formatEur(expenses);
  document.getElementById('summary-savings').textContent   = formatEur(savings);
  document.getElementById('summary-subs').textContent      = formatEur(subTotal);
  document.getElementById('summary-income-sub').textContent  = `${txs.filter(t=>t.tipo==='income').length} entradas`;
  document.getElementById('summary-expenses-sub').textContent = `${txs.filter(t=>t.tipo==='expense').length} saídas`;
  document.getElementById('summary-savings-rate').textContent = `${savingsRate}% do rendimento`;
  document.getElementById('summary-subs-count').textContent   = `${State.subscriptions.filter(s=>s.ativo!=='false').length} serviços ativos`;

  document.getElementById('dashboard-subtitle').textContent =
    `${MONTHS_PT[State.currentMonth]} ${State.currentYear}`;

  // Gráfico de donut — despesas por categoria
  const expTxs = txs.filter(t => t.tipo === 'expense');
  const byCategory = {};
  expTxs.forEach(t => {
    byCategory[t.categoria] = (byCategory[t.categoria] || 0) + (parseFloat(t.valor)||0);
  });

  const catLabels = Object.keys(byCategory).map(k => CATEGORIES[k]?.label || k);
  const catValues = Object.values(byCategory);
  const catColors = Object.keys(byCategory).map(k => CATEGORIES[k]?.color || '#888');

  if (chartCategories) chartCategories.destroy();
  const ctx1 = document.getElementById('chart-categories').getContext('2d');
  chartCategories = new Chart(ctx1, {
    type: 'doughnut',
    data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: catColors, borderWidth: 2, borderColor: '#13161e' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9ba3b8', font: { family: 'Inter', size: 11 }, padding: 12, boxWidth: 10 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatEur(c.raw)}` } },
      },
    },
  });

  // Centro do donut mostra total de despesas
  document.getElementById('donut-center-text').innerHTML =
    `<div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#e8eaf0">${formatEur(expenses)}</div>
     <div style="font-size:11px;color:#5c6480;margin-top:2px">despesas</div>`;

  // Gráfico de barras — 6 meses de entradas vs saídas
  const months6 = [];
  const inc6 = [], exp6 = [];
  for (let i = 5; i >= 0; i--) {
    let m = State.currentMonth - i;
    let y = State.currentYear;
    if (m < 0) { m += 12; y--; }
    months6.push(`${MONTHS_PT[m].slice(0,3)} ${y}`);
    const monthTxs = State.transactions.filter(tx => {
      if (!tx.data) return false;
      const d = new Date(tx.data);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    inc6.push(monthTxs.filter(t=>t.tipo==='income').reduce((s,t)=>s+parseFloat(t.valor)||0,0));
    exp6.push(monthTxs.filter(t=>t.tipo==='expense').reduce((s,t)=>s+parseFloat(t.valor)||0,0));
  }

  if (chartMonthly) chartMonthly.destroy();
  const ctx2 = document.getElementById('chart-monthly').getContext('2d');
  chartMonthly = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: months6,
      datasets: [
        { label: 'Rendimento', data: inc6, backgroundColor: 'rgba(77,184,122,0.7)', borderRadius: 4 },
        { label: 'Despesas',   data: exp6, backgroundColor: 'rgba(224,92,92,0.7)',  borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9ba3b8', font: { family: 'Inter', size: 11 } } } },
      scales: {
        x: { grid: { color: '#252a38' }, ticks: { color: '#5c6480', font: { size: 11 } } },
        y: { grid: { color: '#252a38' }, ticks: { color: '#5c6480', callback: v => '€'+v } },
      },
    },
  });

  // Últimas 5 transações
  const recent = [...txs].sort((a,b) => new Date(b.data)-new Date(a.data)).slice(0,5);
  const recentEl = document.getElementById('recent-transactions-list');
  recentEl.innerHTML = recent.length
    ? recent.map(tx => txHTML(tx)).join('')
    : '<p style="color:var(--text3);padding:16px;text-align:center;font-size:13px">Sem transações este mês. Adicione a primeira!</p>';

  // Alerta de subscrições
  const activeSubs = State.subscriptions.filter(s => s.ativo !== 'false');
  const subsAlertEl = document.getElementById('subs-alert-list');
  subsAlertEl.innerHTML = activeSubs.length
    ? activeSubs.slice(0,4).map(s =>
        `<div class="tx-item">
          <div class="tx-cat-dot" style="background:${CATEGORIES.subscricoes.color}"></div>
          <div class="tx-info"><div class="tx-desc">${s.nome}</div>
          <div class="tx-meta">${subCatLabel(s.categoria)} · Dia ${s.dia_cobranca||'–'}</div></div>
          <span class="tx-owner-badge">${ownerLabel(s.dono)}</span>
          <div class="tx-amount expense">${formatEur(s.valor_mensal)}/mês</div>
        </div>`
      ).join('')
    : '<p style="color:var(--text3);padding:16px;text-align:center;font-size:13px">Nenhuma subscrição registada.</p>';
}

// ─── TRANSAÇÕES ───────────────────────────────────────────────────────────────

/** Gera o HTML de uma linha de transação */
function txHTML(tx, showDelete = true) {
  const cat = CATEGORIES[tx.categoria] || CATEGORIES.lazer;
  const isIncome = tx.tipo === 'income';
  const sign = isIncome ? '+' : '-';

  return `<div class="tx-item">
    <div class="tx-cat-dot" style="background:${cat.color}"></div>
    <div class="tx-info">
      <div class="tx-desc">${tx.descricao || '–'}</div>
      <div class="tx-meta">${formatDate(tx.data)} · ${cat.label}${tx.subcategoria ? ' › '+tx.subcategoria : ''}</div>
    </div>
    <span class="tx-owner-badge">${ownerLabel(tx.dono)}</span>
    ${tx.recorrente === 'true' ? '<span style="font-size:11px;color:var(--purple)">🔄</span>' : ''}
    <div class="tx-amount ${isIncome ? 'income' : 'expense'}">${sign}${formatEur(tx.valor)}</div>
    ${showDelete ? `<button class="tx-delete" data-id="${tx.id}" title="Apagar">✕</button>` : ''}
  </div>`;
}

/** Renderiza a lista de transações com os filtros activos */
function renderTransactions() {
  let txs = [...State.transactions];

  // Aplicamos os filtros
  const fCat    = document.getElementById('filter-category').value;
  const fOwner  = document.getElementById('filter-owner').value;
  const fType   = document.getElementById('filter-type').value;
  const fSearch = document.getElementById('filter-search').value.toLowerCase();

  // Filtro de mês (usamos o mês seleccionado na sidebar)
  txs = txs.filter(tx => {
    if (!tx.data) return false;
    const d = new Date(tx.data);
    return d.getMonth() === State.currentMonth && d.getFullYear() === State.currentYear;
  });

  if (fCat)    txs = txs.filter(t => t.categoria === fCat);
  if (fOwner)  txs = txs.filter(t => t.dono === fOwner);
  if (fType)   txs = txs.filter(t => t.tipo === fType);
  if (fSearch) txs = txs.filter(t => t.descricao?.toLowerCase().includes(fSearch));

  // Ordenamos por data descendente
  txs.sort((a,b) => new Date(b.data) - new Date(a.data));

  const listEl  = document.getElementById('transactions-list');
  const emptyEl = document.getElementById('transactions-empty');

  if (txs.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    listEl.innerHTML = txs.map(tx => txHTML(tx)).join('');

    // Event listeners nos botões de apagar
    listEl.querySelectorAll('.tx-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteTx(btn.dataset.id));
    });
  }

  // Populamos o select de categorias no filtro
  const catSel = document.getElementById('filter-category');
  if (catSel.options.length <= 1) {
    CAT_ORDER.forEach(k => {
      const o = document.createElement('option');
      o.value = k; o.textContent = CATEGORIES[k].label;
      catSel.appendChild(o);
    });
  }
}

// ─── MODAL DE NOVA TRANSAÇÃO ──────────────────────────────────────────────────

function openAddTransaction() {
  // Data de hoje por defeito
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-notes').value = '';

  // Populamos o select de categorias
  populateCategorySelect('tx-category', 'tx-subcategory');

  // Actualizamos labels dos botões de dono com nomes reais
  document.getElementById('owner-me-btn').textContent = State.settings.myName;
  document.getElementById('owner-partner-btn').textContent = State.settings.partnerName;

  openModal('modal-transaction');
}

/** Preenche um select de categorias e atualiza as subcategorias ao mudar */
function populateCategorySelect(catSelId, subSelId) {
  const catSel = document.getElementById(catSelId);
  const subSel = document.getElementById(subSelId);
  catSel.innerHTML = CAT_ORDER.map(k =>
    `<option value="${k}">${CATEGORIES[k].icon} ${CATEGORIES[k].label}</option>`
  ).join('');

  function updateSubs() {
    const cat = CATEGORIES[catSel.value];
    subSel.innerHTML = (cat?.subcategories || []).map(s => `<option>${s}</option>`).join('');
  }
  catSel.removeEventListener('change', catSel._subUpdater);
  catSel._subUpdater = updateSubs;
  catSel.addEventListener('change', updateSubs);
  updateSubs();
}

/** Guarda a transação do modal no Google Sheets e atualiza o state */
async function saveTx() {
  const desc   = document.getElementById('tx-description').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date   = document.getElementById('tx-date').value;

  if (!desc || !amount || !date) { toast('⚠️ Preencha todos os campos obrigatórios'); return; }

  const tipo   = document.querySelector('.type-btn.active').dataset.type;
  const dono   = document.querySelector('.owner-btn.active').dataset.owner;
  const recur  = document.querySelector('.recur-btn.active').dataset.recur;

  const tx = {
    id:           genId(),
    data:         date,
    descricao:    desc,
    valor:        amount.toFixed(2),
    tipo,
    categoria:    document.getElementById('tx-category').value,
    subcategoria: document.getElementById('tx-subcategory').value,
    dono,
    recorrente:   recur,
    notas:        document.getElementById('tx-notes').value,
  };

  try {
    await Sheets.addTransaction(tx);
    State.transactions.push(tx);
    closeModal('modal-transaction');
    toast('✓ Transação guardada');
    renderDashboard();
    renderTransactions();
  } catch (e) {
    console.error(e);
    toast('❌ Erro ao guardar. Verifique a ligação.');
  }
}

/** Apaga uma transação pelo seu ID */
async function deleteTx(id) {
  if (!confirm('Apagar esta transação?')) return;
  const idx = State.transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  try {
    await Sheets.deleteTransaction(idx);
    State.transactions.splice(idx, 1);
    toast('Transação apagada');
    renderDashboard();
    renderTransactions();
  } catch(e) {
    toast('❌ Erro ao apagar');
  }
}

// ─── SUBSCRIÇÕES ──────────────────────────────────────────────────────────────

const SUB_CAT_LABELS = {
  streaming: 'Streaming', music: 'Música', cloud: 'Cloud',
  software: 'Software', gym: 'Ginásio', news: 'Jornais/Revistas',
  telecom: 'Telecomunicações', other: 'Outro',
};
function subCatLabel(k) { return SUB_CAT_LABELS[k] || k || '–'; }

function renderSubscriptions() {
  const active = State.subscriptions.filter(s => s.ativo !== 'false');
  const monthly = active.reduce((s, sub) => s + parseFloat(sub.valor_mensal)||0, 0);

  document.getElementById('subs-monthly-total').textContent = formatEur(monthly);
  document.getElementById('subs-annual-total').textContent  = formatEur(monthly * 12);
  document.getElementById('subs-count').textContent         = active.length;

  const grid = document.getElementById('subscriptions-grid');
  grid.innerHTML = active.length
    ? active.map((s, idx) => `
        <div class="sub-card">
          <div class="sub-card-owner">${ownerLabel(s.dono)}</div>
          <div class="sub-card-name">${s.nome}</div>
          <div class="sub-card-cat">${subCatLabel(s.categoria)} · Dia ${s.dia_cobranca||'–'}</div>
          <div class="sub-card-monthly">${formatEur(s.valor_mensal)}<span style="font-size:13px;color:var(--text3)">/mês</span></div>
          <div class="sub-card-annual">Anual: <strong>${formatEur(parseFloat(s.valor_mensal)*12)}</strong></div>
          <button class="sub-card-delete" data-idx="${idx}" title="Apagar">✕</button>
        </div>`
      ).join('')
    : '<p style="color:var(--text3);padding:24px;grid-column:1/-1;text-align:center">Nenhuma subscrição registada. Adicione a primeira!</p>';

  grid.querySelectorAll('.sub-card-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSub(parseInt(btn.dataset.idx)));
  });
}

async function saveSub() {
  const name   = document.getElementById('sub-name').value.trim();
  const amount = parseFloat(document.getElementById('sub-amount').value);
  if (!name || !amount) { toast('⚠️ Preencha nome e valor'); return; }

  const sub = {
    id:           genId(),
    nome:         name,
    valor_mensal: amount.toFixed(2),
    categoria:    document.getElementById('sub-category').value,
    dono:         document.getElementById('sub-owner').value,
    dia_cobranca: document.getElementById('sub-day').value,
    ativo:        'true',
  };
  try {
    await Sheets.addSubscription(sub);
    State.subscriptions.push(sub);
    closeModal('modal-subscription');
    toast('✓ Subscrição guardada');
    renderSubscriptions();
  } catch(e) { toast('❌ Erro ao guardar'); }
}

async function deleteSub(idx) {
  if (!confirm('Remover esta subscrição?')) return;
  try {
    await Sheets.deleteSubscription(idx);
    State.subscriptions.splice(idx, 1);
    toast('Subscrição removida');
    renderSubscriptions();
  } catch(e) { toast('❌ Erro ao apagar'); }
}

// ─── OBJETIVOS & PLANEAMENTO ──────────────────────────────────────────────────

const GOAL_TYPE_LABELS = {
  children: 'Filhos', emergency: 'Fundo de Emergência',
  retirement: 'Reforma / PPR', house: 'Casa',
  travel: 'Viagem', other: 'Outro',
};

function renderPlanning() {
  const goalsEl = document.getElementById('goals-list');
  const emptyEl = document.getElementById('goals-empty');

  if (State.goals.length === 0) {
    goalsEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    goalsEl.innerHTML = State.goals.map((g, idx) => {
      const target  = parseFloat(g.valor_alvo) || 0;
      const saved   = parseFloat(g.valor_poupado) || 0;
      const monthly = parseFloat(g.contribuicao_mensal) || 0;
      const pct     = target > 0 ? Math.min(100, Math.round((saved/target)*100)) : 0;
      const remaining = target - saved;
      const months  = monthly > 0 ? Math.ceil(remaining/monthly) : null;
      const eta     = months ? new Date(Date.now() + months*30*24*3600*1000).getFullYear() : g.ano_prazo || '–';

      return `<div class="goal-card">
        <div class="goal-header">
          <div class="goal-emoji">${g.emoji || '🎯'}</div>
          <div class="goal-info">
            <div class="goal-name">${g.nome}</div>
            <div class="goal-type">${GOAL_TYPE_LABELS[g.tipo] || g.tipo}</div>
          </div>
          <div class="goal-amounts">
            <div class="goal-saved-val">${formatEur(saved)}</div>
            <div class="goal-target-val">de ${formatEur(target)}</div>
          </div>
          <button class="goal-delete" data-idx="${idx}" title="Apagar">✕</button>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="goal-footer">
          <span>${pct}% concluído</span>
          <span>${monthly > 0 ? formatEur(monthly)+'/mês' : 'sem contribuição definida'}</span>
          <span>Meta: ${g.ano_prazo || eta}</span>
        </div>
      </div>`;
    }).join('');

    goalsEl.querySelectorAll('.goal-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteGoal(parseInt(btn.dataset.idx)));
    });
  }
}

async function saveGoal() {
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  if (!name || !target) { toast('⚠️ Preencha nome e valor alvo'); return; }

  const goal = {
    id:                  genId(),
    nome:                name,
    emoji:               document.getElementById('goal-emoji').value || '🎯',
    tipo:                document.getElementById('goal-type').value,
    valor_alvo:          target.toFixed(2),
    valor_poupado:       (parseFloat(document.getElementById('goal-saved').value)||0).toFixed(2),
    contribuicao_mensal: (parseFloat(document.getElementById('goal-monthly').value)||0).toFixed(2),
    ano_prazo:           document.getElementById('goal-year').value,
  };
  try {
    await Sheets.addGoal(goal);
    State.goals.push(goal);
    closeModal('modal-goal');
    toast('✓ Objetivo guardado');
    renderPlanning();
  } catch(e) { toast('❌ Erro ao guardar'); }
}

async function deleteGoal(idx) {
  if (!confirm('Apagar este objetivo?')) return;
  try {
    await Sheets.deleteGoal(idx);
    State.goals.splice(idx, 1);
    toast('Objetivo apagado');
    renderPlanning();
  } catch(e) { toast('❌ Erro ao apagar'); }
}

// ─── CALCULADORA DE INVESTIMENTO ─────────────────────────────────────────────

let chartInvestment = null;

document.getElementById('btn-calculate').addEventListener('click', () => {
  const initial = parseFloat(document.getElementById('calc-initial').value) || 0;
  const monthly = parseFloat(document.getElementById('calc-monthly').value) || 0;
  const rate    = parseFloat(document.getElementById('calc-rate').value) / 100;
  const years   = parseInt(document.getElementById('calc-years').value) || 1;

  const monthlyRate = rate / 12;
  let balance = initial;
  let totalInvested = initial;
  const dataPoints = [{ year: 0, balance: initial, invested: initial }];

  // Simulamos mês a mês com juros compostos
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + monthly;
      totalInvested += monthly;
    }
    dataPoints.push({ year: y, balance, invested: totalInvested });
  }

  const finalValue = balance;
  const gain = finalValue - totalInvested;

  document.getElementById('calc-final-value').textContent = formatEur(finalValue);
  document.getElementById('calc-invested').textContent    = formatEur(totalInvested);
  document.getElementById('calc-gain').textContent        = formatEur(gain);
  document.getElementById('calc-result').classList.remove('hidden');

  if (chartInvestment) chartInvestment.destroy();
  const ctx = document.getElementById('chart-investment').getContext('2d');
  chartInvestment = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dataPoints.map(d => `Ano ${d.year}`),
      datasets: [
        {
          label: 'Valor total',
          data: dataPoints.map(d => d.balance),
          borderColor: '#4db87a', backgroundColor: 'rgba(77,184,122,0.1)',
          fill: true, tension: 0.3, borderWidth: 2,
        },
        {
          label: 'Total investido',
          data: dataPoints.map(d => d.invested),
          borderColor: '#d4a853', backgroundColor: 'transparent',
          fill: false, tension: 0, borderWidth: 2, borderDash: [4,4],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9ba3b8', font: { family:'Inter', size: 11 } } } },
      scales: {
        x: { grid: { color: '#252a38' }, ticks: { color: '#5c6480', font: { size: 10 } } },
        y: { grid: { color: '#252a38' }, ticks: { color: '#5c6480', callback: v => '€'+Math.round(v/1000)+'k' } },
      },
    },
  });
});

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────

let chartAnnualCat = null;
let chartAnnualSav = null;

function renderReports() {
  const y = State.reportYear;
  document.getElementById('reports-year-label').textContent = `Ano de ${y}`;

  const yearTxs = State.transactions.filter(tx => tx.data && new Date(tx.data).getFullYear() === y);

  const annualIncome   = yearTxs.filter(t=>t.tipo==='income').reduce((s,t)=>s+parseFloat(t.valor)||0,0);
  const annualExpenses = yearTxs.filter(t=>t.tipo==='expense').reduce((s,t)=>s+parseFloat(t.valor)||0,0);
  const annualSavings  = annualIncome - annualExpenses;
  const annualSubs     = State.subscriptions.filter(s=>s.ativo!=='false').reduce((s,sub)=>s+parseFloat(sub.valor_mensal)*12||0,0);

  document.getElementById('annual-income').textContent   = formatEur(annualIncome);
  document.getElementById('annual-expenses').textContent = formatEur(annualExpenses);
  document.getElementById('annual-savings').textContent  = formatEur(annualSavings);
  document.getElementById('annual-subs').textContent     = formatEur(annualSubs);

  // Barras empilhadas por categoria, mês a mês
  const monthLabels = MONTHS_PT.map(m => m.slice(0,3));
  const catDatasets = CAT_ORDER.filter(k => k !== 'rendimentos').map(k => ({
    label: CATEGORIES[k].label,
    data: Array.from({length:12}, (_, m) => {
      return yearTxs
        .filter(t => t.tipo==='expense' && t.categoria===k && new Date(t.data).getMonth()===m)
        .reduce((s,t)=>s+parseFloat(t.valor)||0, 0);
    }),
    backgroundColor: CATEGORIES[k].color + 'bb',
    borderRadius: 2,
  }));

  if (chartAnnualCat) chartAnnualCat.destroy();
  chartAnnualCat = new Chart(document.getElementById('chart-annual-categories').getContext('2d'), {
    type: 'bar',
    data: { labels: monthLabels, datasets: catDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color:'#9ba3b8', font:{family:'Inter',size:10}, boxWidth:10, padding:8 } } },
      scales: {
        x: { stacked: true, grid:{color:'#252a38'}, ticks:{color:'#5c6480',font:{size:10}} },
        y: { stacked: true, grid:{color:'#252a38'}, ticks:{color:'#5c6480',callback:v=>'€'+v} },
      },
    },
  });

  // Linha de poupança mensal
  const monthlySavings = Array.from({length:12}, (_, m) => {
    const mTxs = yearTxs.filter(t => new Date(t.data).getMonth() === m);
    const inc = mTxs.filter(t=>t.tipo==='income').reduce((s,t)=>s+parseFloat(t.valor)||0,0);
    const exp = mTxs.filter(t=>t.tipo==='expense').reduce((s,t)=>s+parseFloat(t.valor)||0,0);
    return inc - exp;
  });

  if (chartAnnualSav) chartAnnualSav.destroy();
  chartAnnualSav = new Chart(document.getElementById('chart-annual-savings').getContext('2d'), {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Poupança',
        data: monthlySavings,
        backgroundColor: monthlySavings.map(v => v >= 0 ? 'rgba(77,184,122,0.7)' : 'rgba(224,92,92,0.7)'),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid:{color:'#252a38'}, ticks:{color:'#5c6480',font:{size:10}} },
        y: { grid:{color:'#252a38'}, ticks:{color:'#5c6480',callback:v=>'€'+v} },
      },
    },
  });
}

document.getElementById('btn-prev-year').addEventListener('click', () => { State.reportYear--; renderReports(); });
document.getElementById('btn-next-year').addEventListener('click', () => { State.reportYear++; renderReports(); });

// ─── IMPORTAÇÃO DE CSV ────────────────────────────────────────────────────────

let csvParsedRows = [];

function setupCSVImport() {
  const dropZone = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    processCSVFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => processCSVFile(fileInput.files[0]));
}

function processCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    // Detectamos o separador mais comum (vírgula ou ponto e vírgula)
    const sep = text.includes(';') ? ';' : ',';
    const lines = text.trim().split('\n');
    const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g,''));

    // Populamos os selects de mapeamento com os cabeçalhos do CSV
    ['csv-col-date','csv-col-desc','csv-col-amount'].forEach(id => {
      const sel = document.getElementById(id);
      sel.innerHTML = headers.map((h,i) => `<option value="${i}">${h}</option>`).join('');
    });

    csvParsedRows = lines.slice(1).map(line => line.split(sep).map(c => c.trim().replace(/"/g,'')));

    // Pré-visualizamos as primeiras 5 linhas com categorização automática
    showCSVPreview(headers);
    document.getElementById('csv-preview').classList.remove('hidden');
    document.getElementById('btn-import-confirm').classList.remove('hidden');
  };
  reader.readAsText(file, 'UTF-8');
}

function showCSVPreview(headers) {
  const dIdx = parseInt(document.getElementById('csv-col-date').value);
  const descIdx = parseInt(document.getElementById('csv-col-desc').value);
  const amtIdx  = parseInt(document.getElementById('csv-col-amount').value);

  const preview = csvParsedRows.slice(0,10).map(row => {
    const desc = row[descIdx] || '';
    const guessed = guessCategory(desc);
    return txHTML({
      id: genId(), data: row[dIdx], descricao: desc,
      valor: Math.abs(parseFloat(row[amtIdx]?.replace(',','.')) || 0).toFixed(2),
      tipo: (parseFloat(row[amtIdx]?.replace(',','.')) || 0) >= 0 ? 'income' : 'expense',
      categoria: guessed, subcategoria: '', dono: 'joint', recorrente: 'false',
    }, false);
  }).join('');

  document.getElementById('csv-rows-preview').innerHTML = preview ||
    '<p style="color:var(--text3);padding:16px">Não foi possível ler as linhas do CSV.</p>';
}

async function importCSV() {
  const dIdx    = parseInt(document.getElementById('csv-col-date').value);
  const descIdx = parseInt(document.getElementById('csv-col-desc').value);
  const amtIdx  = parseInt(document.getElementById('csv-col-amount').value);

  let count = 0;
  for (const row of csvParsedRows) {
    const rawAmt = parseFloat(row[amtIdx]?.replace(',','.')) || 0;
    if (rawAmt === 0) continue;

    const tx = {
      id:           genId(),
      data:         row[dIdx],
      descricao:    row[descIdx] || 'Sem descrição',
      valor:        Math.abs(rawAmt).toFixed(2),
      tipo:         rawAmt >= 0 ? 'income' : 'expense',
      categoria:    guessCategory(row[descIdx] || ''),
      subcategoria: '',
      dono:         'joint',
      recorrente:   'false',
      notas:        '',
    };
    try {
      await Sheets.addTransaction(tx);
      State.transactions.push(tx);
      count++;
    } catch(e) { console.error('Erro ao importar linha:', e); }
  }

  closeModal('modal-csv');
  toast(`✓ ${count} transações importadas`);
  renderDashboard();
  renderTransactions();
}

// ─── DEFINIÇÕES ───────────────────────────────────────────────────────────────

function renderSettings() {
  document.getElementById('settings-my-name').value      = State.settings.myName;
  document.getElementById('settings-partner-name').value = State.settings.partnerName;
  const sheetId = Sheets.getSheetId();
  document.getElementById('settings-sheet-id').textContent = sheetId || '–';
  if (sheetId) {
    document.getElementById('settings-sheet-link').href =
      `https://docs.google.com/spreadsheets/d/${sheetId}`;
  }
}

async function saveProfile() {
  const myName      = document.getElementById('settings-my-name').value.trim();
  const partnerName = document.getElementById('settings-partner-name').value.trim();
  if (!myName || !partnerName) { toast('⚠️ Preencha os nomes'); return; }
  State.settings.myName      = myName;
  State.settings.partnerName = partnerName;
  localStorage.setItem('gf_settings', JSON.stringify(State.settings));
  try {
    await Sheets.saveSetting('myName', myName);
    await Sheets.saveSetting('partnerName', partnerName);
    toast('✓ Perfil guardado');
    // Actualizamos a sidebar e os tabs
    document.getElementById('sidebar-user-name').textContent = myName;
    document.getElementById('tab-me').textContent      = myName;
    document.getElementById('tab-partner').textContent = partnerName;
  } catch(e) { toast('✓ Guardado localmente'); }
}

async function syncData() {
  toast('↻ A sincronizar...');
  try {
    State.transactions  = await Sheets.getTransactions();
    State.subscriptions = await Sheets.getSubscriptions();
    State.goals         = await Sheets.getGoals();
    toast('✓ Sincronizado com o Google Sheets');
    renderDashboard();
  } catch(e) { toast('❌ Erro na sincronização'); }
}

function exportCSV() {
  const headers = ['data','descricao','valor','tipo','categoria','subcategoria','dono'];
  const rows = State.transactions.map(t =>
    headers.map(h => `"${t[h] || ''}"`).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `financas-${State.currentYear}.csv`;
  a.click();
}

// ─── INICIALIZAÇÃO DA APP ─────────────────────────────────────────────────────

/** Carrega todos os dados do Google Sheets e inicia a app. */
async function initApp(sheetId) {
  Sheets.setSheetId(sheetId);

  // Mostramos o ecrã principal imediatamente enquanto carregamos os dados
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-setup').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Restauramos definições locais (mais rápido que ir buscar ao Sheets)
  const localSettings = localStorage.getItem('gf_settings');
  if (localSettings) {
    Object.assign(State.settings, JSON.parse(localSettings));
  }

  document.getElementById('sidebar-user-name').textContent = State.settings.myName;
  document.getElementById('tab-me').textContent            = State.settings.myName;
  document.getElementById('tab-partner').textContent       = State.settings.partnerName;

  updateMonthLabel();

  try {
    // Carregamos todos os dados em paralelo para ser mais rápido
    const [txs, subs, goals, settings] = await Promise.all([
      Sheets.getTransactions(),
      Sheets.getSubscriptions(),
      Sheets.getGoals(),
      Sheets.readSettings(),
    ]);
    State.transactions  = txs;
    State.subscriptions = subs;
    State.goals         = goals;

    // Se houver nomes guardados no Sheets, usamo-los
    if (settings.myName)      State.settings.myName      = settings.myName;
    if (settings.partnerName) State.settings.partnerName = settings.partnerName;
    localStorage.setItem('gf_settings', JSON.stringify(State.settings));

    document.getElementById('sidebar-user-name').textContent = State.settings.myName;
    document.getElementById('tab-me').textContent            = State.settings.myName;
    document.getElementById('tab-partner').textContent       = State.settings.partnerName;
  } catch(e) {
    console.warn('Não foi possível carregar todos os dados:', e);
    toast('⚠️ Problema ao carregar dados. Verifique a ligação.');
  }

  goTo('dashboard');
  renderSettings();
  setupEventListeners();
  setupCSVImport();
}

/** Liga todos os event listeners da app. Chamado uma vez depois do login. */
function setupEventListeners() {
  // Navegação
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => goTo(btn.dataset.page));
  });
  document.querySelectorAll('.card-action[data-page]').forEach(el => {
    el.addEventListener('click', () => goTo(el.dataset.page));
  });

  // Tabs de dono (Casal / Eu / Parceiro)
  document.querySelectorAll('.owner-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.owner-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      State.activeOwner = tab.dataset.owner;
      renderDashboard();
    });
  });

  // Modal de transação
  document.getElementById('btn-add-transaction').addEventListener('click', openAddTransaction);
  document.getElementById('btn-add-transaction-2').addEventListener('click', openAddTransaction);
  document.getElementById('btn-save-transaction').addEventListener('click', saveTx);

  // Botões de tipo/dono/recorrente no modal (toggle)
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.type-toggle').querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelectorAll('.owner-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.type-toggle').querySelectorAll('.owner-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelectorAll('.recur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.type-toggle').querySelectorAll('.recur-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Filtros de transações (actualizam ao mudar)
  ['filter-category','filter-owner','filter-type'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTransactions);
  });
  document.getElementById('filter-search').addEventListener('input', renderTransactions);

  // Subscrições
  document.getElementById('btn-add-sub').addEventListener('click', () => openModal('modal-subscription'));
  document.getElementById('btn-save-sub').addEventListener('click', saveSub);

  // Objetivos
  document.getElementById('btn-add-goal').addEventListener('click', () => openModal('modal-goal'));
  document.getElementById('btn-add-first-goal').addEventListener('click', () => openModal('modal-goal'));
  document.getElementById('btn-save-goal').addEventListener('click', saveGoal);

  // CSV
  document.getElementById('btn-import-csv').addEventListener('click', () => openModal('modal-csv'));
  document.getElementById('btn-import-confirm').addEventListener('click', importCSV);

  // Definições
  document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
  document.getElementById('btn-sync').addEventListener('click', syncData);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('Sair da aplicação?')) {
      Sheets.logout();
      location.reload();
    }
  });
}

// ─── ECRÃ DE LOGIN ────────────────────────────────────────────────────────────

document.getElementById('btn-google-login').addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-login');
  btn.textContent = 'A entrar...';
  btn.disabled = true;

  try {
    await Sheets.login();

    // Verificamos se já há uma folha configurada
    const savedSheetId = Sheets.getSheetId();
    if (savedSheetId) {
      // Utilizador que já configurou antes — entramos diretamente
      await initApp(savedSheetId);
    } else {
      // Primeira vez — mostramos o ecrã de setup
      document.getElementById('screen-login').classList.add('hidden');
      document.getElementById('screen-setup').classList.remove('hidden');
    }
  } catch(e) {
    if (e.message === 'CLIENT_ID_NOT_SET') {
      alert('⚠️ A aplicação ainda não está configurada.\n\nSubstitua "SEU_CLIENT_ID_AQUI" no ficheiro sheets.js pelo Client ID do Google Cloud Console.\n\nConsulte o README.md para instruções detalhadas.');
    } else {
      toast('❌ Erro no login: ' + e.message);
    }
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg> Entrar com Google';
    btn.disabled = false;
  }
});

// ─── ECRÃ DE SETUP (primeira vez) ────────────────────────────────────────────

document.getElementById('btn-create-sheet').addEventListener('click', async () => {
  const btn = document.getElementById('btn-create-sheet');
  btn.textContent = 'A criar folha...';
  btn.disabled = true;

  const sheetName = document.getElementById('setup-sheet-name').value || 'Finanças Familiar';
  const myName    = document.getElementById('setup-user-name').value.trim() || 'Eu';
  const partnerName = document.getElementById('setup-partner-name').value.trim() || 'Parceiro/a';

  State.settings.myName      = myName;
  State.settings.partnerName = partnerName;
  localStorage.setItem('gf_settings', JSON.stringify(State.settings));

  try {
    const sheetId = await Sheets.createSheet(sheetName);
    // Guardamos os nomes na folha
    await Sheets.saveSetting('myName', myName);
    await Sheets.saveSetting('partnerName', partnerName);
    await initApp(sheetId);
  } catch(e) {
    toast('❌ Erro ao criar folha: ' + e.message);
    btn.textContent = 'Criar folha e começar →';
    btn.disabled = false;
  }
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
// Quando a página carrega, verificamos se há uma sessão activa.
// Se sim, saltamos o ecrã de login directamente para a app.

window.addEventListener('load', async () => {
  const hasSession = Sheets.restoreSession();
  const savedSheetId = Sheets.getSheetId();

  if (hasSession && savedSheetId) {
    // Sessão activa — entramos directamente (sem pedir login outra vez)
    try {
      await initApp(savedSheetId);
    } catch(e) {
      // Token expirou — mostramos o ecrã de login
      document.getElementById('screen-login').classList.remove('hidden');
    }
  } else {
    // Primeira visita ou sessão expirada — mostramos o login
    document.getElementById('screen-login').classList.remove('hidden');
  }
});
