import { createChatAuth, chatOptions } from './assistant-auth.js?v=20261030-gateway-1';

const SDK_URL = 'https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.2.0-beta.19/libs/cn/index.js';
const area = document.querySelector('#agent-frame-area');
const container = document.querySelector('#agent-chat');
const loading = document.querySelector('#agent-loading');
const status = document.querySelector('#agent-status');
const errorBox = document.querySelector('#agent-error');
const errorText = document.querySelector('#agent-error-text');
const loginLink = document.querySelector('#agent-login');
const refresh = document.querySelector('#agent-refresh');
const auth = createChatAuth(window.APP_CONFIG || {});
let client = null, sdkPromise = null, generation = 0;

function loadSdk() {
  if (window.CozeWebSDK?.WebChatClient) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const deadline = setTimeout(() => { script.remove(); sdkPromise = null; reject(Error('聊天组件加载较慢，请稍后重新加载。')); }, 30000);
    script.src = SDK_URL;
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      clearTimeout(deadline);
      if (window.CozeWebSDK?.WebChatClient) resolve();
      else { script.remove(); sdkPromise = null; reject(Error('聊天组件未能启动，请重新加载。')); }
    };
    script.onerror = () => { clearTimeout(deadline); script.remove(); sdkPromise = null; reject(Error('聊天组件加载失败，请检查网络后重试。')); };
    document.head.append(script);
  });
  return sdkPromise;
}
function destroyClient() {
  try { client?.destroy(); } catch { /* A partially initialized SDK must not prevent showing the error. */ }
  finally { client = null; container.replaceChildren(); }
}
function showError(error) {
  destroyClient();
  area.setAttribute('aria-busy', 'false');
  loading.hidden = true; errorBox.hidden = false;
  errorText.textContent = error.message || '助手暂时不可用，请重新加载。';
  loginLink.hidden = error.code !== 'LOGIN_REQUIRED' && error.status !== 401;
  status.textContent = '尚未连接，请按上方提示操作。';
}
async function mountAgent() {
  const current = ++generation;
  refresh.disabled = true;
  destroyClient();
  loading.hidden = false; errorBox.hidden = true;
  area.setAttribute('aria-busy', 'true'); status.textContent = '正在连接智能助手…';
  try {
    const grant = await auth.getToken();
    if (current !== generation) return;
    await loadSdk();
    if (current !== generation) return;
    client = new window.CozeWebSDK.WebChatClient(chatOptions(grant, container, async () => {
      try { return (await auth.getToken(true)).access_token; }
      catch (error) { if (current === generation) showError(error); throw error; }
    }, () => {
      if (current !== generation) return;
      loading.hidden = true; area.setAttribute('aria-busy', 'false');
    }));
    client.showChatBot();
    loading.hidden = true; area.setAttribute('aria-busy', 'false');
    status.textContent = '请在对话框中描述问题；AI 回复仅供参考，现场情况请人工复核。';
  } catch (error) { if (current === generation) showError(error); }
  finally { if (current === generation) refresh.disabled = false; }
}
refresh.addEventListener('click', mountAgent);
window.addEventListener('pagehide', () => { ++generation; destroyClient(); });
window.addEventListener('pageshow', event => { if (event.persisted) mountAgent(); });
mountAgent();
