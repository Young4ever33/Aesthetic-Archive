'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import seedCards from '@/public/local-mvp/src/data/cases.json';

type Author = { publicId: string; name: string; avatar: string; identity: string; bio: string; designFocus: string; isSystem: boolean; isSelf: boolean; following: boolean; followerCount: number; followingCount: number; cardCount: number };
type Card = { id: string; title: string; titleZh: string; category: string; summary?: string; image?: string; likeCount: number; isSystem: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Request failed');
  return payload.data;
}

export default function AuthorPage({ params }: { params: Promise<{ publicId: string }> }) {
  const [publicId, setPublicId] = useState('');
  const [author, setAuthor] = useState<Author | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [sort, setSort] = useState<'newest' | 'liked'>('newest');
  const [status, setStatus] = useState('加载作者资料…');
  const [busy, setBusy] = useState(false);

  useEffect(() => { params.then((value) => setPublicId(value.publicId)); }, [params]);
  useEffect(() => {
    if (!publicId) return;
    Promise.all([api<Author>(`/api/authors/${publicId}`), api<Card[]>(`/api/authors/${publicId}/cards?sort=${sort}`)])
      .then(([nextAuthor, nextCards]) => { setAuthor(nextAuthor); setCards(nextCards); setStatus(''); })
      .catch((error) => setStatus(error.message));
  }, [publicId, sort]);

  const initials = useMemo(() => author?.name.trim().charAt(0).toUpperCase() || 'AA', [author]);
  const seedMap = useMemo(() => new Map(seedCards.map((card) => [card.id, card])), []);
  async function toggleFollow() {
    if (!author || author.isSelf || busy) return;
    setBusy(true);
    try {
      const result = await api<{ following: boolean; followerCount: number }>(`/api/authors/${publicId}/follow`, { method: author.following ? 'DELETE' : 'POST' });
      setAuthor({ ...author, following: result.following, followerCount: result.followerCount });
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Follow 操作失败'); }
    finally { setBusy(false); }
  }

  return <main className="social-page">
    <header className="social-topbar"><Link className="social-brand" href="/app?tab=plaza"><Image src="/brand/archive-mark.svg" width={23} height={23} alt=""/>Aesthetic Archive</Link><nav><Link href="/app?tab=plaza">视觉库广场</Link><Link href="/notifications">消息</Link></nav></header>
    <section className="author-shell">
      {status && !author ? <div className="social-empty">{status}</div> : author && <>
        <header className="author-header">
          <div className={`author-page-avatar ${author.avatar ? 'has-image' : ''}`} style={author.avatar ? { backgroundImage: `url(${author.avatar})` } : undefined}>{author.avatar ? '' : initials}</div>
          <div className="author-heading"><p>{author.identity}</p><h1>{author.name}</h1><div className="author-stats"><span><b>{author.cardCount}</b> 公开卡片</span><span><b>{author.followerCount}</b> Followers</span><span><b>{author.followingCount}</b> Following</span></div></div>
          {author.isSelf ? <Link className="social-button" href="/app?tab=settings">编辑资料</Link> : <button className={`social-button ${author.following ? 'is-active' : ''}`} onClick={toggleFollow} disabled={busy}>{busy ? '处理中…' : author.following ? 'Following' : 'Follow'}</button>}
        </header>
        {(author.bio || author.designFocus) && <div className="author-about">{author.bio && <p>{author.bio}</p>}{author.designFocus && <p><strong>设计方向</strong>{author.designFocus}</p>}</div>}
        <div className="social-toolbar"><div><h2>公开卡片</h2><p>仅展示已审核并公开发布的作品。</p></div><div className="social-segment"><button className={sort === 'newest' ? 'is-active' : ''} onClick={() => setSort('newest')}>最新</button><button className={sort === 'liked' ? 'is-active' : ''} onClick={() => setSort('liked')}>最多点赞</button></div></div>
        {status && <p className="social-error">{status}</p>}
        <div className="author-card-grid">{cards.map((card) => { const seed = card.isSystem ? seedMap.get(card.id) : null; const image = card.image || (seed?.image ? `/local-mvp/legacy/updated/${seed.image}` : ''); return <article key={card.id} className="author-card"><a href={`/app?tab=plaza&card=${encodeURIComponent(card.id)}`}><div className="author-card-image">{image ? <Image src={image} width={640} height={480} unoptimized alt=""/> : <span>{card.id}</span>}</div><div><small>{card.category}</small><h3>{card.titleZh || card.title}</h3><p>{card.title}</p><strong>♡ {card.likeCount}</strong></div></a></article>; })}</div>
        {!cards.length && !status && <div className="social-empty">该作者还没有公开卡片。</div>}
      </>}
    </section>
  </main>;
}
