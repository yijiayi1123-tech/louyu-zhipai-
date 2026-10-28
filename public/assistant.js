(() => {
  'use strict';
  const area = document.querySelector('#agent-frame-area');
  const loading = document.querySelector('#agent-loading');
  const status = document.querySelector('#agent-status');
  const openLink = document.querySelector('#agent-open');
  const refresh = document.querySelector('#agent-refresh');
  const agentUrl = openLink.href;
  let frame = null;
  let timer = null;

  function mountAgent() {
    clearTimeout(timer);
    if (frame) frame.remove();
    loading.hidden = false;
    area.setAttribute('aria-busy', 'true');
    status.textContent = '正在打开对话页面…';

    const next = document.createElement('iframe');
    next.className = 'assistant-frame';
    next.title = '校园网运维智能助手对话';
    next.referrerPolicy = 'no-referrer';
    next.setAttribute('allow', 'clipboard-write');
    next.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
    next.addEventListener('load', () => {
      if (frame !== next) return;
      clearTimeout(timer);
      loading.hidden = true;
      area.setAttribute('aria-busy', 'false');
      // Cross-origin frame loading does not prove that its conversation service is ready.
      status.textContent = '如果对话未显示，可重新加载或在新窗口打开。';
    });
    next.addEventListener('error', () => {
      if (frame !== next) return;
      clearTimeout(timer);
      loading.hidden = true;
      area.setAttribute('aria-busy', 'false');
      status.textContent = '对话页面暂未打开，请尝试重新加载或在新窗口打开。';
    });
    frame = next;
    next.src = agentUrl;
    area.append(next);
    timer = setTimeout(() => {
      if (frame !== next) return;
      loading.hidden = true;
      area.setAttribute('aria-busy', 'false');
      status.textContent = '对话页面打开时间较长，可重新加载或在新窗口打开。';
    }, 12000);
  }

  refresh.addEventListener('click', mountAgent);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  mountAgent();
})();
