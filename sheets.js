/**
 * sheets.js — Integração com Google Sheets API
 *
 * Este módulo trata de toda a comunicação com o Google:
 * 1. Autenticação via Google Identity Services (OAuth 2.0)
 * 2. Criar/ler/escrever dados na folha Google Sheets
 *
 * CONFIGURAÇÃO NECESSÁRIA:
 * Substitua CLIENT_ID pelo ID da sua aplicação Google Cloud.
 * Consulte o README.md para instruções passo-a-passo.
 */

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
// ⚠️  Substitua este valor pelo Client ID do Google Cloud Console
const GOOGLE_CLIENT_ID = '926149865530-f1v1cee1fr2umm4sc4mk5470qu7u44if.apps.googleusercontent.com';

// Permissões que pedimos ao utilizador:
// - spreadsheets (ler e escrever nas folhas)
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

// Nome das abas dentro da folha Google Sheets
const SHEET_NAMES = {
  transactions:  'Transacoes',
  subscriptions: 'Subscricoes',
  goals:         'Objetivos',
  settings:      'Definicoes',
};

// ─── ESTADO INTERNO ───────────────────────────────────────────────────────────
let _accessToken = null;   // token OAuth temporário
let _sheetId     = null;   // ID da folha Google Sheets activa

// ─── INICIALIZAÇÃO DO GOOGLE IDENTITY SERVICES ────────────────────────────────

/**
 * Carrega o script do Google Identity Services dinamicamente.
 * Isto é chamado uma vez quando a página carrega.
 */
