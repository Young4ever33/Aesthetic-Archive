'use client';

import { FormEvent, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get('next') || '/app';
  return value === '/app' || value.startsWith('/app?') || value.startsWith('/authors/') || value === '/notifications' || value.startsWith('/notifications?') ? value : '/app';
}

export default function AuthPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const supabase = createSupabaseBrowserClient();
      const result = mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });

      if (result.error) throw result.error;
      setMessage(mode === 'sign-in' ? '登录成功，正在进入工作区。' : '注册成功，请先检查邮箱完成验证。');
      if (mode === 'sign-in') window.location.assign(safeNextPath());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '认证失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: '12vh auto', padding: 24 }}>
      <p className="eyebrow">AESTHETIC ARCHIVE / ACCOUNT</p>
      <h1>{mode === 'sign-in' ? '登录工作区' : '创建账号'}</h1>
      <p style={{ color: '#686868', lineHeight: 1.7 }}>账号用于隔离私人卡片、画板、收藏和 Provider 配置。</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        <label>
          邮箱
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10 }} />
        </label>
        <label>
          密码
          <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10 }} />
        </label>
        <button className="button primary" disabled={busy} type="submit">{busy ? '处理中…' : mode === 'sign-in' ? '登录' : '注册'}</button>
      </form>
      {message && <p role="status" style={{ marginTop: 16 }}>{message}</p>}
      <button className="button ghost" type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} style={{ marginTop: 16 }}>
        {mode === 'sign-in' ? '还没有账号？注册' : '已有账号？登录'}
      </button>
    </main>
  );
}
