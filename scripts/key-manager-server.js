/**
 * LLM API Key Manager + Smart Model Router
 * - Round-robin key rotation with auto-failover
 * - Dead key removal (auth/quota errors)
 * - Model-aware routing (pass-through model from request)
 * - Per-model and per-key statistics
 * - Admin API for key/model management
 * - OpenAI-compatible proxy endpoint
 */
const http = require('http');
const https = require('https');
const fs = require('fs');

const CONFIG_PATH = '/opt/key-manager/keys.json';
const PORT = 9876;
const MAX_FAIL = 3;

let keys = [];
let currentIdx = 0;
let modelStats = {};  // {modelId: {requests, tokens, errors, lastUsed}}
let stats = { totalRequests: 0, totalFailovers: 0, startedAt: new Date().toISOString() };

function loadKeys() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const d = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      keys = d.keys || [];
      stats = { ...stats, ...d.stats };
      modelStats = d.modelStats || {};
      console.log('[init] Loaded ' + keys.length + ' keys, ' + Object.keys(modelStats).length + ' model stats');
    }
  } catch (e) { console.error('[init] Load failed:', e.message); }
}

function saveKeys() {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify({ keys, stats, modelStats }, null, 2)); }
  catch (e) { console.error('[save] Failed:', e.message); }
}

function getActiveKeys() { return keys.filter(k => k.active); }

function getNextKey(model) {
  // Route to correct provider based on model
  const isMinimax = model && model.toLowerCase().includes('minimax');
  const active = keys.filter(k => {
    if (!k.active) return false;
    if (isMinimax) return k.provider === 'minimax';
    return k.provider !== 'minimax'; // SiliconFlow keys for non-minimax models
  });
  if (!active.length) return null;
  currentIdx = currentIdx % active.length;
  const k = active[currentIdx];
  currentIdx = (currentIdx + 1) % active.length;
  return k;
}

function markKeyFailed(key, error) {
  key.failCount = (key.failCount || 0) + 1;
  key.lastError = error;
  key.lastErrorAt = new Date().toISOString();
  if (key.failCount >= MAX_FAIL) {
    key.active = false;
    key.deactivatedAt = new Date().toISOString();
    key.deactivateReason = error;
    console.log('[key] Deactivated: ...' + key.key.slice(-8) + ' reason: ' + error);
  }
  saveKeys();
}

function markKeySuccess(key, tokens, model) {
  key.failCount = 0;
  key.lastUsed = new Date().toISOString();
  key.totalTokens = (key.totalTokens || 0) + (tokens || 0);
  key.requestCount = (key.requestCount || 0) + 1;
  // Track per-model stats
  if (model) {
    if (!modelStats[model]) modelStats[model] = { requests: 0, tokens: 0, errors: 0, lastUsed: null };
    modelStats[model].requests++;
    modelStats[model].tokens += (tokens || 0);
    modelStats[model].lastUsed = new Date().toISOString();
  }
  saveKeys();
}

function trackModelError(model) {
  if (model) {
    if (!modelStats[model]) modelStats[model] = { requests: 0, tokens: 0, errors: 0, lastUsed: null };
    modelStats[model].errors++;
  }
}

function isFatalError(statusCode, body) {
  if (statusCode === 401 || statusCode === 403) return 'auth_failed';
  if (statusCode === 429) return 'rate_limited';
  try {
    const j = JSON.parse(body);
    const msg = (j.error && j.error.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('balance') || msg.includes('insufficient'))
      return 'quota_exhausted';
    if (msg.includes('invalid') && msg.includes('key')) return 'invalid_key';
  } catch (e) {}
  return null;
}

function proxyRequest(reqBody, keyObj, callback) {
  const parsed = new URL(keyObj.baseUrl);
  const postData = JSON.stringify(reqBody);
  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + keyObj.key,
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  const proto = parsed.protocol === 'https:' ? https : http;
  const req = proto.request(opts, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => callback(null, res.statusCode, res.headers, body));
  });
  req.on('error', e => callback(e));
  req.setTimeout(120000, () => { req.destroy(); callback(new Error('timeout')); });
  req.write(postData);
  req.end();
}

// ── STRICT MODEL WHITELIST ──────────────────────────────────
// ONLY these 5 models are allowed. Calling anything else may burn the key!
const ALLOWED_MODELS = [
  'deepseek-ai/DeepSeek-V3.2',
  'zai-org/GLM-4.6V',
  'moonshotai/Kimi-K2-Thinking',
  'Pro/MiniMaxAI/MiniMax-M2.5',
  'Qwen/Qwen3-VL-235B-A22B-Thinking',
  'MiniMax-M2.5-highspeed',
];

