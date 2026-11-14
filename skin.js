/* ============================================================
   校园楼宇运维助手 · 可选视觉增强补丁 skin.js
   ------------------------------------------------------------
   用法：
     1) 放到 public/ 目录，与 style.css 同级
     2) 在 public/index.html 的 </head> 前加一行：
          <script src="./skin.js?v=1" defer></script>

   作用（纯视觉，不触碰业务逻辑）：
     1) 侧栏字符图标 ⇄♙◉▤◈☷▣↗⌖◷▦ → 换成 SVG 线性图标
        （设计稿用的是 SVG；字符图标在新视觉体系下不协调）
     2) 补齐状态徽标的 done / warn 语义类
        （原 app.js 只对 3 个状态加了类，"忙碌/待核查"等会漏）

   如果你不想引这个文件：直接删掉 style.css 中
   “第 25 节 内联样式覆盖”以外的导航图标部分也能用，
   只是图标会退回到字符形态。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- SVG 图标库：16×16 线性风格 ---------- */
  var ICONS = {
    overview:
      '<rect x="2.2" y="2.2" width="6" height="6" rx="1.5"/><rect x="9.8" y="2.2" width="6" height="6" rx="1.5"/><rect x="2.2" y="9.8" width="6" height="6" rx="1.5"/><rect x="9.8" y="9.8" width="6" height="6" rx="1.5"/>',
    tasks:
      '<rect x="3" y="3" width="12" height="12" rx="2.2"/><path d="M6 7.5l2 2 4-4"/>',
    tickets:
      '<path d="M9 2.5a6 6 0 0 0-6 6c0 4-1.5 5-1.5 5h15S15 12.5 15 8.5a6 6 0 0 0-6-6z"/><path d="M7 16a2 2 0 0 0 4 0"/>',
    speed_tests:
      '<path d="M2 13.5L6.5 8l3.5 3.5L16 4"/><path d="M11.5 4H16v4.5"/>',
    inspections:
      '<circle cx="9" cy="9" r="6.5"/><circle cx="9" cy="9" r="2.6"/><path d="M9 1v2.2M9 14.8V17M1 9h2.2M14.8 9H17"/>',
    dispatch:
      '<path d="M3 6.5h9M9.5 4L12 6.5 9.5 9"/><path d="M15 11.5H6M8.5 9l-2.5 2.5L8.5 14"/>',
    roster:
      '<circle cx="6.5" cy="6" r="2.8"/><path d="M1.8 15c0-2.6 2.1-4.4 4.7-4.4s4.7 1.8 4.7 4.4"/><path d="M11.5 3.4a2.8 2.8 0 0 1 0 5.4M13 10.9c1.9.6 3.1 2 3.2 4.1"/>',
    presence:
      '<circle cx="9" cy="9" r="6.5"/><circle cx="9" cy="9" r="2.4" fill="currentColor" stroke="none"/>',
    accounts:
      '<rect x="2.5" y="4" width="13" height="10.5" rx="2"/><circle cx="6.6" cy="9.2" r="1.9"/><path d="M4.2 12.8c.4-1.1 1.3-1.7 2.4-1.7s2 .6 2.4 1.7M10.8 8h3.4M10.8 10.8h2.2"/>',
    archive:
      '<rect x="2.5" y="3.5" width="13" height="4" rx="1.4"/><path d="M4 7.5v6a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-6"/><path d="M6.8 11.2h4.4"/>',
    announcements:
      '<rect x="2.5" y="3.5" width="13" height="11" rx="2"/><path d="M6 7.5h6M6 10.5h4"/>',
    weekly_reports:
      '<path d="M3.5 14.5h11"/><rect x="4" y="8" width="2.8" height="4.5" rx="0.8" fill="currentColor" stroke="none" opacity=".55"/><rect x="8" y="5" width="2.8" height="7.5" rx="0.8" fill="currentColor" stroke="none"/><rect x="12" y="9.5" width="2.8" height="3" rx="0.8" fill="currentColor" stroke="none" opacity=".55"/>',
    buildings:
      '<path d="M2.5 15.5V4.2a1.4 1.4 0 0 1 1.4-1.4h5.2a1.4 1.4 0 0 1 1.4 1.4v11.3"/><path d="M10.5 8h3.1a1.4 1.4 0 0 1 1.4 1.4v6.1M5.3 5.6h2.8M5.3 8.6h2.8M5.3 11.6h2.8M1.5 15.5h15"/>'
  };

  /* ---------- 生成 SVG 元素 ---------- */
  function makeSvg(pathData, size) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', size || 17);
    svg.setAttribute('height', size || 17);
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = pathData;
    return svg;
  }

  /* ---------- 侧栏图标替换 ---------- */
  function patchNavIcons() {
    var buttons = document.querySelectorAll('aside nav button[data-page]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var path = ICONS[btn.getAttribute('data-page')];
      if (!path) return;
      if (btn.querySelector('.nav-icon')) return;   // 已替换，跳过
      var old = btn.querySelector('span:not(.nav-icon)');
      if (old) old.remove();
      var holder = document.createElement('span');
      holder.className = 'nav-icon';
      holder.appendChild(makeSvg(path, 17));
      btn.insertBefore(holder, btn.firstChild);
    });

    /* AI 工作助手入口 */
    var aiLink = document.querySelector('aside nav .nav-link');
    if (aiLink && !aiLink.querySelector('svg')) {
      var sparkle = makeSvg(
        '<path d="M9 1.8l1.5 4.1 4.1 1.5-4.1 1.5L9 13l-1.5-4.1L3.4 7.4l4.1-1.5z" fill="currentColor" stroke="none"/>',
        15
      );
      var oldAi = aiLink.querySelector('span');
      if (oldAi) oldAi.replaceWith(sparkle);
      else aiLink.insertBefore(sparkle, aiLink.firstChild);
    }
  }

  /* ---------- 状态徽标语义类补齐 ---------- */
  var DONE = ['已完成', '已解决', '已审核'];
  var WARN = ['待核查', '忙碌', '待补充'];

  function patchBadges() {
    var badges = document.querySelectorAll('.badge');
    Array.prototype.forEach.call(badges, function (el) {
      var text = (el.textContent || '').trim();
      var wantDone = DONE.indexOf(text) >= 0;
      var wantWarn = WARN.indexOf(text) >= 0;
      if (wantDone) {
        el.classList.remove('warn');
        el.classList.add('done');
      } else if (wantWarn) {
        el.classList.remove('done');
        el.classList.add('warn');
      }
    });
  }

  /* ---------- 统一执行 ---------- */
  function apply() {
    patchNavIcons();
    patchBadges();
  }

  /* ---------- 挂钩：优先接管 app.js 的 render()，避免全文档监听 ---------- */
  function hook() {
    var app = document.getElementById('app');
    if (!app || app.__skinHooked) return;
    app.__skinHooked = true;

    var observer = new MutationObserver(function () {
      /* 只在 #app 子树变化时修补，且用 rAF 合并，避免高频触发 */
      window.requestAnimationFrame(apply);
    });
    observer.observe(app, { childList: true, subtree: true });
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hook);
  } else {
    hook();
  }
})();
