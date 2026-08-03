'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Notification = { id: string; type: string; cardId: string | null; payload: Record<string, string>; read: boolean; createdAt: string; actor: { publicId: string; name: string; avatar: string } | null };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Request failed');
  return payload.data;
}

function notificationText(item: Notification) {
  const actor = item.actor?.name || '系统';
  const card = item.payload.cardTitle ? `《${item.payload.cardTitle}》` : '你的卡片';
  if (item.type === 'card_liked') return `${actor} 点赞了${card}`;
  if (item.type === 'author_followed') return `${actor} Follow 了你`;
  if (item.type === 'card_rejected') return `${card}未通过审核`;
  if (item.type === 'card_unpublished') return `${card}已下架`;
  return `${card}已审核并公开发布`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [status, setStatus] = useState('加载消息…');
  useEffect(() => {
    let active = true;
    api<{ items: Notification[] }>('/api/notifications?limit=50').then((data) => {
      if (active) { setItems(data.items); setStatus(''); }
    }).catch((error) => { if (active) setStatus(error instanceof Error ? error.message : '加载失败'); });
    return () => { active = false; };
  }, []);
  async function markRead(item: Notification) { if (!item.read) { await api(`/api/notifications/${item.id}`, { method: 'PATCH' }); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry)); } if (item.type === 'author_followed' && item.actor?.publicId) router.push(`/authors/${item.actor.publicId}`); else if (item.cardId) router.push(`/app?tab=plaza&card=${encodeURIComponent(item.cardId)}`); }
  async function readAll() { await api('/api/notifications/read-all', { method: 'PATCH' }); setItems((current) => current.map((item) => ({ ...item, read: true }))); }
  return <main className="social-page"><header className="social-topbar"><Link className="social-brand" href="/app?tab=plaza"><Image src="/brand/archive-mark.svg" width={23} height={23} alt=""/>Aesthetic Archive</Link><nav><Link href="/app?tab=plaza">返回工作台</Link></nav></header><section className="notifications-shell"><div className="social-toolbar"><div><p className="social-eyebrow">NOTIFICATIONS</p><h1>消息</h1><p>点赞、Follow 和卡片审核动态。</p></div><button className="social-button" onClick={readAll} disabled={!items.some((item) => !item.read)}>全部已读</button></div>{status && <div className="social-empty">{status}</div>}<div className="notification-list">{items.map((item) => <button key={item.id} className={`notification-row ${item.read ? '' : 'is-unread'}`} onClick={() => markRead(item)}><span className="notification-avatar" style={item.actor?.avatar ? { backgroundImage: `url(${item.actor.avatar})` } : undefined}>{item.actor?.avatar ? '' : item.actor?.name?.charAt(0) || 'AA'}</span><span><strong>{notificationText(item)}</strong><small>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</small></span>{!item.read && <i aria-label="未读"/>}</button>)}</div>{!items.length && !status && <div className="social-empty">暂时没有消息。</div>}</section></main>;
}
