const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=window.APP_CONFIG, live=!!(cfg.supabaseUrl&&cfg.supabaseKey), key='louyu-demo-v1';
let session=null,profile=null,page='overview',query='',filter='',data={},role='admin',refreshing=null;
const sessionKey='louyu-session:'+cfg.supabaseUrl;
const tableOrders={buildings:'name.asc,id.asc',profiles:'name.asc,id.asc',tasks:'due_date.asc,created_at.desc,id.asc',speed_tests:'tested_at.desc,id.asc',tickets:'created_at.desc,id.asc',inspections:'created_at.desc,id.asc',announcements:'created_at.desc,id.asc',weekly_reports:'created_at.desc,id.asc',announcement_reads:'created_at.desc,id.asc',audit_logs:'created_at.desc,id.asc'};
const product='校园楼宇运维助手';
const positioning=product+'——面向劳动实践岗的网络运维知识库与工单协同工具';
const roleLabel=()=>role==='admin'?'一级 · 教师管理员':'二级 · 学生管理员';
const taskStatuses=['待完成','进行中','待补充','待审核','已完成'];
const names={publish:'发布任务',dispatch:'任务指派',accounts:'学生管理员账号',presence:'人员状态',learning:'知识库与培训',overview:'工作概览',tasks:'任务调度',tickets:'工单中心',speed_tests:'每周测速',inspections:'实体巡查',announcements:'公告通知',weekly_reports:'每周复盘',buildings:'楼宇与人员',roster:'人员名单'};
const navIcons={publish:'＋',dispatch:'⇄',accounts:'♙',presence:'◉',learning:'◇',overview:'◈',tasks:'☷',tickets:'▣',speed_tests:'↗',inspections:'⌖',announcements:'◷',weekly_reports:'▤',buildings:'▦',roster:'◉'};
const date=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, now=()=>new Date().toISOString(), uid=()=>crypto.randomUUID();
function localTime(value,withTime=false){if(!value)return '';const d=new Date(value);return Number.isNaN(d.getTime())?'':date(d)+(withTime?' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'');}
function seed(){return {buildings:[{id:'b1',name:'明理楼',area:'教学区',manager_id:'u1'},{id:'b2',name:'知行楼',area:'教学区',manager_id:'u2'},{id:'b3',name:'博学楼',area:'实验区',manager_id:'u3'}],profiles:[{id:'admin',name:'管理员',role:'admin'},{id:'u1',name:'林同学',role:'manager'},{id:'u2',name:'陈同学',role:'manager'},{id:'u3',name:'周同学',role:'manager'}],tasks:[{id:uid(),title:'本周网络巡查与测速',building_id:'b1',assignee_id:'u1',type:'巡查测速',due_date:date(),status:'待完成',content:'检查 1–3 层公共区域，按同一设备与连接方式记录测速结果。',created_at:now()},{id:uid(),title:'核实二楼无线网络反馈',building_id:'b2',assignee_id:'u2',type:'远程协同',due_date:date(),status:'进行中',created_at:now()},{id:uid(),title:'实验室网络例行巡查',building_id:'b3',assignee_id:'u3',type:'实体巡查',due_date:date(),status:'已完成',created_at:now()}],tickets:[{id:uid(),title:'二楼走廊无线连接不稳定',building_id:'b1',location:'2F 东侧走廊',severity:'一般',status:'待核查',content:'部分时段出现断连，待相同条件下复核。',created_at:now()}],speed_tests:[],inspections:[],announcements:[{id:uid(),title:'本周巡查与测速安排',content:'请在本周完成负责楼栋巡查。测速时记录设备、连接方式及现场情况；异常结果请先复核。',building_id:null,created_at:now()}],weekly_reports:[],announcement_reads:[],audit_logs:[]};}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3500)}
function setSession(value){session=value?{...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+(value.expires_in||3600)}:null;try{if(session)sessionStorage.setItem(sessionKey,JSON.stringify(session));else sessionStorage.removeItem(sessionKey)}catch{}}
function clearSession(){stopPresence();rosterPage?.reset();setSession(null);profile=null;data={};page='overview';query='';filter='';$('#modal')?.close();login();}
function requestStage(path,method='GET'){if(path.startsWith('/auth/v1/token?grant_type=password'))return '账号登录';if(path.startsWith('/auth/v1/token?grant_type=refresh_token'))return '登录续期';if(path.startsWith('/auth/v1/logout'))return '退出登录';if(path.startsWith('/rest/v1/')){const table=path.slice('/rest/v1/'.length).split('?')[0];return (method==='GET'?'读取':'保存')+({profiles:'人员资料',buildings:'楼宇',tasks:'任务',tickets:'工单',speed_tests:'测速记录',inspections:'巡查记录',announcements:'公告',weekly_reports:'周报',announcement_reads:'公告已读记录',audit_logs:'操作记录',operator_presence:'人员状态','rpc/update_operator_presence':'人员状态'}[table]||'业务数据')}return '连接服务';}
function transportError(path,method){return Error(requestStage(path,method)+'失败：尚未收到数据服务响应。请点击“检查连接”查看入口连接结果，稍后重试。');}
async function request(path,options={},token=session?.access_token){let r,timedOut=false;const controller=new AbortController(),timer=setTimeout(()=>{timedOut=true;controller.abort()},15000);try{const base=cfg.apiBaseUrl||cfg.supabaseUrl;r=await fetch(base.replace(/\/$/,'')+path,{...options,signal:controller.signal,headers:{apikey:cfg.supabaseKey,...(token?{Authorization:`Bearer ${token}`}:{ }),'Content-Type':'application/json',...options.headers}});const value=await r.json().catch(e=>{if(timedOut)throw e;return null});if(!r.ok){const message=value?.message||value?.msg||value?.error_description||'请求失败，请检查项目配置或登录状态';const e=Error(message==='Invalid login credentials'?'邮箱或密码不正确，请核对后重试':message);e.status=r.status;throw e}return value}catch(e){if(timedOut)throw Error(requestStage(path,options.method)+'超时（15秒）：连接未完成，请稍后重试；保存操作请先刷新核对，避免重复提交。');if(!r)throw transportError(path,options.method);throw e}finally{clearTimeout(timer)}}
const connectionChecks=[{stage:cfg.apiBaseUrl?'A 网关入口 GET':'A 普通 GET',path:cfg.apiBaseUrl?'/healthz':'/auth/v1/health',method:'GET'},{stage:'B 带公钥 GET',path:'/auth/v1/health',method:'GET',headers:()=>({apikey:cfg.supabaseKey})},{stage:'C 登录路径 POST',path:'/auth/v1/token?grant_type=password',method:'POST',headers:()=>({apikey:cfg.supabaseKey,'Content-Type':'application/json'}),body:'{}'}];
async function connectionProbe(check){const started=Date.now(),controller=new AbortController();let timedOut=false,response;const timer=setTimeout(()=>{timedOut=true;controller.abort()},8000);try{response=await fetch((cfg.apiBaseUrl||cfg.supabaseUrl).replace(/\/$/,'')+check.path,{method:check.method,signal:controller.signal,credentials:'omit',...(check.headers?{headers:check.headers()}:{}),...(check.body?{body:check.body}:{})});const body=await response.json().catch(e=>{if(timedOut)throw e;return null});const expected=check.stage.startsWith('A')?(cfg.apiBaseUrl?response.status===200&&body?.ok===true&&body?.service==='louyu-gateway':response.status===401&&/no api key/i.test(body?.message||'')):check.stage.startsWith('B')?response.status===200:response.status===400&&((body?.code||body?.error_code)==='validation_failed'||/missing (email|phone)|email or phone/i.test(body?.message||body?.msg||''));return {stage:check.stage,result:cfg.apiBaseUrl&&check.stage.startsWith('C')&&response.status===400&&body?.code==='invalid_credentials_body'?'HTTP 400（网关已接收；实际登录另验）':`HTTP ${response.status}（${expected?'符合预期':'与预期不符'}）`,durationMs:Date.now()-started}}catch{return {stage:check.stage,result:timedOut?'超时（8秒）':response?`HTTP ${response.status}（响应未读完）`:'浏览器连接错误',durationMs:Date.now()-started}}finally{clearTimeout(timer)}}
async function checkConnection(onUpdate=()=>{}){const lines=['版本：20261030-gateway-1',`时间（北京时间）：${new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`,`模式：${cfg.apiBaseUrl?'配置的 API 网关':'Supabase 直连'}`];for(const check of connectionChecks){const result=await connectionProbe(check);lines.push(`${result.stage}：${result.result} · ${result.durationMs} ms`);onUpdate(lines.join('\n'))}return lines.join('\n');}
async function ensureSession(force=false){if(!session?.access_token)throw Error('请先登录');if(!force&&session.expires_at*1000>Date.now()+60000)return;if(refreshing)return refreshing;const current=session;if(!current.refresh_token){clearSession();throw Error('登录已过期，请重新登录')}refreshing=(async()=>{try{const value=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:current.refresh_token})},null);if(session!==current)throw Error('登录状态已变更，请重试');if(!value?.access_token||!value?.user?.id)throw Error('登录状态无效，请重新登录');setSession(value)}catch(e){if(session===current&&[400,401,403].includes(e.status)){clearSession();throw Error('登录已过期，请重新登录')}throw e}finally{refreshing=null}})();return refreshing;}
async function api(path,options={},retried=false){const authenticated=path.startsWith('/rest/v1/');if(authenticated)await ensureSession();const token=path.startsWith('/auth/v1/token?')?null:session?.access_token;try{return await request(path,options,token)}catch(e){if(authenticated&&e.status===401&&!retried&&(!options.method||['GET','HEAD'].includes(options.method))){if(session?.access_token===token)await ensureSession(true);return api(path,options,true)}if(authenticated&&e.status===401){clearSession();throw Error('登录已过期，请重新登录')}throw e}}
async function load(){if(live){const current=session?.user?.id,next={};for(const [table,order]of Object.entries(tableOrders)){next[table]=await api('/rest/v1/'+table+'?select=*&order='+order);if(!Array.isArray(next[table]))throw Error('数据读取异常，请重试')}if(current!==session?.user?.id)throw Error('登录状态已变更，请重新登录');const nextProfile=next.profiles.find(p=>p.id===current);if(!nextProfile||!nextProfile.active){clearSession();throw Error('账号尚未启用，请管理员配置 profiles')}data=next;profile=nextProfile;role=profile.role;}else{try{data=JSON.parse(localStorage.getItem(key))||seed()}catch{data=seed()}profile=data.profiles.find(p=>p.id===(role==='admin'?'admin':'u1'));}render()}
function studentBuilding(student,building){return !!student&&student.role==='manager'&&student.active!==false&&!!building&&(building.manager_id===student.id||student.assigned_building_id===building.id)}
function canManageBuilding(id){
  return role==='admin'||studentBuilding(profile,data.buildings.find(b=>b.id===id));
}
function rows(table){
  const records=data[table]||[];
  if(role==='admin'||['profiles','audit_logs'].includes(table))return records;
  if(table==='buildings')return records.filter(b=>canManageBuilding(b.id));
  if(table==='weekly_reports')return records.filter(r=>r.created_by===profile.id);
  if(table==='announcement_reads')return records.filter(r=>r.user_id===profile.id);
  if(table==='announcements')return records.filter(r=>!r.building_id||canManageBuilding(r.building_id));
  if(['tasks','tickets'].includes(table))return records.filter(r=>r.created_by===profile.id||canManageBuilding(r.building_id));
  return records.filter(r=>canManageBuilding(r.building_id));
}
const bname=id=>data.buildings.find(b=>b.id===id)?.name||'全校', pname=id=>data.profiles.find(p=>p.id===id)?.name||'未分配';
const badge=s=>`<span class="badge ${s==='已完成'||s==='已解决'||s==='已审核'?'done':s==='待核查'?'warn':''}">${esc(s)}</span>`;
const empty='<div class="empty">暂无记录，点击右上角开始创建</div>';
async function save(table,record,id){if(live){const saved=await api('/rest/v1/'+table+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify(record),headers:{Prefer:'return=representation'}});if(!Array.isArray(saved)||saved.length!==1)throw Error(id?'记录未更新，可能已被删除或无权操作，请刷新后重试':'未确认记录保存结果，请刷新核对');}else{if(id){const item=data[table].find(r=>r.id===id);if(!item)throw Error('记录不存在，请刷新后重试');if(table==='tasks'&&'reminded_by' in record)record={...record,reminded_at:now(),reminded_by:profile.id};Object.assign(item,record)}else data[table].unshift({id:uid(),created_at:now(),created_by:profile.id,...record});data.audit_logs.unshift({id:uid(),created_at:now(),actor_id:profile.id,table_name:table,action:id?'UPDATE':'INSERT'});localStorage.setItem(key,JSON.stringify(data));}try{await load()}catch(e){throw Error('记录已保存，但刷新失败：'+e.message+'。请刷新页面核对，避免重复提交。')}}
function shell(body){return `<aside><h2>▦ ${product}</h2><small>CAMPUS OPERATIONS</small><nav>${Object.entries(names).filter(([k])=>role==='admin'||!['buildings','accounts'].includes(k)).map(([k,v])=>`<button data-page="${k}" class="${page===k?'active':''}">${navIcons[k]}　${v}</button>`).join('')}<a class="nav-link" href="./assistant.html" aria-label="打开 AI 工作助手"><span aria-hidden="true">✦</span>　AI 工作助手</a></nav><footer>校园网络运维与劳动实践<br><small>MVP · 初步原型</small></footer></aside><div class="workspace"><header><span>校园协作空间 <span class="muted"> / ${names[page]}</span></span><div class="actions"><span><span class="avatar">${esc(profile.name[0])}</span>${esc(profile.name)} · ${roleLabel()}</span>${!live?'<button id="switch">切换角色</button>':''}<button id="logout">${live?'退出':'重置演示'}</button></div></header><main>${!live?'<div class="banner">演示模式 · 数据仅保存在当前浏览器，虚拟楼宇与账号。连接 Supabase 后使用真实登录和数据库权限。</div>':'<div class="banner">Supabase 已连接 · 当前展示账号权限范围内的数据</div>'}<div class="topline"><div><div class="eyebrow">WORKSPACE / ${role==='admin'?'ADMIN':'MANAGER'}</div><h1>${page==='overview'?(role==='admin'?'校园运维，一目了然':'今天的工作，从这里开始'):names[page]}</h1><span class="muted">${new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})} · AI 工作助手 · 网络运维知识库 · 新人培训考核</span></div>${['tickets','speed_tests','inspections','weekly_reports'].includes(page)||(role==='admin'&&['announcements','buildings'].includes(page))?`<button class="primary" id="create">＋ ${page==='weekly_reports'?'生成本周草稿':'新增'+({tasks:'任务',tickets:'工单',speed_tests:'测速',inspections:'巡查',announcements:'公告',buildings:'楼宇'}[page])}</button>`:''}</div>${body}<p class="muted">${positioning}</p></main></div>`}
function overview(){const t=rows('tasks'), tickets=rows('tickets'),done=t.filter(x=>x.status==='已完成').length;return `<div class="stats">${[['负责楼宇',rows('buildings').length,'楼宇协作范围'],['待办任务',t.length-done,'按截止时间跟进'],['待处理工单',tickets.filter(x=>x.status!=='已解决').length,'持续跟进问题'],['任务完成率',t.length?Math.round(done/t.length*100)+'%':'—','根据当前可见任务计算']].map(([n,v,h])=>`<div class="stat"><small>${n}</small><strong>${v}</strong><span>${h}</span></div>`).join('')}</div><div class="grid"><div><div class="card"><h2>待办任务 <span class="muted"> / TASKS</span></h2>${t.filter(x=>x.status!=='已完成').slice(0,5).map(x=>`<div class="row"><div><strong>${esc(x.title)}</strong><span class="muted">${esc(bname(x.building_id))} · ${esc(pname(x.assignee_id))} · ${esc(x.due_date)}</span></div>${badge(x.status)}</div>`).join('')||empty}<button data-page="tasks" style="margin-top:16px">查看全部任务 →</button></div><div class="card"><h2>楼宇协作进度</h2>${rows('buildings').map(b=>{const a=t.filter(x=>x.building_id===b.id),d=a.filter(x=>x.status==='已完成').length;return `<div class="row"><strong>${esc(b.name)}</strong><span class="muted">${d} / ${a.length} 项完成 · ${esc(pname(b.manager_id))}</span></div><div class="progress"><i style="width:${a.length?d/a.length*100:0}%"></i></div>`}).join('')||empty}</div></div><div><div class="card"><h2>最新公告</h2>${rows('announcements').slice(0,3).map(x=>`<div class="row"><div><strong>${esc(x.title)}</strong><p>${esc(x.content)}</p><span class="muted">${esc(bname(x.building_id))}</span></div></div>`).join('')||empty}</div><div class="card" style="background:#edf2ff"><h2>本周工作闭环</h2><p>01　领取任务与现场巡查</p><p>02　人工测速与异常登记</p><p>03　工单跟进与每周复盘</p><button data-page="weekly_reports">进入复盘中心 →</button></div></div></div>`}
function list(){let a=rows(page).filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())&&(!filter||x.status===filter));const controls=`<div class="toolbar"><input id="search" placeholder="搜索标题、内容或位置…" value="${esc(query)}" aria-label="搜索">${['tasks','tickets'].includes(page)?`<select id="filter" aria-label="状态筛选"><option value="">全部状态</option>${(page==='tasks'?taskStatuses:['待核查','处理中','已解决']).map(s=>`<option ${s===filter?'selected':''}>${s}</option>`).join('')}</select>`:''}</div>`;if(page==='announcements')return controls+a.map(x=>`<div class="card"><div class="row"><h2>${esc(x.title)}</h2>${badge(bname(x.building_id))}</div><p class="notice">${esc(x.content)}</p><div class="row"><span class="muted">${esc(localTime(x.created_at))}</span><button data-read="${x.id}" ${data.announcement_reads.some(r=>r.announcement_id===x.id&&r.user_id===profile.id)?'disabled':''}>${data.announcement_reads.some(r=>r.announcement_id===x.id&&r.user_id===profile.id)?'已确认阅读':'确认已读'}</button></div></div>`).join('')+(a.length?'':empty);if(page==='weekly_reports')return a.map(x=>`<div class="card"><div class="row"><h2>${esc(x.title)}</h2>${badge(x.status)}</div><div class="report">${esc(x.content)}</div>${role==='admin'&&x.status!=='已审核'?`<button data-review="${x.id}">审核通过</button>`:''}</div>`).join('')||empty;
const cols={tasks:['任务 / 完成标准','楼宇','负责人','截止时间','状态','操作'],tickets:['问题描述','楼宇 / 位置','严重程度','状态','操作'],speed_tests:['楼宇 / 位置','测试条件','下载 Mbps','上传 Mbps','延迟 ms','测试时间'],inspections:['楼宇 / 位置','巡查结果','记录人','记录时间'],buildings:['楼宇','区域','负责学生管理员']}[page];return controls+`<div class="card table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${a.map(x=>`<tr>${tableCells(x).map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>${a.length?'':empty}</div>`}
function tableCells(x){const b=esc(bname(x.building_id)),location=esc(x.location);if(page==='tasks')return [`<strong>${esc(x.title)}</strong><div class="muted">${esc(x.content)}${x.completion_note?'<br>反馈：'+esc(x.completion_note):''}</div>`,b,esc(pname(x.assignee_id)),esc(x.due_date),badge(x.status)+(x.reminded_at&&pendingTask(x)?'<div class="muted">已催办 · '+esc(localTime(x.reminded_at,true))+'</div>':''),`<button data-task="${x.id}">详情</button>`];if(page==='tickets')return [`<strong>${esc(x.title)}</strong><div class="muted">${esc(x.content)}${x.completion_note?'<br>跟进：'+esc(x.completion_note):''}</div>`,b+' / '+location,esc(x.severity),badge(x.status),canManageBuilding(x.building_id)?`<button data-update="${x.id}">跟进</button>`:""];if(page==='speed_tests')return [b+' / '+location,esc(x.device)+' · '+esc(x.connection),esc(x.download),esc(x.upload),esc(x.latency),esc(localTime(x.tested_at,true))];if(page==='inspections')return [b+' / '+location,esc(x.content),esc(pname(x.created_by)),esc(localTime(x.created_at))];return [esc(x.name),esc(x.area),esc(pname(x.manager_id))]}
function render(){ $('#app').innerHTML=shell(page==='overview'?overview():page==='roster'?(rosterPage?.html()||''):operationPages[page]?.()??list());rosterPage?.bind();document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;query='';filter='';render();if(page==='presence'||page==='dispatch')void refreshPresence();if(page==='roster')void rosterPage?.load()});$('#switch')?.addEventListener('click',()=>{stopPresence(); demoPresence=null; role=role==='admin'?'manager':'admin';page='overview';load()});$('#logout').onclick=async()=>{if(live){try{await stopPresenceSharing()}catch{}try{await api('/auth/v1/logout',{method:'POST'})}catch{}clearSession()}else if(confirm('重置所有本地演示记录？')){stopPresence(); demoPresence=null; localStorage.removeItem(key);load()}};$('#create')?.addEventListener('click',()=>page==='weekly_reports'?report():form());$('#search')?.addEventListener('input',e=>{query=e.target.value;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos)});$('#filter')?.addEventListener('change',e=>{filter=e.target.value;render()});bindOperations(); document.querySelectorAll('[data-update]').forEach(b=>b.onclick=()=>form(b.dataset.update));document.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>busy(b,()=>save('announcement_reads',{announcement_id:b.dataset.read,user_id:profile.id})));document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>busy(b,()=>save('weekly_reports',{status:'已审核'},b.dataset.review)));}
async function busy(button,fn){const error=button?.form?.querySelector('.form-error');if(error)error.textContent='';if(button)button.disabled=true;try{await fn()}catch(e){const current=$('#login .form-error')||(error?.isConnected!==false?error:null);if(current)current.textContent=e.message;toast(e.message)}finally{if(button)button.disabled=false}}
function field(name,label,type='text',value='',options=[]){return `<label for="f-${name}">${label}</label>${type==='select'?`<select id="f-${name}" name="${name}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('')}</select>`:type==='textarea'?`<textarea id="f-${name}" name="${name}" required maxlength="4000">${esc(value)}</textarea>`:`<input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" max="100000" step="0.01"':''} required maxlength="300">`}`}
function dialog(title,html,submit){$('#modal').innerHTML=`<div class="dialog-head"><h2>${esc(title)}</h2><button id="close" aria-label="关闭">×</button></div><form>${html}<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" id="cancel">取消</button><button class="primary" type="submit">保存记录</button></div></form>`;$('#modal').showModal();$('#close').onclick=$('#cancel').onclick=()=>$('#modal').close();$('#modal form').onsubmit=async e=>{e.preventDefault();await busy(e.submitter,async()=>{await submit(Object.fromEntries(new FormData(e.target)));$('#modal').close();toast('记录已保存')})};}
function form(id){if(page==='tickets'&&!id&&!buildingOptions(true).length){toast('请教师管理员先添加楼宇');return;}const item=id?data[page].find(r=>r.id===id):{},f=(n,l,t='text',v='',o=[])=>field(n,l,t,item[n]??v,o), buildings=buildingOptions(page==='tickets');let html='';if(id){html=f('status','处理状态','select','', (page==='tasks'?taskStatuses:['待核查','处理中','已解决']).map(s=>[s,s]))+f('completion_note','完成记录 / 跟进说明','textarea');}else if(page==='buildings'){html=f('name','楼宇名称')+f('area','所在区域')+f('manager_id','负责学生管理员','select','',data.profiles.filter(p=>p.role==='manager'&&p.active!==false).map(p=>[p.id,p.name]));}else{html=f('building_id',page==='announcements'?'发布范围':'所属楼宇','select','',page==='announcements'?[['','全校'],...buildings]:buildings);if(['tasks','tickets','announcements'].includes(page))html+=f('title','标题');if(['tickets','speed_tests','inspections'].includes(page))html+=f('location','具体位置');if(page==='tickets')html+=f('severity','严重程度','select','一般',['一般','紧急'].map(s=>[s,s]));if(page==='speed_tests')html+=f('tested_at','测试时间','datetime-local',new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16))+f('device','测试设备')+f('connection','连接方式','select','Wi-Fi',[['Wi-Fi','Wi-Fi'],['有线','有线']])+f('download','下载速度 Mbps','number')+f('upload','上传速度 Mbps','number')+f('latency','延迟 ms','number');html+=f('content',page==='speed_tests'?'现场情况 / 备注':'描述 / 要求 / 结果','textarea');}dialog(id?'更新进度':'新增'+names[page],html,async v=>{if(!id){if('building_id'in v)v.building_id=v.building_id||null;if(page==='tickets')v.status='待核查';if(page==='speed_tests'){for(const n of ['download','upload','latency'])v[n]=Number(v[n]);v.tested_at=new Date(v.tested_at).toISOString();}v.created_by=profile.id;}await save(page,v,id)});}
function report(){const end=new Date(),start=new Date(end);start.setDate(end.getDate()-6);start.setHours(0,0,0,0);const within=x=>new Date(x.created_at)>=start&&new Date(x.created_at)<=end;const tasks=rows('tasks').filter(x=>x.due_date>=date(start)&&x.due_date<=date()),done=tasks.filter(x=>x.status==='已完成').length, speed=rows('speed_tests').filter(x=>new Date(x.tested_at)>=start&&new Date(x.tested_at)<=end),tickets=rows('tickets').filter(within);const title=`${start.toLocaleDateString('zh-CN')}—${end.toLocaleDateString('zh-CN')} 工作周报`;const content=`统计范围：当前账号可见数据，最近七个自然日。\n任务：期限落在本周期 ${tasks.length} 项；当前已完成 ${done} 项；完成率 ${tasks.length?Math.round(done/tasks.length*100)+'%':'暂无任务'}。\n巡查：本周期提交 ${rows('inspections').filter(within).length} 条记录。\n测速：本周期测试 ${speed.length} 次；不同设备与连接方式不直接比较，不作故障诊断。\n工单：本周期新增 ${tickets.length} 条，其中当前已解决 ${tickets.filter(x=>x.status==='已解决').length} 条。\n待跟进：当前全部未解决工单 ${rows('tickets').filter(x=>x.status!=='已解决').length} 条。\n下周安排：复核异常位置，跟进未结工单。\n生成方式：程序按记录统计，未调用 AI；请管理员审核。`;dialog('生成本周草稿',field('title','报告标题','text',title)+field('content','报告内容','textarea',content),v=>save('weekly_reports',{...v,status:'待审核',created_by:profile.id}));}
function login(){ $('#app').innerHTML=`<main style="max-width:470px;margin:8vh auto"><div class="eyebrow">CAMPUS OPERATIONS</div><h1>${product}</h1><p>${positioning}</p><div class="card"><h2>登录协作空间</h2><form id="login">${field('email','邮箱','email')}${field('password','密码','password')}<p class="form-error" role="alert"></p><button class="primary" style="width:100%;margin-top:24px">登录</button></form><p class="muted">请使用管理员在 Supabase 创建并启用的账号。</p><p class="assistant-entry"><a href="./assistant.html" aria-label="打开智能助手页面">打开 AI 工作助手 →</a></p><button type="button" id="check-connection">检查连接</button><textarea id="connection-results" aria-label="连接检查结果，可长按复制" readonly hidden rows="8" style="margin-top:12px"></textarea></div></main>`;$('#check-connection').onclick=async e=>{const button=e.currentTarget,result=$('#connection-results');button.disabled=true;result.hidden=false;result.value='正在检查连接…';try{result.value=await checkConnection(value=>result.value=value)}finally{button.disabled=false}};$('#login').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{const v=Object.fromEntries(new FormData(e.target));setSession(await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify(v)}));page='overview';try{await load()}catch(e){clearSession();throw e}})}}
async function start(){if(!live)return load();try{const stored=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(stored?.access_token&&stored?.refresh_token&&stored?.user?.id){setSession(stored);await load();return}}catch(e){login();const error=$('#login .form-error');if(error)error.textContent=e.message;toast(e.message);return}login()}

