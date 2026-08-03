'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Language = 'zh' | 'en';
type WhoKey = 'search' | 'folders' | 'patchwork';

const images = {
  hero: '/marketing/hero-editorial.png',
  who: '/marketing/who.png',
  why: '/marketing/why-editorial.png',
  how: '/marketing/how-editorial.png',
  reference: '/marketing/how-reference.png',
  card: '/marketing/how-card.png',
  try: '/marketing/try-placeholder.png',
  promptReference: '/marketing/prompt-reference-a04.webp',
  promptResultZh: '/marketing/prompt-result-zh.webp',
  promptResultEn: '/marketing/prompt-result-en.webp',
};

const copy = {
  zh: {
    lang: '中文', other: 'EN', what: 'What', who: 'Who', why: 'Why', how: 'How', try: 'Try', login: '登录', open: '开始建立资料',
    whatLabel: 'WHAT / AESTHETIC ARCHIVE', whatTitle: '帮助设计师建立自己的审美知识库。', whatBody: '把参考图、审美判断、文化背景、材料语言和可复用 Prompt 整理成可以搜索、解释、继续使用的设计资料。', whatNote: '当所有人的审美知识汇集起来，它便成为一个整合、有体系的共享知识库。', personal: '个人审美库', shared: '共享审美知识库', start: '从一张参考图开始',
    whoLabel: 'WHO / WORKING DESIGNERS', whoTitle: '给每个项目都要重新寻找意向图的设计师。', whoIntro: '意向图散落在文件夹、收藏夹和聊天记录里。需要的时候只能重新翻找，再用几张琐碎图片临时拼凑设计灵感。', whoTabs: { search: '每次重新搜索', folders: '在文件夹里翻找', patchwork: '临时拼凑方向' }, whoContent: { search: { title: '项目一开始，又打开搜索框。', body: '每做一个新项目，都要重新搜索相似风格、材料和氛围，过去做过的判断无法直接调用。', tag: '重复搜索 / RESTART' }, folders: { title: '保存了，却找不回来。', body: '图片被留下，却没有清楚的来源、语境和标签。文件夹越来越多，真正需要的那张图仍然藏在其中。', tag: '杂乱文件夹 / RETRIEVE' }, patchwork: { title: '用零散图片拼出一个方向。', body: '设计灵感依赖临时组合，很难说清楚为什么成立，也很难在下一次项目中准确复用。', tag: '临时拼图 / PATCHWORK' } },
    whyLabel: 'WHY / ACCUMULATE THE SYSTEM', whyTitle: '不要再停留在反复重复的工作里。', whyBody: '设计师最大的优势，不只是执行能力，而是长期积累的审美认知与设计体系。把这些判断整理、统筹起来，才能形成真正属于自己的知识库。', repeated: '反复重复的工作', accumulated: '审美认知与设计体系', repeatedItems: ['重新搜索意向图', '翻找项目文件夹', '临时拼凑灵感', 'Prompt 每次重试'], accumulatedItems: ['调用自己的审美资料', '理解风格为什么成立', '组合成可讨论的方向', '形成可复用 Prompt'], whyEnd: '从重复劳动，转向调用积累。',
    howLabel: 'HOW / FROM IMAGE TO KNOWLEDGE', howTitle: '一张参考图，经过分析、整理和组合，成为可以继续工作的审美资料。', howBody: '卡片不是一句图片描述，而是一套可以辅助未来生图、提案和设计讨论的结构化判断。', steps: [
      ['01', '输入参考图', '上传图片或从广场、收藏中调用，补充项目主题与上下文。', 'Reference'],
      ['02', '生成审美卡片', '提取文化背景、设计元素、材料、色彩、构图和双语 Prompt。', 'Generated Card'],
      ['03', '保存到个人库', '编辑字段、确认来源、保留自己的判断，形成可搜索的私人资料。', 'My Archive'],
      ['04', '加入 Collage 画板', '组合多张卡片，建立材料、色彩和空间关系可以被讨论的方向。', 'Collage Board'],
      ['05', '发布到共享广场', '经过审核和版权确认后，让个人积累成为其他设计师可以使用的知识。', 'Public Plaza'],
    ],
    tryLabel: 'TRY / START YOUR ARCHIVE', tryTitle: '从一张参考图开始，建立你的第一张审美卡片。', tryBody: '把已经保存但还没有整理的图片放进来，让它从一个文件变成可以继续使用的设计资料。', tryNote: '当前版本无需先注册，资料保存在你的本地工作区。', tryButton: '开始建立我的审美资料', storyWhisper: '一张图，不再只是被保存，而是被理解。', whyWhisper: '你不是没有想法，只是在一次次重新找回它。', imageCaption: '反复搜索、解释、重做，最后又回到空白。', tryWhisper: '不用整理完所有资料，先从一张开始。', sharedOrigin: '来自每个设计师的审美判断', miniPrompt: '文化背景 · 色卡 · Prompt', miniBoard: '+ 3 张卡片 / Collage 画板', validationTitle: 'Prompt 不是写完就结束，而是回到图像里验证。', validationBody: '同一张参考图分别生成中英文候选，按风格、构图、色彩和材质光感复评；A-04 双语卡片已通过用户验收。', validationLabels: ['REFERENCE / 参考图', '中文 PROMPT / 通过', 'EN PROMPT / PASSED'], validationMeta: '双语独立 Prompt · 每种语言 4 张候选 · 人工复评',
  },
  en: {
    lang: 'EN', other: '中文', what: 'What', who: 'Who', why: 'Why', how: 'How', try: 'Try', login: 'Log in', open: 'Start my archive',
    whatLabel: 'WHAT / AESTHETIC ARCHIVE', whatTitle: 'A place for designers to build their own aesthetic knowledge base.', whatBody: 'Turn references, aesthetic judgement, cultural context, material language and reusable prompts into searchable design knowledge.', whatNote: 'When everyone contributes their knowledge, it becomes an integrated and structured shared knowledge base.', personal: 'My Aesthetic Archive', shared: 'Shared Knowledge Base', start: 'Start with one reference',
    whoLabel: 'WHO / WORKING DESIGNERS', whoTitle: 'For designers who restart visual research on every project.', whoIntro: 'References are scattered across folders, saved posts and chats. When needed, designers search again and patch together a direction from fragments.', whoTabs: { search: 'Search again', folders: 'Dig through folders', patchwork: 'Patchwork a direction' }, whoContent: { search: { title: 'A new project starts with another search.', body: 'Every project means searching again for a similar mood, material or atmosphere. Past judgement cannot be called back directly.', tag: 'RESTART / SEARCH' }, folders: { title: 'Saved, but impossible to retrieve.', body: 'Images remain without clear context, source or tags. Folders multiply while the needed reference stays hidden.', tag: 'RETRIEVE / FOLDERS' }, patchwork: { title: 'A direction made from fragments.', body: 'Inspiration becomes a temporary collage that is hard to explain and harder to reuse in the next project.', tag: 'PATCHWORK / FRAGMENTS' } },
    whyLabel: 'WHY / ACCUMULATE THE SYSTEM', whyTitle: 'Stop spending your design time repeating the same work.', whyBody: 'A designer’s greatest advantage is not only execution. It is the aesthetic judgement and design system accumulated over time. Organise it into a knowledge base that belongs to you.', repeated: 'Repeated work', accumulated: 'Accumulated system', repeatedItems: ['Search for references again', 'Dig through project folders', 'Patch together inspiration', 'Restart the Prompt'], accumulatedItems: ['Call your own archive', 'Understand why a style works', 'Build a discussable direction', 'Reuse a stable Prompt'], whyEnd: 'Move from repeated labour to accumulated judgement.',
    howLabel: 'HOW / FROM IMAGE TO KNOWLEDGE', howTitle: 'One reference becomes design knowledge through analysis, organisation and composition.', howBody: 'A card is more than an image description. It is a structured judgement that supports future generation, proposals and design conversations.', steps: [
      ['01', 'Add a reference', 'Upload an image or call one from Plaza or Saved, then add project context.', 'Reference'],
      ['02', 'Generate a card', 'Extract cultural context, elements, materials, palette, composition and bilingual prompts.', 'Generated Card'],
      ['03', 'Save to My Archive', 'Edit fields, confirm the source and preserve your own judgement as searchable knowledge.', 'My Archive'],
      ['04', 'Compose a Collage Board', 'Combine cards to build a direction where material, colour and spatial relations can be discussed.', 'Collage Board'],
      ['05', 'Publish to Plaza', 'After review and rights confirmation, let personal accumulation become shared knowledge.', 'Public Plaza'],
    ],
    tryLabel: 'TRY / START YOUR ARCHIVE', tryTitle: 'Start with one reference and build your first aesthetic card.', tryBody: 'Bring in an image you have saved but never organised. Turn it from a file into design material you can use again.', tryNote: 'No account required in the current version. Your archive stays in this local workspace.', tryButton: 'Start my aesthetic archive', storyWhisper: 'One image is no longer just saved. It is understood.', whyWhisper: 'You do have ideas. You are just repeatedly trying to find them again.', imageCaption: 'Search, explain, rebuild, and return to a blank page.', tryWhisper: 'You do not need to organise everything. Start with one.', sharedOrigin: 'Built from every designer’s judgement', miniPrompt: 'cultural context · palette · prompt', miniBoard: '+ 3 cards / Collage Board', validationTitle: 'A Prompt is not finished until it returns to the image.', validationBody: 'Chinese and English candidates are generated from the same reference, then reviewed for style, composition, colour, material and light. The bilingual A-04 card passed user acceptance.', validationLabels: ['REFERENCE', '中文 PROMPT / PASSED', 'EN PROMPT / PASSED'], validationMeta: 'Bilingual isolated Prompts · 4 candidates per language · human review',
  },
};

