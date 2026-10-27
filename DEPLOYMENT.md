# 当前部署进度

- Supabase 数据库已初始化，10 张业务表全部启用 RLS。
- 已在数据库事务中验证楼长隔离、任务反馈、不可改写字段、跨楼宇修改拦截、公告权限和账号停用；测试数据已回滚。
- Supabase 安全审计提示的系统函数公开执行权限已收紧。
- 尚未创建应用管理员账号，需在 Supabase Authentication → Users 中创建。控制台登录账号不会自动成为应用账号。
- GitHub 仓库可读，但当前插件写入 API 返回 403 Resource not accessible by integration。当前代码未上传，网站未部署。

## 手动上传并上线

1. 解压“楼宇智派-手动上传包.zip”。进入解压后的文件夹，将里面的全部文件和目录上传到 GitHub 仓库根目录（不要上传 ZIP 本身，也不要把所有文件再套进一个父目录）。
2. GitHub 仓库页面若为空，点击 uploading an existing file。上传后点击 Commit changes。
3. 打开仓库 Settings → Pages，在 Build and deployment 中选择 Deploy from a branch；分支 main，目录 /(root)，点击 Save。
4. 等待 GitHub 内置 Pages 部署完成；Settings → Pages 将显示实际访问地址。此包不需要额外设置仓库变量。
5. 日后修改 public 下的文件并提交，GitHub Pages 会重新发布，Supabase 数据不受影响。

只有 GitHub 显示发布成功并给出链接，才表示上线。当前没有验证通过的线上地址。