const pendingTask = task => ['待完成','进行中','待补充'].includes(task.status);
const buildingOptions = (all=false) => (all?data.buildings:rows('buildings')).map(b=>[b.id,b.name]);
const taskTypes = ['巡查测速','实体巡查','远程协同'];
const noPublishedBuildings='<div class="empty">系统还没有楼宇，请教师管理员先添加楼宇。</div>';
const noBuilding = '<div class="empty">当前账号暂无负责楼宇，请教师管理员分配楼宇。</div>';

function publishPage(){
  if(!buildingOptions(true).length)return noPublishedBuildings;
  return `<div class="card"><form id="publish-task">
    ${field('building_id','所属楼宇','select','',buildingOptions(true))}
    ${field('title','任务标题')}
    ${field('type','任务类型','select','',taskTypes.map(t=>[t,t]))}
    ${field('due_date','截止日期','date',date())}
    ${field('content','任务说明 / 完成标准','textarea')}
    <p class="form-error" role="alert"></p><button class="primary">发布任务</button>
  </form></div>`;
}

function taskDetail(id){
  const task=rows('tasks').find(t=>t.id===id);
  if(!task)return;
  const meta=`<p>${esc(bname(task.building_id))} · ${esc(task.type)} · ${esc(task.due_date)}</p>
    <p>${badge(task.status)} · ${esc(pname(task.assignee_id))}</p><p class="notice">${esc(task.content)}</p>
    ${task.completion_note?`<p class="notice">最新记录 · ${esc(task.completion_note)}</p>`:''}
    ${task.review_note?`<p class="notice">审核意见 · ${esc(task.review_note)}</p>`:''}
    ${task.reminded_at?`<p class="muted">最近催办 · ${esc(localTime(task.reminded_at,true))} · ${esc(pname(task.reminded_by))}</p>`:''}`;
  const reviewing=role==='admin'&&task.status==='待审核';
  const updating=task.assignee_id===profile.id&&pendingTask(task);
  const actions=canManageBuilding(task.building_id)&&pendingTask(task)?`<div class="actions">
    <button type="button" id="detail-assign">指派执行人</button>
    ${task.assignee_id?'<button type="button" id="detail-remind">催办</button>':''}</div>`:'';
  if(reviewing||updating){
    const options=reviewing?[['已完成','审核通过'],['待补充','退回补充']]:[['进行中','更新进度'],['待审核','提交审核']];
    dialog(task.title,meta+actions+field('status','处理操作','select','',options)+
      field(reviewing?'review_note':'completion_note',reviewing?'审核意见':'进度 / 完成记录','textarea'),
      v=>save('tasks',v,id));
  }else{
    dialog(task.title,meta+actions,async()=>{});
    $('#modal button[type=submit]').hidden=true;
  }
  $('#detail-assign')?.addEventListener('click',()=>{
    $('#modal').close();
    page='dispatch'; render(); void refreshPresence();
    $('#dispatch-task').value=id;
    showDispatchOptions();
  });
  $('#detail-remind')?.addEventListener('click',e=>busy(e.currentTarget,async()=>{
    await save('tasks',{reminded_by:profile.id,reminded_at:now()},task.id);
    $('#modal').close();
    toast('已催办，执行人可在任务列表查看');
  }));
}

