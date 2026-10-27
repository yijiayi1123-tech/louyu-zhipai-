import {writeFileSync} from 'node:fs';
const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
// 未设置仓库变量时保留已提交的前端公钥配置。
if(!url && !key)process.exit(0);
if(Boolean(url)!==Boolean(key))throw Error('请同时配置 Supabase URL 与 Publishable Key');
if(url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw Error('Supabase URL 格式不正确');
if(key.startsWith('sb_secret_'))throw Error('禁止使用 secret key');
if(key.startsWith('ey')){let p;try{p=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString())}catch{throw Error('无效 JWT 公钥')}if(p.role!=='anon')throw Error('仅允许 anon 公钥');}
writeFileSync('public/config.js','window.APP_CONFIG = '+JSON.stringify({supabaseUrl:url,supabaseKey:key})+';\n');