function loadGoogleScript() {
  return new Promise((resolve) => {
    if (window.google) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

/**
 * Inicia o fluxo de login OAuth.
 * Abre um popup do Google onde o utilizador escolhe a conta
 * e autoriza o acesso às suas folhas.
 */
async function googleLogin() {
  await loadGoogleScript();

  return new Promise((resolve, reject) => {
    // Verificamos se o CLIENT_ID foi configurado
    if (GOOGLE_CLIENT_ID.includes('SEU_CLIENT_ID')) {
      reject(new Error('CLIENT_ID_NOT_SET'));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        _accessToken = response.access_token;
        // Guardamos o token na sessão (apenas dura enquanto o browser está aberto)
        sessionStorage.setItem('gf_token', _accessToken);
        resolve(_accessToken);
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Restaura a sessão se o utilizador já fez login anteriormente
 * (dentro da mesma sessão de browser).
 */
function restoreSession() {
  const saved = sessionStorage.getItem('gf_token');
  if (saved) {
    _accessToken = saved;
    return true;
  }
  return false;
}

/** Remove todos os dados de sessão e faz logout. */
function googleLogout() {
  _accessToken = null;
  _sheetId = null;
  sessionStorage.clear();
  localStorage.removeItem('gf_sheet_id');
  localStorage.removeItem('gf_settings');
}

// ─── OPERAÇÕES NA API DO GOOGLE SHEETS ───────────────────────────────────────

/**
 * Função base para todas as chamadas à API.
 * Gere automaticamente os headers de autenticação.
 */
async function sheetsAPI(method, url, body = null) {
  if (!_accessToken) throw new Error('Sem sessão activa');

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${_accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Cria uma nova folha Google Sheets com o nome indicado,
 * e inicializa todas as abas com os cabeçalhos corretos.
 * Retorna o ID da folha criada.
 */
async function createSheet(name) {
  // 1. Criar o ficheiro Sheets
  const created = await sheetsAPI('POST',
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      properties: { title: name },
      sheets: [
        // Cada sheet (aba) com os seus cabeçalhos
        { properties: { title: SHEET_NAMES.transactions } },
        { properties: { title: SHEET_NAMES.subscriptions } },
        { properties: { title: SHEET_NAMES.goals } },
        { properties: { title: SHEET_NAMES.settings } },
      ],
    }
  );

  const sheetId = created.spreadsheetId;

  // 2. Inicializar cabeçalhos em cada aba
  await sheetsAPI('PUT',
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
    {
      valueInputOption: 'RAW',
      data: [
        {
          range: `${SHEET_NAMES.transactions}!A1:J1`,
          values: [['id','data','descricao','valor','tipo','categoria','subcategoria','dono','recorrente','notas']],
        },
        {
          range: `${SHEET_NAMES.subscriptions}!A1:G1`,
          values: [['id','nome','valor_mensal','categoria','dono','dia_cobranca','ativo']],
        },
        {
          range: `${SHEET_NAMES.goals}!A1:H1`,
          values: [['id','nome','emoji','tipo','valor_alvo','valor_poupado','contribuicao_mensal','ano_prazo']],
        },
        {
          range: `${SHEET_NAMES.settings}!A1:B1`,
          values: [['chave','valor']],
        },
      ],
    }
  );

  _sheetId = sheetId;
  localStorage.setItem('gf_sheet_id', sheetId);
  return sheetId;
}

/**
 * Lê todas as linhas de uma aba específica.
 * Retorna um array de objetos, onde cada chave é o cabeçalho da coluna.
 */
async function readSheet(sheetName) {
  if (!_sheetId) throw new Error('Sem folha configurada');

  const data = await sheetsAPI('GET',
    `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${sheetName}`
  );

  const rows = data.values || [];
  if (rows.length < 2) return []; // só tem cabeçalhos ou está vazia

  const headers = rows[0];
  // Convertemos cada linha num objeto usando os cabeçalhos como chaves
  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );
}

/**
 * Acrescenta uma nova linha no fim de uma aba.
 * Recebe um objeto e mapeia os valores pela ordem dos cabeçalhos.
 */
async function appendRow(sheetName, headers, rowObj) {
  if (!_sheetId) throw new Error('Sem folha configurada');

  const values = [headers.map(h => rowObj[h] ?? '')];

  await sheetsAPI('POST',
    `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${sheetName}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values }
  );
}

/**
 * Apaga uma linha específica de uma aba.
 * Para isso, encontramos o sheetId interno e usamos a API de batchUpdate.
 */
async function deleteRow(sheetName, rowIndex) {
  if (!_sheetId) throw new Error('Sem folha configurada');

  // Primeiro precisamos do ID numérico interno da aba (diferente do nome)
  const meta = await sheetsAPI('GET',
    `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}?fields=sheets.properties`
  );
  const sheet = meta.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada`);

  const internalId = sheet.properties.sheetId;

  await sheetsAPI('POST',
    `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}:batchUpdate`,
    {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: internalId,
            dimension: 'ROWS',
            startIndex: rowIndex + 1, // +1 porque a linha 0 são os cabeçalhos
            endIndex:   rowIndex + 2,
          },
        },
      }],
    }
  );
}

/**
 * Lê as definições guardadas (nome do utilizador, parceiro, etc.)
 * e devolve-as como um objeto chave→valor.
 */
async function readSettings() {
  try {
    const rows = await readSheet(SHEET_NAMES.settings);
    return Object.fromEntries(rows.map(r => [r.chave, r.valor]));
  } catch {
    return {};
  }
}

/**
 * Guarda uma definição na aba de definições.
 * Se a chave já existir, atualiza o valor em vez de duplicar.
 */
async function saveSetting(key, value) {
  if (!_sheetId) return;

  // Lemos todas as definições para verificar se a chave já existe
  const data = await sheetsAPI('GET',
    `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${SHEET_NAMES.settings}`
  );
  const rows = data.values || [['chave','valor']];
  const rowIndex = rows.findIndex(r => r[0] === key);

  if (rowIndex === -1) {
    // Chave nova — acrescentamos uma linha
    await appendRow(SHEET_NAMES.settings, ['chave','valor'], { chave: key, valor: value });
  } else {
    // Chave existente — atualizamos a célula
    await sheetsAPI('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${SHEET_NAMES.settings}!B${rowIndex + 1}?valueInputOption=RAW`,
      { values: [[value]] }
    );
  }
}

// ─── API PÚBLICA ──────────────────────────────────────────────────────────────
// Estas são as funções que o app.js vai usar.

const Sheets = {
  // Auth
  login:          googleLogin,
  logout:         googleLogout,
  restoreSession,
  getToken:       () => _accessToken,
  getSheetId:     () => _sheetId || localStorage.getItem('gf_sheet_id'),
  setSheetId:     (id) => { _sheetId = id; localStorage.setItem('gf_sheet_id', id); },

  // Folha
  createSheet,

  // Transações
  async getTransactions() {
    return readSheet(SHEET_NAMES.transactions);
  },
  async addTransaction(tx) {
    const headers = ['id','data','descricao','valor','tipo','categoria','subcategoria','dono','recorrente','notas'];
    await appendRow(SHEET_NAMES.transactions, headers, tx);
  },
  async deleteTransaction(index) {
    await deleteRow(SHEET_NAMES.transactions, index);
  },

  // Subscrições
  async getSubscriptions() {
    return readSheet(SHEET_NAMES.subscriptions);
  },
  async addSubscription(sub) {
    const headers = ['id','nome','valor_mensal','categoria','dono','dia_cobranca','ativo'];
    await appendRow(SHEET_NAMES.subscriptions, headers, sub);
  },
  async deleteSubscription(index) {
    await deleteRow(SHEET_NAMES.subscriptions, index);
  },

  // Objetivos
  async getGoals() {
    return readSheet(SHEET_NAMES.goals);
  },
  async addGoal(goal) {
    const headers = ['id','nome','emoji','tipo','valor_alvo','valor_poupado','contribuicao_mensal','ano_prazo'];
    await appendRow(SHEET_NAMES.goals, headers, goal);
  },
  async deleteGoal(index) {
    await deleteRow(SHEET_NAMES.goals, index);
  },

  // Definições
  readSettings,
  saveSetting,
};

// Tornamos Sheets disponível globalmente
window.Sheets = Sheets;
