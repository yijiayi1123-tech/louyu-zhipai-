import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

process.env.TZ='Asia/Shanghai';
const source=readFileSync('public/app.js','utf8').replace(/\nstart\(\);\s*$/,'');
function createContext(config={}){
  const store=new Map(),tabStore=new Map();
  const elements={app:{innerHTML:''},modal:{close(){}},toast:{style:{}},login:{}};
  const storage=map=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  const context=vm.createContext({window:{APP_CONFIG:config},document:{querySelector:s=>elements[s.slice(1)]||null,querySelectorAll:()=>[]},crypto:webcrypto,localStorage:storage(store),sessionStorage:storage(tabStore),console,Date,setTimeout:()=>0,fetch:()=>{throw Error('Unexpected fetch')}});
  vm.runInContext(source,context);
  vm.runInContext('render=()=>{};',context);
  return context;
}
const run=(context,code)=>vm.runInContext(code,context);
const response=(value,status=200)=>({ok:status<400,status,json:async()=>value});
const future=()=>Math.floor(Date.now()/1000)+3600;
const liveConfig={supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_publishable_test'};
function signedIn(context,expiresAt=future()){
  run(context,`setSession({access_token:'old-token',refresh_token:'old-refresh',expires_at:${expiresAt},user:{id:'admin'}});`);
}

const demo=createContext();
run(demo,'data=seed(); profile=data.profiles[0];');
assert.equal(run(demo,"rows('buildings').length"),3);
assert.equal(run(demo,"rows('tasks').length"),3);
run(demo,"role='manager'; profile=data.profiles.find(p=>p.id==='u1');");
assert.equal(run(demo,"rows('buildings').length"),1);
assert.equal(run(demo,"rows('tasks').length"),1);
assert.equal(run(demo,"rows('tasks')[0].building_id"),'b1');
assert.equal(run(demo,"rows('announcements').length"),1);
await run(demo,"save('speed_tests',{building_id:'b1',download:100,upload:30,latency:12})");
assert.equal(run(demo,"rows('speed_tests').length"),1);
await run(demo,"save('tasks',{status:'已完成',completion_note:'巡查完毕'},rows('tasks')[0].id)");
assert.equal(run(demo,"rows('tasks')[0].status"),'已完成');
assert.equal(run(demo,'data.audit_logs.length'),2);
assert.equal(run(demo,"esc('<script>')"),'&lt;script&gt;');
assert.equal(run(demo,"date(new Date('2026-10-27T18:30:00Z'))"),'2026-10-28');
assert.equal(run(demo,"localTime('2026-10-27T18:30:00Z',true)"),'2026-10-28 02:30');
for(const page of ['tasks','tickets','speed_tests','inspections','announcements','weekly_reports','buildings'])run(demo,`page='${page}';list()`);
run(demo,"page='tickets';");
assert.ok(run(demo,"tableCells({title:'问题',completion_note:'现场已复核'})[0]").includes('现场已复核'));

// RLS can return a successful response with zero updated rows.
const patch=createContext(liveConfig);
signedIn(patch);
patch.fetch=async(url,options)=>{assert.equal(options.method,'PATCH');assert.equal(options.headers.Prefer,'return=representation');return response([])};
await assert.rejects(run(patch,"save('tasks',{status:'已完成'},'task-1')"),/记录未更新/);
patch.fetch=async()=>response([{id:'task-1'}]);
run(patch,"load=async()=>{throw Error('网络中断')};");
await assert.rejects(run(patch,"save('tasks',{status:'已完成'},'task-1')"),/记录已保存.*避免重复提交/);

// Concurrent requests share one refresh and persist the rotated token.
const refresh=createContext(liveConfig);
signedIn(refresh,1);
let refreshes=0,requests=0;
refresh.fetch=async(url,options)=>{
  if(url.includes('grant_type=refresh_token')){
    refreshes++;
    assert.equal(JSON.parse(options.body).refresh_token,'old-refresh');
    assert.equal(options.headers.Authorization,undefined);
    await Promise.resolve();
    return response({access_token:'new-token',refresh_token:'new-refresh',expires_in:3600,user:{id:'admin'}});
  }
  requests++;
  assert.equal(options.headers.Authorization,'Bearer new-token');
  return response([]);
};
await Promise.all([run(refresh,"api('/rest/v1/tasks?select=*')"),run(refresh,"api('/rest/v1/tickets?select=*')")]);
assert.equal(refreshes,1);
assert.equal(requests,2);
assert.equal(run(refresh,'JSON.parse(sessionStorage.getItem(sessionKey)).refresh_token'),'new-refresh');

// A server-rejected JWT gets one refresh/retry before local expiry too.
const retry=createContext(liveConfig);
signedIn(retry);
const calls=[];
retry.fetch=async(url,options)=>{
  calls.push(url);
  if(url.includes('grant_type=refresh_token'))return response({access_token:'retry-token',refresh_token:'retry-refresh',expires_in:3600,user:{id:'admin'}});
  return options.headers.Authorization==='Bearer old-token'?response({message:'JWT expired'},401):response([]);
};
await run(retry,"api('/rest/v1/tasks?select=*')");
assert.equal(calls.length,3);

// Expired refresh credentials clear private state and return to login.
const expired=createContext(liveConfig);
signedIn(expired,1);
run(expired,"data={tickets:[{title:'private'}]};profile={id:'admin'};");
expired.fetch=async()=>response({message:'Invalid refresh token'},400);
await assert.rejects(run(expired,"api('/rest/v1/tasks?select=*')"),/登录已过期/);
assert.equal(run(expired,'session'),null);
assert.equal(run(expired,'Object.keys(data).length'),0);
assert.equal(run(expired,'sessionStorage.getItem(sessionKey)'),null);

// Loading is ordered and atomic; an interrupted reload keeps the prior snapshot.
const loading=createContext(liveConfig);
signedIn(loading);
run(loading,"data={buildings:[{id:'before'}]};profile={id:'admin'};");
loading.fetch=async(url)=>{
  assert.ok(url.includes('&order='));
  if(url.includes('/profiles?'))return response([{id:'admin',active:true,role:'admin',name:'管理员'}]);
  if(url.includes('/tickets?'))throw Error('offline');
  return response([]);
};
await assert.rejects(run(loading,'load()'),/网络连接失败/);
assert.equal(run(loading,'data.buildings[0].id'),'before');
loading.fetch=async(url)=>response(url.includes('/profiles?')?[{id:'admin',active:true,role:'admin',name:'管理员'}]:[]);
await run(loading,'load()');
assert.equal(run(loading,'Object.keys(data).length'),10);
assert.equal(run(loading,'role'),'admin');

// Reloading restores only this tab session and reloads authorized data.
const restored=createContext(liveConfig);
run(restored,`sessionStorage.setItem(sessionKey,JSON.stringify({access_token:'restore-token',refresh_token:'restore-refresh',expires_at:${future()},user:{id:'admin'}}));`);
restored.fetch=async(url)=>response(url.includes('/profiles?')?[{id:'admin',active:true,role:'admin',name:'管理员'}]:[]);
await run(restored,'start()');
assert.equal(run(restored,'session.access_token'),'restore-token');
assert.equal(run(restored,'profile.id'),'admin');
run(restored,'clearSession()');
assert.equal(run(restored,'sessionStorage.getItem(sessionKey)'),null);

console.log('PASS: demo role scope, persistence, progress feedback, local dates, list renderers, zero-row update rejection, save/reload errors, token rotation, shared refresh, JWT retry, expired-session cleanup, atomic ordered loading, tab session restore.');