const DEFAULT_MODEL = 'MiniMax-M2.5-highspeed';

// Friendly aliases -> exact whitelisted model ID
const MODEL_ALIASES = {
  'deepseek': DEFAULT_MODEL,
  'deepseek-v3.2': DEFAULT_MODEL,
  'deepseek-v3': DEFAULT_MODEL,
  'glm': 'zai-org/GLM-4.6V',
  'glm-4.6v': 'zai-org/GLM-4.6V',
  'glm-4.6': 'zai-org/GLM-4.6V',
  'kimi': 'moonshotai/Kimi-K2-Thinking',
  'kimi-k2': 'moonshotai/Kimi-K2-Thinking',
  'minimax': 'MiniMax-M2.5-highspeed',
  'minimax-m2': 'MiniMax-M2.5-highspeed',
  'minimax-m2.5': 'MiniMax-M2.5-highspeed',
  'minimax-highspeed': 'MiniMax-M2.5-highspeed',
  'qwen': 'Qwen/Qwen3-VL-235B-A22B-Thinking',
  'qwen3': 'Qwen/Qwen3-VL-235B-A22B-Thinking',
  'qwen3-vl': 'Qwen/Qwen3-VL-235B-A22B-Thinking',
};

function resolveModel(requestModel) {
  if (!requestModel) return DEFAULT_MODEL;
  // Check exact match against whitelist first
  if (ALLOWED_MODELS.includes(requestModel)) return requestModel;
  // Check aliases
  const lower = requestModel.toLowerCase();
  for (const [alias, real] of Object.entries(MODEL_ALIASES)) {
    if (lower === alias || lower.includes(alias)) return real;
  }
  // NOT in whitelist — return null to block
  return null;
}

function handleProxy(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let reqBody;
    try { reqBody = JSON.parse(body); } catch (e) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:{message:'Invalid JSON'}}));
      return;
    }
    // Fix unsupported roles: convert 'developer' to 'system'
    if (reqBody.messages) {
      reqBody.messages = reqBody.messages.map(m =>
        m.role === 'developer' ? { ...m, role: 'system' } : m
      );
    }
    // Resolve model alias and enforce whitelist
    const originalModel = reqBody.model;
    const resolvedModel = resolveModel(reqBody.model);
    if (!resolvedModel) {
      console.log('[BLOCKED] Model not in whitelist: ' + originalModel);
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:{message:'Model "' + originalModel + '" is not allowed. Allowed: ' + ALLOWED_MODELS.join(', ')}}));
      return;
    }
    reqBody.model = resolvedModel;
    console.log('[route] ' + (originalModel || 'none') + ' -> ' + resolvedModel);
    stats.totalRequests++;
    tryWithFailover(reqBody, resolvedModel, 0, res);
  });
}

function tryWithFailover(reqBody, model, attempt, res) {
  const active = getActiveKeys();
  if (!active.length) {
    res.writeHead(503, {'Content-Type':'application/json'});
    res.end(JSON.stringify({error:{message:'No active API keys available'}}));
    saveKeys(); return;
  }
  if (attempt >= active.length) {
    res.writeHead(502, {'Content-Type':'application/json'});
    res.end(JSON.stringify({error:{message:'All keys failed for this request'}}));
    return;
  }
  const keyObj = getNextKey(model);
  if (!keyObj) {
    res.writeHead(503, {'Content-Type':'application/json'});
    res.end(JSON.stringify({error:{message:'No active API keys'}}));
    return;
  }
  const keyHint = '...' + keyObj.key.slice(-8);
  console.log('[proxy] Attempt ' + (attempt+1) + ' key=' + keyHint + ' model=' + model);

  proxyRequest(reqBody, keyObj, (err, statusCode, headers, respBody) => {
    if (err) {
      console.log('[proxy] Network error key=' + keyHint + ': ' + err.message);
      markKeyFailed(keyObj, 'network:' + err.message);
      trackModelError(model);
      stats.totalFailovers++;
      tryWithFailover(reqBody, model, attempt + 1, res);
      return;
    }
    const fatal = isFatalError(statusCode, respBody);
    if (fatal) {
      console.log('[proxy] Fatal error key=' + keyHint + ': ' + fatal + ' status=' + statusCode);
      markKeyFailed(keyObj, fatal);
      trackModelError(model);
      stats.totalFailovers++;
      tryWithFailover(reqBody, model, attempt + 1, res);
      return;
    }
    // Success
    try {
      const j = JSON.parse(respBody);
      const tokens = j.usage ? j.usage.total_tokens : 0;
      markKeySuccess(keyObj, tokens, model);
    } catch (e) { markKeySuccess(keyObj, 0, model); }
    const fwdHeaders = {'Content-Type': headers['content-type'] || 'application/json'};
    res.writeHead(statusCode, fwdHeaders);
    res.end(respBody);
  });
}