let presenceRows=[], presenceTimer=null, sharedPresence=null, demoPresence=null, presenceQueue=Promise.resolve();
let presenceRead=0,presenceError='';
const presenceLabels={online:'在线',available:'空闲',busy:'忙碌',offline:'离线'};
const freshPresence=p=>Date.parse(p.last_heartbeat_at)>Date.now()-300000;
function availableOperators(building){
  return presenceRows.filter(p=>p.building_id===building&&p.state==='available'&&freshPresence(p))
    .map(p=>data.profiles.find(person=>person.id===p.operator_id))
    .filter(p=>studentBuilding(p,data.buildings.find(b=>b.id===building)))
    .sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')||a.id.localeCompare(b.id));
}
function stopPresence(){
  if(presenceTimer!==null)clearInterval(presenceTimer);
  presenceTimer=null; sharedPresence=null; presenceRows=[]; presenceError=''; presenceRead++;
}
function updatePresence(settings){
  if(!live){
    demoPresence=settings.state==='offline'?null:{operator_id:profile.id,building_id:settings.building,state:settings.state,last_heartbeat_at:now()};
    return Promise.resolve();
  }
  const owner=profile?.id;
  const update=presenceQueue.catch(()=>{}).then(()=>{
    if(profile?.id!==owner||session?.user?.id!==owner)return;
    return api('/rest/v1/rpc/update_operator_presence',{method:'POST',body:JSON.stringify({
      target_building:settings.building,availability:settings.state
    })});
  });
  presenceQueue=update;
  return update;
}
async function stopPresenceSharing(){
  stopPresence();
  if(profile)await updatePresence({building:null,state:'offline'});
}
async function refreshPresence(){
  const version=++presenceRead;
  try{
    const latest=live
      ?await api('/rest/v1/operator_presence?select=operator_id,building_id,state,last_heartbeat_at&order=operator_id.asc')
      :(demoPresence?[demoPresence]:[]);
    if(version!==presenceRead)return;
    presenceRows=latest;
    presenceError='';
  }catch(e){
    if(version!==presenceRead)return;
    presenceRows=[];
    presenceError=e.message;
  }
  if(page==='presence')showPresenceResults();
  if(page==='dispatch')showDispatchOptions();
}
async function configurePresence(values){
  const settings={building:values.building_id,state:values.state};
  if(settings.state==='offline')await stopPresenceSharing();
  else{
    await updatePresence(settings);
    if(!profile)return;
    stopPresence();
    sharedPresence=settings;
    presenceTimer=setInterval(()=>{
      if(sharedPresence!==settings)return;
      void updatePresence(settings).then(()=>refreshPresence()).catch(e=>toast(e.message));
    },90000);
  }
  await refreshPresence();
  toast(settings.state==='offline'?'已停止共享':'已开始共享状态');
}
function presencePage(){
  if(!buildingOptions().length)return noBuilding;
  return `<div class="grid">
    <section class="card"><h2>共享我的状态</h2>
    <p class="muted">用于楼宇内任务调度。开启后，每 90 秒上报所选楼宇、状态和最后心跳时间。教师管理员和该楼宇学生管理员可查看。5 分钟无心跳视为离线，24 小时到期清理，选择离线可立即删除本账号的状态。</p>
    <form id="presence-form">
      ${field('building_id','当前楼宇','select',sharedPresence?.building,buildingOptions())}
      ${field('state','我的状态','select',sharedPresence?.state||'offline',Object.entries(presenceLabels))}
      <p class="form-error" role="alert"></p><button class="primary">保存共享设置</button>
    </form></section>
    <section class="card"><h2>楼宇人员查询</h2>
      ${field('presence-building','查询楼宇','select','',buildingOptions())}
      <p><label><input type="checkbox" id="available-only" checked> 仅显示空闲学生管理员</label></p>
      <button type="button" id="presence-refresh">刷新状态</button><div id="presence-results" aria-live="polite"></div>
    </section></div>`;
}
function showPresenceResults(){
  const result=$('#presence-results'),building=$('#f-presence-building')?.value;
  if(!result)return;
  if(presenceError){result.textContent=presenceError;return;}
  const candidates=availableOperators(building);
  const people=$('#available-only').checked?candidates:data.profiles.filter(p=>studentBuilding(p,data.buildings.find(b=>b.id===building)));
  result.innerHTML=people.map(person=>{
    const presence=presenceRows.find(p=>p.operator_id===person.id&&p.building_id===building&&freshPresence(p));
    return `<div class="row"><strong>${esc(person.name)}</strong><span>${presenceLabels[presence?.state||'offline']}${presence?' · '+esc(localTime(presence.last_heartbeat_at,true)):''}</span></div>`;
  }).join('')||'<p class="muted">未找到符合条件的人员。</p>';
}
function dispatchPage(){
  const tasks=rows('tasks').filter(t=>canManageBuilding(t.building_id)&&pendingTask(t));
  if(!tasks.length)return '<div class="empty">暂无可指派任务。</div>';
  return `<div class="card"><form id="dispatch-form">
    <label for="dispatch-task">待处理任务</label><select id="dispatch-task">${tasks.map(task=>
      `<option value="${esc(task.id)}">${esc(bname(task.building_id))} · ${esc(task.title)} · ${esc(pname(task.assignee_id))}</option>`).join('')}</select>
    <div id="dispatch-options"></div>
    <p class="form-error" role="alert"></p><button class="primary">确认指派</button>
  </form></div>`;
}
function showDispatchOptions(){
  const target=$('#dispatch-options'),task=rows('tasks').find(t=>t.id===$('#dispatch-task')?.value);
  if(!target||!task)return;
  const previous=target.dataset.task===task.id?target.dataset.selected:null;
  target.dataset.task=task.id;
  target.dataset.selected=previous||'';
  const recommended=availableOperators(task.building_id);
  const building=data.buildings.find(b=>b.id===task.building_id);
  const other=data.profiles.filter(p=>studentBuilding(p,building)&&!recommended.some(r=>r.id===p.id));
  const ordered=[...recommended,...other];
  target.innerHTML=`<p class="muted">${esc(presenceError|| (recommended.length?'优先显示当前在本楼宇的空闲学生管理员。':'当前暂无空闲推荐，可以手动指派。'))}</p>`
    +field('assignee_id','执行人','select',previous||recommended[0]?.id||task.assignee_id,
      ordered.map(p=>[p.id,p.name+(recommended.some(r=>r.id===p.id)?' · 空闲推荐':'')]));
  $('#f-assignee_id').onchange=e=>{target.dataset.selected=e.target.value;};
  $('#dispatch-form button').disabled=!ordered.length;
}
function accountsPage(){
  return `<section class="card"><h2>二级 · 学生管理员</h2>
    <p class="muted">新账号先在 Supabase Authentication 创建，再将用户 UUID 登记到本系统。</p>
    <button type="button" id="new-student">登记学生管理员</button>
    ${data.profiles.filter(p=>p.role==='manager').map(p=>{
      const buildings=data.buildings.filter(b=>b.manager_id===p.id||b.id===p.assigned_building_id);
      return `<div class="row"><div><strong>${esc(p.name)}</strong>
        <span class="muted">${p.active===false?'已停用':'在用'} · ${esc(buildings.map(b=>b.name).join('、')||'尚未分配楼宇')}</span>
        </div><button data-edit-student="${esc(p.id)}">管理账号</button></div>`;
    }).join('')}</section>`;
}
function studentAccount(id){
  if(role!=='admin')return;
  const student=id?data.profiles.find(p=>p.id===id&&p.role==='manager'):null;
  if(id&&!student)return;
  dialog(id?'管理学生管理员':'登记学生管理员',
    (id?'':field('id','Supabase 用户 UUID'))+field('name','姓名','text',student?.name)+
    field('assigned_building_id','分配楼宇','select',student?.assigned_building_id||'',[['','待分配'],...buildingOptions()])+
    field('active','账号状态','select',student?.active===false?'false':'true',[['true','在用'],['false','停用']]),
    v=>save('profiles',{...v,...(id?{}:{role:'manager'}),assigned_building_id:v.assigned_building_id||null,active:v.active==='true'},id));
}

