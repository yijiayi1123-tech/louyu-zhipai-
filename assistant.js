import { createChatAuth, chatOptions } from './assistant-auth.js?v=20261114-workflow-1';

const SDK_URL = 'https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.2.0-beta.19/libs/cn/index.js';
const area = document.querySelector('#agent-frame-area');
const container = document.querySelector('#agent-chat');
const loading = document.querySelector('#agent-loading');
const status = document.querySelector('#agent-status');
const errorBox = document.querySelector('#agent-error');
const errorText = document.querySelector('#agent-error-text');
const loginLink = document.querySelector('#agent-login');
const refresh = document.querySelector('#agent-refresh');
const learning = document.querySelector('#assistant-learning');
const learningLink = document.querySelector('#learning-link');
const training = document.querySelector('#training-form');
const result = document.querySelector('#training-result');
const auth = createChatAuth(window.APP_CONFIG || {});
let client = null, sdkPromise = null, generation = 0;
let heartbeatTimer = null, heartbeat = null;

function showLearning(visible) {
  learning.hidden = !visible;
  learningLink.hidden = !visible;
}
function stopHeartbeat() {
  if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  heartbeat = null;
}
function startHeartbeat(profile, current) {
  if (profile.role !== 'manager') return;
  let sending = false;
  heartbeat = async () => {
    if (sending || current !== generation) return;
    sending = true;
    try { await auth.sendHeartbeat(profile.id); }
    catch (error) {
      if (current === generation && (error.status === 401 || error.status === 403)) {
        ++generation;
        stopHeartbeat();
        showLearning(false);
        showError(error);
        refresh.disabled = false;
      }
    } finally { sending = false; }
  };
  heartbeat();
  heartbeatTimer = setInterval(heartbeat, 90000);
}
training.addEventListener('submit', event => {
  event.preventDefault();
  if (learning.hidden) return;
  const answers = new FormData(training);
  const correct = { wireless: '0', speed: '1', ticket: '2' };
  const score = Object.entries(correct).filter(([topic, key]) => answers.get(topic) === key).length;
  result.textContent = '答对 ' + score + ' / 3 题';
});

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
  stopHeartbeat();
  showLearning(false);
  destroyClient();
  loading.hidden = false; errorBox.hidden = true;
  area.setAttribute('aria-busy', 'true'); status.textContent = '正在连接智能助手…';
  try {
    const profile = await auth.verifyActive();
    if (current !== generation) return;
    showLearning(true);
    startHeartbeat(profile, current);
    const grant = await auth.getToken();
    if (current !== generation) return;
    await loadSdk();
    if (current !== generation) return;
    client = new window.CozeWebSDK.WebChatClient(chatOptions(grant, container, async () => {
      try { return (await auth.getToken(true)).access_token; }
      catch (error) { if (current === generation) handleAgentError(error); throw error; }
    }, () => {
      if (current !== generation) return;
      loading.hidden = true; area.setAttribute('aria-busy', 'false');
    }));
    client.showChatBot();
    loading.hidden = true; area.setAttribute('aria-busy', 'false');
    status.textContent = '请在对话框中描述问题；AI 回复仅供参考，现场情况请人工复核。';
  } catch (error) { if (current === generation) handleAgentError(error); }
  finally { if (current === generation) refresh.disabled = false; }
}
function handleAgentError(error) {
  if (error.status === 401 || error.code === 'ACCOUNT_DISABLED') {
    stopHeartbeat();
    showLearning(false);
  }
  showError(error);
}
refresh.addEventListener('click', mountAgent);
document.addEventListener('visibilitychange', () => { if (!document.hidden) heartbeat?.(); });
window.addEventListener('pagehide', () => { ++generation; stopHeartbeat(); showLearning(false); destroyClient(); });
window.addEventListener('pageshow', event => { if (event.persisted) mountAgent(); });
mountAgent();
