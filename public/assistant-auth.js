export const CHAT_BOT_ID = '7701671324577628187';

export class ChatAuthError extends Error {
  constructor(message, code = 'REQUEST_FAILED', status = 0) { super(message); this.code = code; this.status = status; }
}

export function createChatAuth(config, { storage = sessionStorage, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const base = (config.apiBaseUrl || config.supabaseUrl)?.replace(/\/$/, '');
  const key = 'louyu-session:' + config.supabaseUrl;
  let pending = null, cached = null;
  const read = () => {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value?.access_token && value?.user?.id ? value : null;
    } catch { return null; }
  };
  const loginRequired = () => new ChatAuthError('请先登录楼宇智派，再从菜单进入智能助手。', 'LOGIN_REQUIRED', 401);
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
      const message = response.status === 401 ? '登录已过期，请重新登录楼宇智派。' : response.status === 403 ? '账号暂时无法使用助手，请联系管理员。' :
        response.status === 404 ? '助手服务尚未就绪，请联系管理员。' : value?.message || '助手暂时不可用，请稍后重试。';
      throw new ChatAuthError(message, value?.code || 'REQUEST_FAILED', response.status);
    }
    return value;
  }
  async function ensureSession(force = false) {
    const current = read();
    if (!current) throw loginRequired();
    if (!force && current.expires_at * 1000 > now() + 60000) return current;
    if (!current.refresh_token) throw loginRequired();
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
  async function issue(force) {
    if (!base || !config.supabaseKey) throw new ChatAuthError('助手尚未完成配置，请联系管理员。', 'CONFIG_MISSING');
    let session = await ensureSession();
    if (!force && cached?.owner === session.user.id && cached.expires_at * 1000 > now() + 90000) return cached;
    let value;
    const mint = current => request('/functions/v1/coze-chat-token', { method: 'POST', headers: { Authorization: 'Bearer ' + current.access_token }, body: '{}' });
    try { value = await mint(session); }
    catch (error) {
      if (error.status !== 401) throw error;
      checkSame(session);
      session = await ensureSession(true);
      value = await mint(session);
    }
    checkSame(session);
    if (typeof value?.access_token !== 'string' || !value.access_token || value.access_token.startsWith('pat_') ||
      value.bot_id !== CHAT_BOT_ID || !value.user_id || !Number.isFinite(value.expires_at) || value.expires_at * 1000 <= now()) {
      throw new ChatAuthError('助手授权结果无效，请联系管理员。', 'INVALID_GRANT');
    }
    cached = { ...value, owner: session.user.id };
    return cached;
  }
  return { getToken(force = false) {
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
    userInfo: { id: grant.user_id, nickname: '楼宇智派用户' },
    ui: {
      base: { layout: 'pc', lang: 'zh-CN' },
      asstBtn: { isNeed: false }, header: { isShow: true, isNeedClose: false },
      chatBot: { title: '校园网运维智能助手', el: container, uploadable: false, isNeedAudio: false, isNeedAddNewConversation: true, onShow },
      conversations: { isNeed: false },
    },
  };
}
