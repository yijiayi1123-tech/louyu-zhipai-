(() => {
  const areas = ['中蓝', '梆子井', '校内'];
  const collator = new Intl.Collator('zh-CN', { numeric: true });
  const demo = [
    { student_id: 'DEMO001', name: '示例同学甲', area: '中蓝', building: 'D区' },
    { student_id: 'DEMO002', name: '示例同学乙', area: '梆子井', building: '4号楼' },
    { student_id: 'DEMO003', name: '示例同学丙', area: '校内', building: '37号楼' },
  ];
  const buildingKey = row => `${row.area}/${row.building}`;
  const emptyState = () => ({ rows: [], status: 'idle', area: '', building: '', search: '' });
  const path = '/rest/v1/roster_entries?select=student_id,name,area,building&order=student_id.asc';

  window.RosterPage = {
    create({ api, esc, live, allowed, visible, render }) {
      let state = emptyState();
      if (!live) state = { ...state, rows: demo, status: 'ready' };

      function filterRows() {
        const keyword = state.search.trim().normalize('NFKC').toLowerCase();
        return state.rows.filter(row => (!state.area || row.area === state.area) &&
          (!state.building || buildingKey(row) === state.building) &&
          (!keyword || [row.name, row.student_id, `${row.area}${row.building}`].some(value =>
            String(value).normalize('NFKC').toLowerCase().includes(keyword))));
      }

      function options() {
        const buildings = new Map(state.rows.filter(row => !state.area || row.area === state.area)
          .map(row => [buildingKey(row), row]));
        return '<option value="">全部楼栋</option>' + [...buildings].sort(([, a], [, b]) =>
          areas.indexOf(a.area) - areas.indexOf(b.area) || collator.compare(a.building, b.building))
          .map(([key, row]) => `<option value="${esc(key)}"${state.building === key ? ' selected' : ''}>${esc(state.area ? row.building : `${row.area} · ${row.building}`)}</option>`).join('');
      }

      function results(rows) {
        if (!rows.length) return '<div class="card empty">没有符合条件的人员</div>';
        return areas.map(area => {
          const group = rows.filter(row => row.area === area).sort((a, b) =>
            collator.compare(a.building, b.building) || collator.compare(a.student_id, b.student_id));
          if (!group.length) return '';
          return `<section class="card roster-group" aria-label="${area}名单"><div class="roster-group-heading"><h2>${area}</h2><span class="badge">${group.length} 人</span></div>
            <div class="table-wrap"><table><thead><tr><th scope="col">学号</th><th scope="col">姓名</th><th scope="col">楼栋</th></tr></thead>
            <tbody>${group.map(row => `<tr><td>${esc(row.student_id)}</td><td>${esc(row.name)}</td><td>${esc(row.building)}</td></tr>`).join('')}</tbody></table></div></section>`;
        }).join('');
      }

      function html() {
        if (!allowed()) return '<div class="card empty">仅管理员可查看人员名单</div>';
        if (state.status === 'idle' || state.status === 'loading') return '<div class="card empty" role="status">正在读取人员名单…</div>';
        if (state.status === 'error') return '<div class="card"><p role="alert">暂时无法读取人员名单。</p><button type="button" id="roster-retry">重新加载</button></div>';
        if (!state.rows.length) return '<div class="card"><p>名单暂无人员。</p><button type="button" id="roster-retry">重新加载</button></div>';
        const filtered = filterRows();
        const stats = [['名单总人数', state.rows.length, live ? '已导入名单' : '演示数据'],
          ['涉及楼栋', new Set(state.rows.map(buildingKey)).size, '按区域和楼栋去重'], ['当前筛选', filtered.length, '符合筛选条件']];
        return `<section class="roster-page" aria-label="人员名单">
          ${!live ? '<p class="muted">此处为演示名单。</p>' : ''}
          <div class="stats roster-stats">${stats.map(([label, value, hint], i) => `<div class="stat"><small>${label}</small><strong${i === 2 ? ' id="roster-match" aria-live="polite"' : ''}>${value}</strong><span>${hint}</span></div>`).join('')}</div>
          <div class="chips roster-areas" role="group" aria-label="按区域筛选">${['', ...areas].map(area => `<button type="button" data-roster-area="${area}" aria-pressed="${area === state.area}">${area || '全部区域'}</button>`).join('')}</div>
          <div class="toolbar roster-toolbar"><input id="roster-search" type="search" aria-label="搜索姓名、学号或楼栋" placeholder="搜索姓名、学号或楼栋…" value="${esc(state.search)}"><select id="roster-building" aria-label="筛选楼栋">${options()}</select></div>
          <div id="roster-results">${results(filtered)}</div>
        </section>`;
      }

      async function load() {
        if (!live || !allowed() || state.status === 'loading') return;
        const current = state;
        current.status = 'loading';
        if (visible()) render();
        try {
          const rows = await api(path);
          if (current !== state || !allowed()) return;
          if (!Array.isArray(rows)) throw Error('Invalid roster response');
          current.rows = rows;
          current.status = 'ready';
        } catch {
          if (current !== state || !allowed()) return;
          current.rows = [];
          current.status = 'error';
        }
        if (visible()) render();
      }

      function bind() {
        if (!visible() || !allowed()) return;
        document.querySelector('#roster-retry')?.addEventListener('click', load);
        if (state.status !== 'ready' || !state.rows.length) return;
        const search = document.querySelector('#roster-search');
        const building = document.querySelector('#roster-building');
        const areaButtons = document.querySelectorAll('[data-roster-area]');
        const update = () => {
          const filtered = filterRows();
          document.querySelector('#roster-match').textContent = String(filtered.length);
          document.querySelector('#roster-results').innerHTML = results(filtered);
        };
        search.addEventListener('input', () => { state.search = search.value; update(); });
        building.addEventListener('change', () => { state.building = building.value; update(); });
        areaButtons.forEach(button => button.addEventListener('click', () => {
          state.area = button.dataset.rosterArea;
          state.building = '';
          building.innerHTML = options();
          areaButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
          update();
        }));
      }

      return { html, bind, load, reset() { state = emptyState(); } };
    },
  };
})();