// ── Admin API ──────────────────────────────────────────────
function handleAdmin(req, res, pathname) {
  if (pathname === '/admin/status' && req.method === 'GET') {
    const active = getActiveKeys();
    const keySummary = keys.map(k => ({
      key: '...' + k.key.slice(-8), provider: k.provider, active: k.active,
      failCount: k.failCount, requestCount: k.requestCount || 0,
      totalTokens: k.totalTokens || 0, lastUsed: k.lastUsed,
      lastError: k.lastError, addedAt: k.addedAt
    }));
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({
      activeKeys: active.length, totalKeys: keys.length, stats,
      allowedModels: ALLOWED_MODELS, modelStats, keys: keySummary, aliases: MODEL_ALIASES
    }, null, 2));
    return;
  }

  if (pathname === '/admin/keys' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        const newKeys = Array.isArray(d) ? d : [d];
        let added = 0;
        for (const nk of newKeys) {
          if (!nk.key || keys.find(k => k.key === nk.key)) continue;
          keys.push({
            key: nk.key, provider: nk.provider || 'siliconflow',
            baseUrl: nk.baseUrl || 'https://api.siliconflow.cn',
            active: true, failCount: 0, totalTokens: 0, requestCount: 0,
            addedAt: new Date().toISOString()
          });
          added++;
        }
        saveKeys();
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ added, total: keys.length }));
      } catch (e) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname.startsWith('/admin/keys/') && pathname.endsWith('/reactivate') && req.method === 'POST') {
    const parts = pathname.split('/');
    const suffix = parts[3];
    const k = keys.find(k => k.key.endsWith(suffix));
    if (k) {
      k.active = true; k.failCount = 0; k.lastError = null;
      delete k.deactivatedAt; delete k.deactivateReason;
      saveKeys();
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ reactivated: true }));
    } else {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Key not found' }));
    }
    return;
  }

  if (pathname.startsWith('/admin/keys/') && req.method === 'DELETE') {
    const suffix = pathname.split('/').pop();
    const idx = keys.findIndex(k => k.key.endsWith(suffix));
    if (idx >= 0) {
      keys.splice(idx, 1); saveKeys();
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ removed: true }));
    } else {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Key not found' }));
    }
    return;
  }

  if (pathname === '/admin/keys/batch' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        const keyList = d.keys || [];
        const provider = d.provider || 'siliconflow';
        const baseUrl = d.baseUrl || 'https://api.siliconflow.cn';
        let added = 0;
        for (const k of keyList) {
          const keyStr = typeof k === 'string' ? k : k.key;
          if (!keyStr || keys.find(x => x.key === keyStr)) continue;
          keys.push({
            key: keyStr, provider, baseUrl,
            active: true, failCount: 0, totalTokens: 0, requestCount: 0,
            addedAt: new Date().toISOString()
          });
          added++;
        }
        saveKeys();
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ added, total: keys.length }));
      } catch (e) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ error: 'Not found' }));
}

// ── OpenAI-compatible models endpoint ──────────────────────
function handleModels(req, res) {
  const list = ALLOWED_MODELS.map(id => ({ id, object: 'model', created: 0, owned_by: 'key-manager' }));
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ object: 'list', data: list }));
}

// ── Main Server ────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    res.end(); return;
  }
  if (pathname.startsWith('/admin/')) return handleAdmin(req, res, pathname);
  if (pathname === '/v1/chat/completions' && req.method === 'POST') return handleProxy(req, res);
  if (pathname === '/v1/models' && req.method === 'GET') return handleModels(req, res);
  if (pathname === '/health') {
    const active = getActiveKeys();
    res.writeHead(active.length > 0 ? 200 : 503, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: active.length > 0, activeKeys: active.length, totalKeys: keys.length }));
    return;
  }
  res.writeHead(404, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ error: 'Use /v1/chat/completions, /v1/models, /admin/*, or /health' }));
});

loadKeys();
server.listen(PORT, '127.0.0.1', () => {
  console.log('[key-manager] v2.1 Smart Router + Whitelist on 127.0.0.1:' + PORT);
  console.log('[key-manager] Active keys: ' + getActiveKeys().length + '/' + keys.length);
  console.log('[key-manager] Allowed models: ' + ALLOWED_MODELS.join(', '));
});