export default function HomePage() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'zh';
    const stored = window.localStorage.getItem('aa_language');
    if (stored) return stored === 'en' ? 'en' : 'zh';
    return /^en/i.test(window.navigator.language || '') ? 'en' : 'zh';
  });
  const [activeScene, setActiveScene] = useState(0);
  const [whoTab, setWhoTab] = useState<WhoKey>('search');
  const t = copy[language];
  const who = t.whoContent[whoTab];
  const toggleLanguage = () => setLanguage((value) => {
    const next = value === 'zh' ? 'en' : 'zh';
    window.localStorage.setItem('aa_language', next === 'en' ? 'en' : 'zh-CN');
    return next;
  });

  useEffect(() => {
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-story-scene]')];
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      setActiveScene(Number((entry.target as HTMLElement).dataset.storyScene || 0));
    }), { threshold: 0.16 });
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="archive-landing" lang={language === 'zh' ? 'zh-CN' : 'en'}>
      <div className="story-progress" aria-hidden="true"><i style={{ transform: `scaleY(${(activeScene + 1) / 5})` }} /></div>
      <header className="archive-header">
        <Link className="archive-brand" href="/"><Image className="aa-plus-logo" src="/brand/archive-mark.svg" alt="" width={27} height={27} /><span className="brand-wordmark">Aesthetic Archive</span></Link>
        <nav aria-label="Page sections">
          {[['what', t.what], ['who', t.who], ['why', t.why], ['how', t.how], ['try', t.try]].map(([id, label], index) => (
            <a key={id} href={`#${id}`} className={activeScene === index ? 'is-active' : ''} aria-current={activeScene === index ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
        <div className="archive-actions"><button type="button" className="language-button" onClick={toggleLanguage} aria-label="Switch language">{t.lang} <span>/</span> {t.other}</button><Link className="login-button" href="/app?login=1">{t.login}</Link></div>
      </header>

      <section id="what" className="archive-hero scene-page what-section" data-story-scene="0">
        <div className="hero-copy"><p className="archive-kicker">{t.whatLabel}</p><h1>{t.whatTitle}</h1><p className="hero-body">{t.whatBody}</p><p className="what-note">{t.whatNote}</p><div className="hero-buttons"><Link className="solid-button" href="/app?tab=plaza">{t.open} <span>↗</span></Link><span className="hero-note">{t.start}</span></div></div>
        <div className="knowledge-bridge"><div className="hero-worktable"><Image className="hero-image-main" src={images.hero} alt="" width={900} height={700} priority /><Image className="hero-image-small" src={images.reference} alt="" width={420} height={320} priority /><div className="worktable-card"><span>01 / PERSONAL INPUT</span><strong>{t.personal}</strong><small>{t.start}</small></div></div><div className="bridge-line"><i /><span>organise · connect · share</span><i /></div><div className="shared-index"><span>02 / SHARED OUTPUT</span><strong>{t.shared}</strong><small>{t.sharedOrigin}</small></div></div>
      </section>

      <section id="who" className="archive-scene scene-page who-section" data-story-scene="1"><div className="section-copy"><p className="scene-label">{t.whoLabel}</p><h2>{t.whoTitle}</h2><p>{t.whoIntro}</p><div className="who-tabs" role="tablist">{(Object.keys(t.whoTabs) as WhoKey[]).map((key) => <button key={key} type="button" className={whoTab === key ? 'is-active' : ''} onClick={() => setWhoTab(key)}>{t.whoTabs[key]}</button>)}</div></div><div className="pain-scene"><div className="pain-image"><Image src={images.who} alt="" width={700} height={560} /><span>{who.tag}</span></div><div className="pain-index"><strong>{who.title}</strong><p>{who.body}</p><div className="file-fragments"><i>reference_01.jpg</i><i>final-final-2.png</i><i>moodboard-new</i></div></div></div></section>

      <section id="why" className="archive-scene scene-page why-section" data-story-scene="2"><div className="section-copy"><p className="scene-label">{t.whyLabel}</p><p className="story-whisper">{t.whyWhisper}</p><h2>{t.whyTitle}</h2><p>{t.whyBody}</p><strong className="why-end">{t.whyEnd}</strong></div><div className="why-visual"><Image src={images.why} alt="" width={1183} height={887} /><p className="image-story-caption">{t.imageCaption}</p><div className="why-compare"><div className="compare-column compare-old"><span>01 / {t.repeated}</span>{t.repeatedItems.map((item) => <div key={item}><b>×</b>{item}</div>)}</div><div className="compare-arrow">→</div><div className="compare-column compare-new"><span>02 / {t.accumulated}</span>{t.accumulatedItems.map((item) => <div key={item}><b>+</b>{item}</div>)}</div></div></div></section>

      <section id="how" className="archive-scene scene-page how-section" data-story-scene="3"><div className="section-copy"><p className="scene-label">{t.howLabel}</p><p className="story-whisper">{t.storyWhisper}</p><h2>{t.howTitle}</h2><p>{t.howBody}</p><div className="how-preview"><Image src={images.how} alt="" width={2304} height={1728} /></div></div><div className="how-flow">{t.steps.map(([number, title, body, label], index) => <div className="flow-step" key={number}><div className="flow-marker"><span>{number}</span>{index < t.steps.length - 1 && <i />}</div><div className="flow-content"><small>{label}</small><h3>{title}</h3><p>{body}</p>{index === 1 && <div className="mini-card"><Image src={images.card} alt="" width={160} height={100} /><div><strong>{language === 'zh' ? '安静的材料性' : 'Quiet materiality'}</strong><span>{t.miniPrompt}</span></div></div>}{index === 3 && <div className="mini-board"><Image src={images.reference} alt="" width={80} height={60} /><Image src={images.card} alt="" width={80} height={60} /><span>{t.miniBoard}</span></div>}</div></div>)}</div><div className="prompt-validation"><div className="validation-copy"><span>06 / GENERATION REVIEW</span><h3>{t.validationTitle}</h3><p>{t.validationBody}</p><small>{t.validationMeta}</small></div><div className="validation-strip">{[[images.promptReference, t.validationLabels[0], 1199, 1566], [images.promptResultZh, t.validationLabels[1], 1440, 810], [images.promptResultEn, t.validationLabels[2], 1440, 810]].map(([src, label, width, height], index) => <figure className={`validation-frame frame-${index + 1}`} key={String(src)}><Image src={String(src)} alt={`${label} · A-04`} width={Number(width)} height={Number(height)} sizes="(max-width: 760px) 82vw, 30vw" /><figcaption><b>0{index + 1}</b><span>{label}</span></figcaption></figure>)}</div></div></section>

      <section id="try" className="archive-final scene-page try-section" data-story-scene="4"><div><p className="archive-kicker">{t.tryLabel}</p><p className="story-whisper">{t.tryWhisper}</p><h2>{t.tryTitle}</h2><p>{t.tryBody}</p><Link className="solid-button" href="/app?tab=plaza">{t.tryButton} <span>↗</span></Link><small className="try-note">{t.tryNote}</small></div><div className="try-visual"><Image src={images.try} alt="" width={1200} height={896} /><div><span>{t.personal}</span><b>→</b><span>{t.shared}</span></div></div></section>
    </main>
  );
}
