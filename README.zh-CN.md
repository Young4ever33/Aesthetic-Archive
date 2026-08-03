# Aesthetic Archive

[English README](./README.md)

Aesthetic Archive 是面向设计师的视觉知识工作区：把参考图整理为可搜索卡片、可复用 Prompt、个人审美库、Collage 画板和经过审核的公开广场。

## 当前状态

项目当前采用 Next.js + Supabase Auth/Postgres/Storage，并通过服务端 AI Gateway 调用视觉模型。未配置 Supabase 时仍保留本地浏览器草稿能力。

上线前请完整执行 `docs/RELEASE_CHECKLIST.md`，尤其确认图片授权、生产域名、SMTP、管理员账号和 AI Provider 网络连通性。

## 本地运行

要求：Node.js 20+、pnpm。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

入口：

- 宣传页：`http://localhost:5174/`
- 工作台：`http://localhost:5174/app`
- 个人审美库：`http://localhost:5174/app?tab=archive`
- 视觉库广场：`http://localhost:5174/app?tab=plaza`

验证命令：

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

## 目录结构

- `app/`：Next.js 页面、API、认证回调和样式。
- `lib/`：Supabase 客户端、校验、Provider 加密存储、AI Gateway 和使用记录。
- `public/local-mvp/`：工作区界面和公开案例数据。
- `public/local-mvp/legacy/updated/selected_pic/`：当前案例数据引用的图片素材，迁移数据路径前不要删除。
- `public/marketing/`、`public/brand/`：产品公开资源。
- `supabase/migrations/`：数据库、RLS、Storage、安全、可观测性和反馈迁移。
- `docs/`：部署、Supabase 设置、产品契约和发布清单。

根目录是唯一应用目录，不再使用 `apps/web`。

## 环境变量与密钥

根据 `.env.example` 创建本地 `.env.local`。`.env.local` 不能上传 GitHub。

必须配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROVIDER_ENCRYPTION_KEY`：Base64 编码的 32 字节密钥

可选配置：

- `AI_HTTP_PROXY`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `AI_REQUEST_TIMEOUT_MS`

Provider API Key 只在服务端加密保存。浏览器只能获得 `hasSecret` 等元数据；密钥不得进入 localStorage、请求、响应、日志、备份或 Git 历史。

## Supabase 设置

1. 创建 Supabase 项目。
2. 按文件名顺序执行 `supabase/migrations/`，或执行 `supabase/generated/apply_all_migrations.sql`。
3. 将生产 HTTPS 域名配置到 Auth Site URL 和 Redirect URL。
4. 配置邮件确认、密码找回和生产 SMTP。
5. 创建并验证 reviewer/admin 账号。
6. 确认部署服务器可以访问 AI Provider。生产环境不能依赖开发电脑上的 `127.0.0.1` 代理。

详见 `docs/SUPABASE_SETUP.md`、`docs/DEPLOYMENT.md` 和 `docs/RELEASE_CHECKLIST.md`。

## GitHub 上传规则

可以上传源代码、迁移文件、已确认有权重新分发的公开资源、`package.json`、`pnpm-lock.yaml` 和文档。不要上传：

- `.env`、`.env.local` 或任何密钥文件
- `.next/`、`node_modules/`、日志、覆盖率文件和本地导出
- 含私人卡片或 Provider 配置的浏览器备份
- 未确认授权的图片、截图和临时 QA 文件

## 许可证与图片

请阅读 `LICENSE`。商业上线前，确认 `public/` 下每张公开图片都属于自有、已授权或公共领域资源；否则应替换。
