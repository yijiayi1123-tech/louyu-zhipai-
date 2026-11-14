export const CHAT_BOT_ID = '7701671324577628187';

export class ChatAuthError extends Error {
  constructor(message, code = 'REQUEST_FAILED', status = 0) { super(message); this.code = code; this.status = status; }
}

export function createChatAuth(config, { storage = sessionStorage, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const base = (config.apiBaseUrl || config.supabaseUrl)?.replace(/\/$/, '');
  const key = 'louyu-session:' + config.supabaseUrl;
  let pending = null, cached = null, refreshing = null;
  const read = () => {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value?.access_token && value?.user?.id ? value : null;
    } catch { return null; }
  };
  const loginRequired = () => new ChatAuthError('请先登录校园楼宇运维助手，再从菜单进入智能助手。', 'LOGIN_REQUIRED', 401);
  const checkSame = current => {
    if (read()?.access_token !== current.access_token) throw loginRequired();
  };
  async function request(path, options) {
    let response;
    try {
      response = await fetchImpl(base + path, { ...options, signal: AbortSignal.timeout(15000), credentials: 'omit', cache: 'no-store',
        headers: { apikey: config.supabaseKey, 'Content-Type': 'application/json', ...options.headers } });
    } catch { throw new ChatAuthError('助手连接未完成，请检查网络后重试。', 'NETWORK_ERROR'); }
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      const message = response.status === 401 ? '登录已过期，请重新登录校园楼宇运维助手。' : response.status === 403 ? '账号暂时无法使用助手，请联系管理员。' :
        response.status === 404 ? '助手服务尚未就绪，请联系管理员。' : value?.message || '助手暂时不可用，请稍后重试。';
      throw new ChatAuthError(message, value?.code || 'REQUEST_FAILED', response.status);
    }
    return value;
  }
  async function ensureSession(force = false) {
    const current = read();
    if (!current) throw loginRequired();
    if (refreshing?.token === current.access_token) return refreshing.promise;
    if (!force && current.expires_at * 1000 > now() + 60000) return current;
    if (!current.refresh_token) throw loginRequired();
    const promise = refreshSession(current);
    refreshing = { token: current.access_token, promise };
    try { return await promise; }
    finally { if (refreshing?.promise === promise) refreshing = null; }
  }
  async function refreshSession(current) {
    let next;
    try { next = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: current.refresh_token }) }); }
    catch (error) {
      if ([400, 401, 403].includes(error.status)) {
        if (read()?.access_token === current.access_token) storage.removeItem(key);
        throw loginRequired();
      }
      throw error;
    }
    checkSame(current);
    if (!next?.access_token || !next.refresh_token || next.user?.id !== current.user.id) throw loginRequired();
    next.expires_at = next.expires_at || Math.floor(now() / 1000) + (next.expires_in || 3600);
    storage.setItem(key, JSON.stringify(next));
    return next;
  }
  function requireConfig() {
    if (!base || !config.supabaseKey) throw new ChatAuthError('助手尚未完成配置，请联系管理员。', 'CONFIG_MISSING');
  }
  async function authorizedRequest(path, initialSession, options) {
    let session = initialSession;
    let value;
    const send = current => request(path, { ...options, headers: { Authorization: 'Bearer ' + current.access_token } });
    try { value = await send(session); }
    catch (error) {
      if (error.status !== 401) throw error;
      const latest = read();
      if (latest?.user.id !== session.user.id) throw loginRequired();
      session = latest.access_token === session.access_token ? await ensureSession(true) : latest;
      value = await send(session);
    }
    checkSame(session);
    return { value, owner: session.user.id };
  }
  async function verifyActive() {
    requireConfig();
    const session = await ensureSession();
    const parameters = new URLSearchParams({ select: 'id,active,role', id: 'eq.' + session.user.id });
    const { value, owner } = await authorizedRequest('/rest/v1/profiles?' + parameters, session, { method: 'GET' });
    const profile = Array.isArray(value) && value.find(profile => profile.id === owner && profile.active === true);
    if (!profile) {
      throw new ChatAuthError('账号尚未启用，请联系管理员。', 'PROFILE_INACTIVE', 403);
    }
    return profile;
  }
  async function sendHeartbeat(operatorId) {
    requireConfig();
    const session = await ensureSession();
    if (session.user.id !== operatorId) throw loginRequired();
    await authorizedRequest('/rest/v1/rpc/update_operator_presence', session, {
      method: 'POST',
      body: JSON.stringify({ target_building: null, availability: null }),
    });
  }
  async function issue(force) {
    requireConfig();
    const session = await ensureSession();
    if (!force && cached?.owner === session.user.id && cached.expires_at * 1000 > now() + 90000) return cached;
    const { value, owner } = await authorizedRequest('/functions/v1/coze-chat-token', session, { method: 'POST', body: '{}' });
    if (typeof value?.access_token !== 'string' || !value.access_token || value.access_token.startsWith('pat_') ||
      value.bot_id !== CHAT_BOT_ID || !value.user_id || !Number.isFinite(value.expires_at) || value.expires_at * 1000 <= now()) {
      throw new ChatAuthError('助手授权结果无效，请联系管理员。', 'INVALID_GRANT');
    }
    cached = { ...value, owner };
    return cached;
  }
  return { verifyActive, sendHeartbeat, getToken(force = false) {
    if (pending) return pending;
    pending = issue(force).finally(() => { pending = null; });
    return pending;
  } };
}

export function chatOptions(grant, container, refreshToken, onShow) {
  return {
    config: { bot_id: CHAT_BOT_ID, isIframe: false },
    componentProps: { title: '校园网运维智能助手' },
    auth: { type: 'token', token: grant.access_token, onRefreshToken: refreshToken },
    userInfo: { id: grant.user_id, nickname: '校园楼宇运维助手用户' },
    ui: {
      base: { layout: 'pc', lang: 'zh-CN' },
      asstBtn: { isNeed: false }, header: { isShow: true, isNeedClose: false },
      chatBot: { title: '校园网运维智能助手', el: container, uploadable: false, isNeedAudio: false, isNeedAddNewConversation: true, onShow },
      conversations: { isNeed: false },
    },
  };
}
