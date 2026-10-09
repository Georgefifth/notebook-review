# GitHub Pages 前端 + 可选 Supabase 后端

当前仓库：https://github.com/Georgefifth/notebook-review
公开演示：https://georgefifth.github.io/notebook-review/

GitHub Pages只托管静态HTML/CSS/JS，不运行api/config.js、Notebook内核或数据库。[官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。未配置Supabase时，只能使用本浏览器的导入、评论、对照和导出；界面明确显示本地演示。静态前端配置好外部Supabase后，可以直接调用其Auth与REST，但服务本身不在Pages中。

## 默认Pages部署

Pages设置选择GitHub Actions。`.github/workflows/pages.yml`先在Node22执行核心/数据库/浏览器测试，再构建dist并部署。main推送会重新部署。构建使用相对资源路径，支持仓库子路径；仅dist发布，数据库SQL和测试不会作为网站文件上传。

无仓库变量时，config.json包含`{"configured":false}`。不要把环境文件或密钥加入代码。源码中只有合成Notebook与测试账户。

## 启用真实在线协作

1. 创建专用Supabase项目，在SQL Editor执行database/schema.sql。
2. 如果已装过旧版schema，仅执行database/migrate-v2.sql；不要重建表。该增量迁移保留评论，并增加本次修订复核字段。本轮用户尚未创建数据库，因此无需迁移现有服务。
3. 获取项目URL和publishable key或旧公开anon JWT。**不需要service_role、数据库密码或SMTP密码交给前端。**
4. 在GitHub仓库 Settings → Secrets and variables → Actions → Variables 添加：

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

旧公开key可用SUPABASE_ANON_KEY代替。它们是公开浏览器配置，构建只允许公开key，提供不完整/secret配置时失败，防止假装连接成功。未启用后端时不需添加变量。

5. 在Supabase Auth Email Templates的Magic Link模板加入`{{ .Token }}`；应用使用邮箱验证码登录。配置自有SMTP：内置测试邮件服务有收件人和频率限制。Auth Site URL设为部署URL。若启用CAPTCHA，需要先补充前端对应交互。
6. 手动触发Pages workflow；构建会生成仅含公开配置的config.json和只允许相应HTTPS连接的CSP meta。Pages不支持应用自定义HTTP响应头；meta无法设置frame-ancestors等仅header支持的指令。

[Supabase OTP文档](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [SMTP文档](https://supabase.com/docs/guides/auth/auth-smtp)

## 必须执行的真实在线验收（当前未通过）

- Owner实际收取验证码并登录，导入合成示例、共享、邀请第二邮箱。
- Reviewer用受邀邮箱登录并评论；Owner收到反馈。
- Owner提交新版，Reviewer刷新后核对；确认新版已复核后反馈退出待处理；再次变化重新提示。
- 非受邀第三邮箱无法访问；撤销邀请后新的读写立即被拒。
- 本次没有Supabase项目，自动化Auth/REST是模拟接口，不能替代以上测试。

## 可选Vercel与本机

Vercel Other框架，build=`node build.mjs`，output=`dist`，设置相同公开变量。api/config.js仍可用，但客户端读取静态config.json；修改变量需要重新构建。使用自托管Supabase域名时同时更新vercel.json的connect-src。Vercel可能设置部署访问保护，分享前核对。

本机：`npm ci && npm start`。配置服务可用`node --env-file=.env dev-server.mjs`；.env被Git排除。预览服务仅监听127.0.0.1。

构建产物/线上验收：`npm run build`；`node scripts/smoke.mjs https://georgefifth.github.io/notebook-review/`。此脚本始终验证公开前端的合成示例流程；即使配置了Supabase，它也不会登录或测试后端。真实在线能力必须使用上面的验收流程。