const learningTopics=[
  ['无线网络连接','先核对网络名称与认证状态，并用另一台设备在同一区域复测。记录时间、楼宇、连接方式和错误现象。','同一楼宇多台设备无法接入时，首先记录什么？',['网络名称、时间和故障现象','用户登录密码','测速网站首页'],0],
  ['测速与复核','在同一位置、同一设备和同一连接方式下复测，并记录下载、上传及延迟。','哪组结果适合直接比较？',['不同地点的两次测试','相同设备、位置与连接方式的复测','一组有线与一组无线结果'],1],
  ['工单协同','提交工单时说明故障位置、发生时间、影响范围、复现步骤和已经做过的检查。','工单应该包含哪项信息？',['账号验证码','同学的登录凭据','影响范围和复现步骤'],2]
];
function learningPage(){
  return `<section class="card"><h2>网络运维知识库</h2>${learningTopics.map(([title,guide])=>
    `<details open><summary>${esc(title)}</summary><p>${esc(guide)}</p></details>`).join('')}</section>
    <section class="card"><h2>新人培训考核 · 自测</h2><form id="training-form">
    ${learningTopics.map(([, , question, answers],i)=>field('answer'+i,question,'select','',[['','请选择'],...answers.map((text,j)=>[String(j),text])])).join('')}
    <button class="primary">提交自测</button><p id="training-result" role="status"></p></form></section>`;
}

