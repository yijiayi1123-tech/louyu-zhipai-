# 楼宇智派

校园楼宇网络运维与劳动实践协作平台的初步原型。纯 HTML、CSS、JavaScript，无需安装依赖。前端托管 GitHub Pages，后端为 Supabase Auth + Postgres + RLS。

## 立即体验

在项目目录运行：

```powershell
node scripts/serve.mjs
```

访问 http://127.0.0.1:4173 。也可以直接打开 public/index.html。未配置 Supabase 时进入演示模式，切换管理员与明理楼楼长；数据仅存在当前浏览器。演示数据绝不会自动上传数据库。

## 已实现

- 管理员概览、楼宇创建及楼长分配、任务发布。
- 楼长工作台、任务状态和完成记录、实体巡查、人工测速。
- 工单登记和处理状态、公告发布及个人已读确认。
- 最近七天周报草稿及管理员审核。统计由程序计算，未接 AI。
- Supabase 邮箱密码登录、数据库行级权限、自动操作审计。
- 移动端自适应布局、搜索与任务/工单状态筛选。

## 连接 Supabase

1. 创建 Supabase 项目，在 SQL Editor 中运行 `supabase/schema.sql`。仅在全新数据库执行一次，脚本不是可重复迁移。
2. Authentication → Users 创建管理员和楼长账号；在 SQL Editor 中将对应 UUID 写入 profiles：

```sql
insert into public.profiles(id,name,role) values
('替换管理员UUID','管理员','admin'),
('替换楼长UUID','林同学','manager');
```

3. 项目设置中复制 Project URL 与 Publishable Key（兼容 anon 公钥）。本地使用时填写 `public/config.js`。
4. 使用管理员登录网页，创建楼宇并选择负责楼长，再发布任务。真实模式不会加载虚拟账号或虚拟楼宇。
5. 账号停用、角色和姓名调整在 SQL Editor 中修改 profiles。前端不支持自助注册或提升权限。登录会话保存在当前标签页的 sessionStorage，刷新页面可恢复，访问令牌自动续期；退出会清理本地会话。

仅使用浏览器可公开的 Publishable Key / anon key；不要填写 service_role 或 sb_secret_。安全性依赖 SQL 内的 RLS，而非公钥保密。

## GitHub Pages 部署与持续更新

1. 在 GitHub 创建仓库；将本目录代码上传到仓库根目录，保留 `.github/workflows/deploy.yml`。
2. 仓库 Settings → Pages → Source 选择 GitHub Actions。
3. Settings → Secrets and variables → Actions → Variables 添加：
   - SUPABASE_URL：项目 URL
   - SUPABASE_PUBLISHABLE_KEY：Publishable Key 或 anon 公钥
4. 推送 main 或 master，Actions 自动发布 public 目录；成功后 Pages 设置或部署任务中显示访问链接。仓库和套餐需支持 GitHub Pages。
5. 每次修改 public/app.js、public/style.css 等并推送，网站会自动更新。可以直接在 GitHub 网页编辑文件并提交。数据库数据保存在 Supabase，不随前端部署清空。
6. 如果两个变量均为空，工作流保留 public/config.js 中已有配置；只填一个会阻止部署。当前项目已填入项目 URL 和 Publishable Key；数据库已初始化，应用账号仍需创建。

已有本地 Git 仓库时：

```powershell
git remote add origin https://github.com/你的用户名/你的仓库.git
git push -u origin HEAD
```

当前仓库为 https://github.com/yijiayi1123-tech/louyu-zhipai- 。已连接插件但写入 API 返回 403，尚未上传或部署。若使用手动上传包，可按 DEPLOYMENT.md 选择 main 分支根目录发布，根目录入口会跳转 public/。

## 四人协作

A 负责 README、需求与验收；B 负责样式与交互；C 负责 public 页面逻辑；D 负责 supabase 数据结构与权限。建议分别开分支，通过 Pull Request 合入主分支。数据库后续变更请另建有序 migration，勿重复运行初始脚本。

## 验证

```powershell
node --check public/app.js
node scripts/test.mjs
```

自动检查覆盖演示数据持久化、角色范围、任务完成、测速录入、文本转义、时区、会话恢复、令牌续期、空更新和加载失败。另已在 Supabase 数据库事务中完成 RLS 权限实测并回滚全部测试数据；尚未使用真实应用账号完成浏览器端到端登录测试。

连接数据库后必须验证：管理员创建两个楼宇并分别分配两个楼长；楼长 A 只能读取自己楼宇，直接通过 REST 请求楼宇 B 的任务也应返回空；尝试改任务负责人应拒绝；楼长尝试发布公告、审核周报或修改角色应拒绝；停用后不能读取业务表。

## 初版范围

未实现附件上传、账号创建管理界面、专业运维人员调度、自动测速、AI 模型调用、编辑撤回公告及楼宇编辑。当前周报是可人工编辑的统计草稿，统计反映生成时状态，不还原历史时点。巡查、测速、工单之间未自动绑定任务，任务完成由楼长填写记录。工单跟进的每次变更保存在 audit_logs，尚无单独日志查看页面。所有网络数据由人工录入，不连接校园设备。

## 官方参考

- GitHub Pages 工作流：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Supabase RLS：https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase 公钥：https://supabase.com/docs/guides/api/api-keys



