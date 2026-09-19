import { DEMO_DATA } from './demoData.js';

const TOKEN_KEY = 'tacet_token';
const USER_KEY = 'tacet_user';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// In-memory mutations for demo/static preview mode
const customCases = [];
const customRuns = [];

function handleDemoFallback(path, opts = {}) {
  const { method = 'GET', body } = opts;
  const url = new URL(path, 'http://localhost');
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // 1. Auth
  if (pathname === '/auth/login' && method === 'POST') {
    const { username = 'analyst' } = body || {};
    const isAdmin = username.toLowerCase() === 'admin';
    const user = {
      id: isAdmin ? 'usr_admin' : 'usr_analyst',
      username,
      name: isAdmin ? 'Lead Security Admin' : 'Senior Threat Analyst',
      role: isAdmin ? 'admin' : 'analyst',
    };
    return { token: 'tacet-demo-jwt-token', user };
  }

  if (pathname === '/auth/verify') {
    const user = getUser() || {
      id: 'usr_analyst',
      username: 'analyst',
      name: 'Senior Threat Analyst',
      role: 'analyst',
    };
    return { valid: true, user };
  }

  // 2. Dashboard
  if (pathname === '/dashboard') {
    return DEMO_DATA.dashboard;
  }

  // 3. Actors
  if (pathname === '/actors') {
    let list = [...(DEMO_DATA.actors || [])];
    const q = (searchParams.get('q') || '').toLowerCase();
    const risk = searchParams.get('risk');
    const forum = searchParams.get('forum');
    if (q) {
      list = list.filter(
        (a) =>
          a.primaryHandle?.toLowerCase().includes(q) ||
          a.aliases?.some((al) => al.toLowerCase().includes(q))
      );
    }
    if (risk) list = list.filter((a) => a.risk === risk);
    if (forum) list = list.filter((a) => a.forums?.includes(forum));
    return list;
  }

  const actorMatch = pathname.match(/^\/actors\/([^/]+)$/);
  if (actorMatch) {
    const id = actorMatch[1];
    return (
      DEMO_DATA.actorDetails?.[id] ||
      DEMO_DATA.actors?.find((a) => a.id === id) ||
      DEMO_DATA.actors?.[0]
    );
  }

  // 4. Graph
  if (pathname === '/graph') {
    return DEMO_DATA.graph;
  }

  const egoMatch = pathname.match(/^\/graph\/actor\/([^/]+)$/);
  if (egoMatch) {
    const aid = egoMatch[1];
    const g = DEMO_DATA.graph || { nodes: [], edges: [] };
    const nodeId = `actor:${aid}`;
    const connectedEdges = (g.edges || []).filter(
      (e) => e.source === nodeId || e.target === nodeId
    );
    const nodeIds = new Set([
      nodeId,
      ...connectedEdges.map((e) => (e.source === nodeId ? e.target : e.source)),
    ]);
    return {
      center: g.nodes.find((n) => n.id === nodeId),
      nodes: g.nodes.filter((n) => nodeIds.has(n.id)),
      edges: connectedEdges,
    };
  }

  // 5. Crypto
  if (pathname === '/crypto/summary') {
    return DEMO_DATA.cryptoSummary;
  }

  if (pathname === '/crypto/addresses') {
    let list = [...(DEMO_DATA.cryptoAddresses || [])];
    const q = (searchParams.get('q') || '').toLowerCase();
    const chain = searchParams.get('chain');
    if (q) list = list.filter((a) => a.address.toLowerCase().includes(q));
    if (chain) list = list.filter((a) => a.chain === chain);
    return list;
  }

  const liveActorCrypto = pathname.match(/^\/crypto\/actor\/([^/]+)\/live$/);
  if (liveActorCrypto) {
    const aid = liveActorCrypto[1];
    const actor = DEMO_DATA.actorDetails?.[aid] || DEMO_DATA.actors?.find((a) => a.id === aid);
    const wallets = (actor?.crypto || []).map((w) => ({
      chain: w.chain,
      address: w.value,
      balance: 0.842,
      txCount: 28,
      source: 'live-cached',
    }));
    return { live: true, wallets };
  }

  const chainLookup = pathname.match(/^\/crypto\/chain\/([^/]+)\/([^/]+)$/);
  if (chainLookup) {
    const [, chain, address] = chainLookup;
    return {
      chain,
      address,
      balance: 1.254,
      txCount: 39,
      source: 'offline-cached',
      firstSeen: '2025-01-15T00:00:00Z',
      lastSeen: new Date().toISOString(),
    };
  }

  // 6. Sanctions
  if (pathname === '/sanctions/summary') {
    return DEMO_DATA.sanctionsSummary;
  }

  if (pathname === '/sanctions/matches') {
    return DEMO_DATA.sanctionsMatches;
  }

  if (pathname === '/sanctions') {
    let list = [...(DEMO_DATA.sanctions || [])];
    const q = (searchParams.get('q') || '').toLowerCase();
    const chain = searchParams.get('chain');
    if (q) {
      list = list.filter(
        (s) =>
          s.address?.toLowerCase().includes(q) ||
          s.entity?.toLowerCase().includes(q) ||
          s.program?.toLowerCase().includes(q)
      );
    }
    if (chain) list = list.filter((s) => s.chain === chain);
    return list;
  }

  // 7. Cases
  if (pathname === '/cases') {
    if (method === 'POST') {
      const newCase = {
        id: `case_${Date.now().toString(36)}`,
        title: body?.title || 'Untitled Case',
        description: body?.description || '',
        status: 'open',
        createdAt: new Date().toISOString(),
        createdBy: getUser()?.username || 'analyst',
        updatedAt: new Date().toISOString(),
        actorIds: body?.actorIds || [],
        tags: body?.tags || ['tacet-investigation'],
      };
      customCases.unshift(newCase);
      return newCase;
    }
    return [...customCases, ...(DEMO_DATA.cases || [])];
  }

  const caseReportMatch = pathname.match(/^\/cases\/([^/]+)\/report$/);
  if (caseReportMatch) {
    const cid = caseReportMatch[1];
    return (
      DEMO_DATA.caseReports?.[cid] ||
      Object.values(DEMO_DATA.caseReports || {})[0] || {
        title: 'Attribution Dossier',
        generatedAt: new Date().toISOString(),
        summary: 'Target demonstrated cross-forum wallet reuse and stylometric correlation.',
      }
    );
  }

  const caseMatch = pathname.match(/^\/cases\/([^/]+)$/);
  if (caseMatch) {
    const cid = caseMatch[1];
    return (
      customCases.find((c) => c.id === cid) ||
      DEMO_DATA.caseDetails?.[cid] ||
      DEMO_DATA.cases?.find((c) => c.id === cid) ||
      DEMO_DATA.cases?.[0]
    );
  }

  // 8. Posts
  if (pathname === '/posts') {
    let list = [...(DEMO_DATA.posts?.posts || [])];
    const q = (searchParams.get('q') || '').toLowerCase();
    const forum = searchParams.get('forum');
    const author = (searchParams.get('author') || '').toLowerCase();
    if (q) list = list.filter((p) => p.content?.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q));
    if (forum) list = list.filter((p) => p.forum === forum);
    if (author) list = list.filter((p) => p.author?.toLowerCase() === author);
    return { total: list.length, posts: list.slice(0, 50) };
  }

  // 9. Audit
  if (pathname === '/audit') {
    return DEMO_DATA.audit;
  }

  if (pathname === '/audit/verify') {
    return DEMO_DATA.auditVerify;
  }

  // 10. Analysis
  if (pathname === '/analysis/model') {
    return DEMO_DATA.analysisModel;
  }

  if (pathname === '/analysis/compare') {
    return {
      score: 87,
      attributionScore: 87,
      stylometrySimilarity: 0.82,
      sharedInfrastructure: { crypto: 1, pgp: 0, telegram: 1 },
      evidence: [
        'Shared BTC cluster (Base58Check verified)',
        'Matching timezone peak (19:00 UTC)',
        'Stylometric vocabulary & punctuation overlap: 82%',
      ],
    };
  }

  // 11. Ingest
  if (pathname === '/ingest/runs') {
    return [...customRuns, ...(DEMO_DATA.ingestRuns || [])];
  }

  if (pathname === '/ingest/upload' && method === 'POST') {
    const run = {
      id: `run_${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      source_forum: body?.forum || 'breached',
      format: 'text',
      posts_parsed: 14,
      authors_found: 3,
      extraction_ms: 32,
      status: 'complete',
      entities: { crypto: 4, pgp: 1, emails: 2 },
    };
    customRuns.unshift(run);
    return { ok: true, run };
  }

  return { ok: true };
}

export async function api(path, opts = {}) {
  const { body, method = 'GET', headers = {}, ...rest } = opts;
  const token = getToken();
  const endpoint = `${API_BASE}/api${path}`;

  try {
    const resp = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...rest,
    });

    if (resp.status === 401) {
      clearAuth();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.warn(`[TACET API] Received HTML from ${endpoint}, falling back to demo dataset.`);
      return handleDemoFallback(path, opts);
    }

    if (!resp.ok) {
      // 405 (Vercel static POST rejected), 404, 403, 500+ fallback to demo dataset
      if (resp.status === 405 || resp.status === 404 || resp.status === 403 || resp.status >= 500) {
        console.warn(`[TACET API] Status ${resp.status} on ${endpoint}, falling back to demo dataset.`);
        return handleDemoFallback(path, opts);
      }
      const data = await resp.json().catch(() => null);
      if (!data || !data.error) {
        return handleDemoFallback(path, opts);
      }
      throw new Error(data.error || `Request failed: ${resp.status}`);
    }

    return resp.json();
  } catch (err) {
    if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch')) {
      console.info(`[TACET API] Backend offline (${err.message}), using demo dataset for ${path}`);
      return handleDemoFallback(path, opts);
    }
    throw err;
  }
}

export async function login(username, password) {
  const data = await api('/auth/login', { method: 'POST', body: { username, password } });
  setAuth(data.token, data.user);
  return data;
}