const operationPages={publish:publishPage,dispatch:dispatchPage,accounts:accountsPage,presence:presencePage,learning:learningPage};
function bindOperations(){
  const bindForm=(selector,action)=>$(selector)?.addEventListener('submit',e=>{
    e.preventDefault(); void busy(e.submitter,()=>action(Object.fromEntries(new FormData(e.target))));
  });
  document.querySelectorAll('[data-task]').forEach(button=>button.onclick=()=>taskDetail(button.dataset.task));
  document.querySelectorAll('[data-edit-student]').forEach(button=>button.onclick=()=>studentAccount(button.dataset.editStudent));
  $('#new-student')?.addEventListener('click',()=>studentAccount());
  bindForm('#publish-task',async values=>{
    if(!data.buildings.some(b=>b.id===values.building_id))throw Error('请选择楼宇');
    await save('tasks',{...values,status:'待完成',created_by:profile.id});
    page='tasks'; render(); toast('任务已发布，可前往任务指派页安排执行人');
  });
  bindForm('#dispatch-form',async values=>{
    if(!values.assignee_id)throw Error('请选择执行人');
    await save('tasks',{assignee_id:values.assignee_id},$('#dispatch-task').value);
    toast('任务已指派'); void refreshPresence();
  });
  bindForm('#presence-form',configurePresence);
  bindForm('#training-form',values=>{
    if(learningTopics.some((_,i)=>values['answer'+i]===''))throw Error('请完成全部题目');
    const score=learningTopics.filter((topic,i)=>values['answer'+i]===String(topic[4])).length;
    $('#training-result').textContent=`答对 ${score} / ${learningTopics.length} 题`;
  });
  $('#dispatch-task')?.addEventListener('change',()=>{showDispatchOptions(); void refreshPresence();});
  $('#f-presence-building')?.addEventListener('change',showPresenceResults);
  $('#available-only')?.addEventListener('change',showPresenceResults);
  $('#presence-refresh')?.addEventListener('click',()=>void refreshPresence());
  if(page==='presence')showPresenceResults();
  if(page==='dispatch')showDispatchOptions();
}


// Refresh the displayed candidates even when the viewer does not share their own status.
window.setInterval?.(()=>{
  if(profile&&(page==='presence'||page==='dispatch')&&!document.hidden)void refreshPresence();
},30000);

const rosterPage=window.RosterPage?.create({api,esc,live,allowed:()=>!!profile&&(!live||profile.active===true),visible:()=>page==='roster',render});
start();
