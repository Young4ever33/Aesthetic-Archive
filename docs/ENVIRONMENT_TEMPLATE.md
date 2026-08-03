# Environment Variable Template

Create a local `.env.local` at the repository root for development, or configure the same variables in the production platform secret store. This file must never be committed. The current application is a root Next.js project; there is no `apps/web` directory.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PROVIDER_ENCRYPTION_KEY=replace-with-base64-32-byte-key
AI_HTTP_PROXY=
HTTP_PROXY=
HTTPS_PROXY=
AI_REQUEST_TIMEOUT_MS=120000
```

`PROVIDER_ENCRYPTION_KEY` must decode from Base64 to exactly 32 bytes. `SUPABASE_SERVICE_ROLE_KEY`, `PROVIDER_ENCRYPTION_KEY`, and proxy credentials are server-only secrets. They must not appear in browser storage, API responses, logs, screenshots, backups, or Git history.

For production, configure these values in Vercel/Cloudflare/your hosting platform's encrypted environment settings, scoped to the production deployment. Set the Supabase Auth Site URL and callback URL to the HTTPS production domain before smoke testing. The workspace security policy blocks automated creation of files named `.env*`; when creating the local file manually, copy the variables above and keep the file outside version control.
