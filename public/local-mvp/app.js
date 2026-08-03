const publicCases = window.AA_CASES || [];
let cases = [...publicCases];
let cloudState = 'unknown';
let cloudCards = [];
let cloudPublicCards = [];
let cloudSaved = new Set();
let cardInteractions = new Map();
let cloudBoardId = null;
let cloudBoardSyncTimer = null;
let cloudBoardSyncInFlight = false;
let cloudBoardSyncQueued = false;

function cloudCardToLocal(card) {
  return {
    ...card,
    id: card.id,
    source: card.source || 'private',
    ownerId: card.owner_id || null,
    titleZh: card.title_zh || '',
    visibility: card.visibility || 'private',
    publishStatus: card.publish_status || 'private',
    historicalOrigin: card.cultural_background || '',
    culturalBackground: card.cultural_background || '',
    designElements: card.design_elements || '',
    designLogic: card.design_elements || '',
    palette: card.palette || [],
    styleTags: card.style_tags || [],
    materialTags: card.material_tags || [],
    spaceTags: card.space_tags || [],
    scenarioTags: card.scenario_tags || [],
    useCases: card.use_cases || '',
    promptZh: card.prompt_zh || '',
    promptEn: card.prompt_en || '',
    negativePrompt: card.negative_prompt || '',
    author: card.author || null,
    likeCount: Number(card.likeCount || 0),
    likedByViewer: Boolean(card.likedByViewer),
    savedCount: Number(card.savedCount || 0),
    ownCard: Boolean(card.ownCard),
    createdAt: card.created_at,
    updatedAt: card.updated_at
  };
}

function cloudNodeToLocal(node) {
  const data = node?.data && typeof node.data === 'object' ? node.data : {};
  return { ...data, nodeId: data.nodeId || node.id, refId: data.refId || node.ref_card_id || null, type: data.type || node.type || 'image', x: Number(node.x) || 0, y: Number(node.y) || 0, w: Number(node.w) || 120, h: Number(node.h) || 80, rotation: Number(node.rotation) || 0, z: Number(node.z) || 1 };
}

function cloudBoardToLocal(board) {
  return normalizeBoard({
    version: 2,
    tool: 'select',
    selectedId: null,
    items: (board?.nodes || []).map(cloudNodeToLocal),
    strokes: (board?.strokes || []).map(stroke => ({ points: stroke.points || [], color: stroke.color || '#111111', size: Number(stroke.size) || 3, z: Number(stroke.z) || 1 })),
    summary: board?.summary || '',
    penColor: '#111111',
    penSize: 3
  });
}

function localBoardToCloud(board) {
  return {
    board: { title: 'Collage Board', summary: typeof board.summary === 'string' ? board.summary : null, visibility: 'private' },
    nodes: (board.items || []).slice(0, 200).map(item => ({
      ref_card_id: typeof item.refId === 'string' && /^[0-9a-f-]{36}$/i.test(item.refId) ? item.refId : null,
      type: item.type || 'image',
      data: item,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      w: Math.min(2400, Math.max(20, Number(item.w) || 120)),
      h: Math.min(2400, Math.max(20, Number(item.h) || 80)),
      rotation: Number(item.rotation) || 0,
      z: Number(item.z) || 1
    })),
    strokes: (board.strokes || []).slice(0, 500).map(stroke => ({
      points: Array.isArray(stroke.points) ? stroke.points.slice(0, 5000) : [],
      color: typeof stroke.color === 'string' ? stroke.color : '#111111',
      size: Math.min(40, Math.max(1, Number(stroke.size) || 3)),
      z: Number(stroke.z) || 1
    }))
  };
}

async function persistCloudBoard() {
  if (cloudState !== 'online') return;
  const board = getCollageBoard();
  try {
    if (!cloudBoardId) {
      const created = await cloudRequest('/api/boards', { method: 'POST', body: JSON.stringify({ title: 'Collage Board', summary: board.summary || null, visibility: 'private' }) });
      cloudBoardId = created?.id || null;
    }
    if (!cloudBoardId) return;
    await cloudRequest(`/api/boards?id=${encodeURIComponent(cloudBoardId)}`, { method: 'PATCH', body: JSON.stringify(localBoardToCloud(board)) });
  } catch (error) {
    console.warn('Cloud board sync failed:', error);
    cloudBoardSyncQueued = true;
  }
}

function scheduleCloudBoardSync() {
  if (cloudState !== 'online') return;
  cloudBoardSyncQueued = true;
  clearTimeout(cloudBoardSyncTimer);
  cloudBoardSyncTimer = setTimeout(async () => {
    if (cloudBoardSyncInFlight) return;
    cloudBoardSyncInFlight = true;
    cloudBoardSyncQueued = false;
    await persistCloudBoard();
    cloudBoardSyncInFlight = false;
    if (cloudBoardSyncQueued) scheduleCloudBoardSync();
  }, 500);
}

async function syncCloudBoard() {
  const response = await fetch('/api/boards', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('board cloud unavailable');
  const payload = await response.json();
  const boards = Array.isArray(payload.data) ? payload.data : [];
  const local = normalizeBoard();
  if (boards[0]) {
    cloudBoardId = boards[0].id;
    saveCollageBoard(cloudBoardToLocal(boards[0]), false);
  } else if (local.items.length || local.strokes.length || local.summary) {
    await persistCloudBoard();
  }
}

async function syncCloudWorkspace() {
  try {
    const [cardsResponse, publicResponse, savedResponse] = await Promise.all([
      fetch('/api/cards?scope=mine', { credentials: 'same-origin' }),
      fetch('/api/cards?scope=public', { credentials: 'same-origin' }),
      fetch('/api/saved', { credentials: 'same-origin' })
    ]);
    if (!cardsResponse.ok || !publicResponse.ok || !savedResponse.ok) throw new Error('cloud unavailable');
    const cardsPayload = await cardsResponse.json();
    const publicPayload = await publicResponse.json();
    const savedPayload = await savedResponse.json();
    cloudCards = (cardsPayload.data || []).map(cloudCardToLocal);
    cloudPublicCards = (publicPayload.data || []).map(cloudCardToLocal);
    cloudSaved = new Set((savedPayload.data || []).map(item => item.card_id));
    cloudState = 'online';
    cases = mergeDisplayCases(publicCases, cloudPublicCards, cloudCards);
    renderCards(); renderArchive(); updateSavedUI();
    await syncCardInteractions();
    await syncUnreadCount();
    await syncCloudBoard();
    renderCollage();
    return true;
  } catch {
    cloudState = 'offline';
    return false;
  }
}

async function syncCardInteractions() {
  if (cloudState !== 'online') return;
  const keys = [...new Set(cases.map(item => item.id).filter(Boolean))].slice(0, 100);
  if (!keys.length) return;
  try {
    const payload = await cloudRequest(`/api/cards/interactions?keys=${encodeURIComponent(keys.join(','))}`);
    cardInteractions = new Map(Object.entries(payload || {}));
    cases.forEach(item => {
      const interaction = cardInteractions.get(item.id);
      if (interaction) Object.assign(item, interaction);
    });
    renderCards(); renderArchive(); updateSavedUI();
    if (state.selectedCase) {
      const interaction = cardInteractions.get(state.selectedCase.id);
      if (interaction) Object.assign(state.selectedCase, interaction);
      renderDetailLike(state.selectedCase);
      renderDetailAuthor(state.selectedCase);
    }
  } catch (error) { console.warn('Card interactions unavailable:', error); }
}

async function syncUnreadCount() {
  const button = document.getElementById('notification-button');
  const badge = document.getElementById('notification-count');
  if (!button || !badge || cloudState !== 'online') return;
  try {
    const response = await fetch('/api/notifications/unread-count', { credentials: 'same-origin' });
    if (!response.ok) return;
    const payload = await response.json();
    const count = Number(payload.data?.count || 0);
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    button.setAttribute('aria-label', count ? `${count} 条未读消息` : '消息');
  } catch {}
}

function cardDedupeKey(item) {
  const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return [normalize(item.title), normalize(item.titleZh), normalize(item.category)].join('|');
}

function cardCompleteness(item) {
  return (item.image ? 8 : 0) + (Array.isArray(item.gallery) ? item.gallery.length * 2 : 0) + (item.summary ? 2 : 0) + (item.promptEn ? 1 : 0) + (item.designElements ? 1 : 0);
}

function mergeDisplayCases(...groups) {
  const merged = new Map();
  groups.flat().forEach(item => {
    const key = cardDedupeKey(item) || item.id;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      return;
    }
    const isCloudId = value => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(value || ''));
    const cloud = isCloudId(item.id) ? item : isCloudId(existing.id) ? existing : null;
    const richer = cardCompleteness(item) > cardCompleteness(existing) ? item : existing;
    merged.set(key, {
      ...richer,
      ...(cloud || {}),
      image: richer.image || cloud?.image || '',
      gallery: (richer.gallery?.length ? richer.gallery : cloud?.gallery) || [],
      palette: richer.palette?.length ? richer.palette : (cloud?.palette || []),
      styleTags: richer.styleTags?.length ? richer.styleTags : (cloud?.styleTags || [])
    });
  });
  return [...merged.values()];
}

async function uploadCardImages(cardId, images) {
  const localImages = images.filter(src => /^data:image\/(jpeg|png|webp);base64,/i.test(src));
  for (const [index, dataUrl] of localImages.entries()) {
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
    if (!match) continue;
    const blob = await (await fetch(dataUrl)).blob();
    const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
    const form = new FormData();
    form.append('cardId', cardId);
    form.append('file', new File([blob], `reference-${index + 1}.${extension}`, { type: match[1] }));
    const response = await fetch('/api/images', { method: 'POST', credentials: 'same-origin', body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Image upload failed (${response.status})`);
  }
}

async function cloudRequest(url, options = {}) {
  if (cloudState !== 'online') return null;
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Cloud API ${response.status}`);
  return payload.data;
}

const state = {
  activeTab: 'plaza',
  activeCategory: 'All',
  query: '',
  selectedCase: null,
  currentGallery: [],
  editingPrivateId: null,
  boardUndo: [],
  boardRedo: []
};

const STORAGE = {
  saved: 'aa_saved_cases_v2',
  provider: 'aa_ai_provider_settings',
  providers: 'aa_ai_providers_v1',
  privateCases: 'aa_private_cases_v1',
  collage: 'aa_collage_board_v1',
  language: 'aa_language',
  user: 'aa_demo_user',
  preferences: 'aa_workspace_preferences_v1',
  profile: 'aa_workspace_profile_v1',
  templates: 'aa_card_templates_v1',
  usageStats: 'aa_usage_stats_v1'
};

const els = {
  grid: document.getElementById('case-grid'),
  resultCount: document.getElementById('result-count'),
  savedCount: document.getElementById('saved-count'),
  savedGrid: document.getElementById('saved-grid'),
  archiveGrid: document.getElementById('archive-grid'),
  archiveForm: document.getElementById('archive-form'),
  archiveSubmit: document.querySelector('#archive-form button[type="submit"]'),
  archiveReset: document.querySelector('#archive-form button[type="reset"]'),
  archiveFile: document.getElementById('archive-file'),
  archiveImage: document.getElementById('archive-image'),
  archiveImagePreview: document.getElementById('archive-image-preview'),
  archiveAiBtn: document.getElementById('archive-ai-btn'),
  archiveAiStatus: document.getElementById('archive-ai-status'),
  archiveClearImage: document.getElementById('archive-clear-image-btn'),
  archiveSaveStatus: document.getElementById('archive-save-status'),
  archiveNewCard: document.getElementById('archive-new-card-btn'),
  archiveHealth: document.getElementById('archive-storage-health'),
  search: document.getElementById('style-search'),
  loginPopover: document.getElementById('login-popover'),
  loginClose: document.getElementById('login-close'),
  loginForm: document.getElementById('login-form'),
  loginIdentity: document.getElementById('login-identity'),
  loginEmail: document.getElementById('login-email-btn'),
  loginGoogle: document.getElementById('login-google-btn'),
  logout: document.getElementById('logout-btn'),
  overlay: document.getElementById('detail-overlay'),
  closeDetail: document.getElementById('detail-close'),
  mainImage: document.getElementById('detail-main-image'),
  thumbs: document.getElementById('detail-thumbs'),
  galleryNote: document.getElementById('detail-gallery-note'),
  detailCategory: document.getElementById('detail-category'),
  detailTitle: document.getElementById('detail-title'),
  detailSubtitle: document.getElementById('detail-subtitle'),
  detailCultural: document.getElementById('detail-cultural'),
  detailElements: document.getElementById('detail-elements'),
  detailPalette: document.getElementById('detail-palette'),
  detailComposition: document.getElementById('detail-composition'),
  detailUseCases: document.getElementById('detail-use-cases'),
  detailPromptZh: document.getElementById('detail-prompt-zh'),
  detailPromptEn: document.getElementById('detail-prompt-en'),
  detailNegative: document.getElementById('detail-negative'),
  detailCopyEdit: document.getElementById('detail-copy-edit'),
  collageCanvas: document.getElementById('collage-canvas'),
  collageList: document.getElementById('collage-list'),
  collageSummary: document.getElementById('collage-summary'),
  archiveProviderSelect: document.getElementById('archive-provider-select'),
  archiveModelSelect: document.getElementById('archive-model-select'),
  archiveTemplateSelect: document.getElementById('archive-template-select'),
  promptMaxLength: document.getElementById('prompt-max-length'),
  promptLengthStatus: document.getElementById('prompt-length-status'),
  archiveCategory: document.getElementById('archive-category'),
  archiveCategoryOther: document.getElementById('archive-category-other'),
  providerForm: document.getElementById('provider-form'),
  providerList: document.getElementById('provider-list'),
  settingsForm: document.getElementById('settings-form'),
  settingsProfileForm: document.getElementById('settings-profile-form'),
  settingsStatus: document.getElementById('settings-status'),
  settingsStats: document.getElementById('settings-stats'),
  settingsExport: document.getElementById('settings-export-btn'),
  settingsImport: document.getElementById('settings-import-file'),
  settingsClear: document.getElementById('settings-clear-btn'),
  settingsTemplateSelect: document.getElementById('setting-template-select'),
  settingsTemplateNew: document.getElementById('setting-template-new'),
  settingsTemplateSave: document.getElementById('setting-template-save'),
  settingsTemplateCopy: document.getElementById('setting-template-copy'),
  settingsTemplateReset: document.getElementById('setting-template-reset'),
  settingsTemplateTest: document.getElementById('setting-template-test'),
  settingsPrivacySave: document.getElementById('settings-privacy-save'),
  avatar: document.getElementById('setting-avatar'),
  avatarFile: document.getElementById('setting-avatar-file'),
  avatarPreview: document.getElementById('setting-avatar-preview'),
  avatarPresets: document.getElementById('setting-avatar-presets'),
  folderButton: document.getElementById('settings-folder-btn'),
  folderStatus: document.getElementById('settings-folder-status'),
  modal: document.getElementById('aa-modal'),
  modalTitle: document.getElementById('aa-modal-title'),
  modalMessage: document.getElementById('aa-modal-message'),
  modalConfirm: document.querySelector('[data-modal-confirm]'),
  collagePicker: document.getElementById('collage-picker-modal'),
  collagePickerOptions: document.getElementById('collage-picker-options'),
  feedbackModal: document.getElementById('feedback-modal'),
  feedbackForm: document.getElementById('feedback-form'),
  feedbackMessage: document.getElementById('feedback-message'),
  reviewGrid: document.getElementById('review-grid'),
  reviewStatus: document.getElementById('review-status'),
  reviewRefresh: document.getElementById('review-refresh-btn')
};

const tabCopy = {
  plaza: ['Public Plaza', '搜索可复用的审美系统。'],
  archive: ['My Archive', '搭建你的个人审美库。'],
  saved: ['Saved', '管理你收藏的审美生产资料。'],
  collage: ['Collage Board', '把参考图整理成项目风格板。'],
  provider: ['AI Provider', '连接你自己的 AI Provider。'],
  settings: ['Workspace Settings', '管理资料、工作区、卡片模板与本地数据。'],
  reviews: ['Review Queue', '审核公开视觉卡片。']
};

const i18n = {
  'zh-CN': {
    heroEyebrow: 'Open Beta · AI 审美知识库',
    heroTitle: '别再只是收藏参考图，开始搭建你的审美知识库。',
    heroLede: 'Aesthetic Archive 帮助设计师把视觉参考转化为可搜索、可解释、可生成、可导出的审美生产资料：风格文化背景、设计元素、主色系、构图类型和中英文 Prompt。',
    explorePlaza: '探索广场',
    buildArchive: '搭建个人审美库',
    whyTitle: '参考图越存越多，真正能复用的审美资料却很少。',
    whyCopy: '设计师不缺灵感图，缺的是能在下一次项目继续使用的风格结构、材料语言、构图逻辑和 Prompt。',
    whyOneTitle: '收藏很多，但找不到',
    whyOneCopy: '图片散落在相册、Pinterest、Eagle、聊天记录和项目文件夹里。',
    whyTwoTitle: '看得懂感觉，说不清结构',
    whyTwoCopy: '“高级、克制、有氛围”很难快速转成风格背景、构图、色彩和设计元素。',
    whyThreeTitle: 'Prompt 每次都重试',
    whyThreeCopy: 'AI 生图缺少稳定风格变量、双语表达和负向约束，结果不断漂移。',
    howTitle: '从视觉参考到审美生产资料，只需要三步。',
    joinTitle: '进入开放版本，用自己的 AI Provider 激活智能能力。',
    joinCopy: 'Open Beta 阶段先开放视觉库广场、收藏、基础导出和产品骨架。你可以在功能页中配置自己的 AI Provider，后续启用图片分析、Prompt 生成和 Collage Summary。',
    openApp: '打开应用',
    connectProvider: '连接 AI Provider',
    login: '登录',
    logout: '退出登录',
    workspace: '工作台',
    plazaNav: '视觉库广场',
    archiveNav: '个人审美库',
    savedNav: '个人收藏',
    boardNav: 'Collage 画板',
    settingsNav: '个人设置',
    plazaTitle: '搜索可复用的审美系统。',
    plazaCopy: '浏览公开审美案例，按风格、色彩、构图、场景和 Prompt 筛选。点击卡片查看左侧图册与右侧风格知识。',
    search: '搜索',
    category: '分类',
    style: '风格',
    exportMd: '导出 Markdown',
    exportJson: '导出 JSON',
    clear: '清空',
    archiveTitle: '创建审美卡片。',
    archiveCopy: '手动或通过图片 AI 分析沉淀个人审美资料。数据暂存在本地浏览器，不上传服务器。',
    savePrivate: '保存审美卡片',
    reset: '重置',
    privateItems: '私人审美库',
    savedTitle: '个人收藏',
    loginTitle: '登录',
    loginCopy: '使用本地 Open Beta 资料保存此浏览器上的审美库状态。',
    identityLabel: '邮箱或电话',
    continueIdentity: '使用邮箱 / 电话继续',
    continueGoogle: '使用 Google 继续',
    loginNote: '当前还没有真实认证，只会保存一个本地演示用户。'
  },
  en: {
    heroEyebrow: 'Open Beta · AI Aesthetic Knowledge Base',
    heroTitle: 'Stop saving references. Start building your aesthetic knowledge base.',
    heroLede: 'Aesthetic Archive helps designers turn visual references into searchable, explainable, reusable production assets: cultural context, design elements, palettes, composition types, and bilingual prompts.',
    explorePlaza: 'Explore Plaza',
    buildArchive: 'Build My Archive',
    whyTitle: 'Reference folders keep growing, but reusable aesthetic knowledge is still missing.',
    whyCopy: 'Designers do not lack inspiration images. They lack style structure, material language, composition logic, and prompts that can be reused in the next project.',
    whyOneTitle: 'Collected, but hard to retrieve',
    whyOneCopy: 'Images are scattered across albums, Pinterest, Eagle, chats, and project folders.',
    whyTwoTitle: 'You feel it, but cannot structure it',
    whyTwoCopy: 'Words like premium, quiet, and atmospheric need to become context, composition, color, and design elements.',
    whyThreeTitle: 'Prompts restart every time',
    whyThreeCopy: 'Without stable style variables, bilingual phrasing, and negative constraints, AI output drifts.',
    howTitle: 'From visual reference to aesthetic production asset in three steps.',
    joinTitle: 'Join the open beta and activate AI with your own provider.',
    joinCopy: 'The Open Beta starts with the public plaza, saved cases, basic export, and the product shell. You can configure your own AI Provider for future image analysis, prompt generation, and Collage Summary.',
    openApp: 'Open App',
    connectProvider: 'Connect AI Provider',
    login: 'Login',
    logout: 'Logout',
    workspace: 'Workspace',
    plazaNav: 'Public Plaza',
    archiveNav: 'My Archive',
    savedNav: 'Saved',
    boardNav: 'Collage Board',
    settingsNav: 'Settings',
    plazaTitle: 'Search reusable aesthetic systems.',
    plazaCopy: 'Browse public aesthetic cases and filter by style, color, composition, scene, and prompt. Click a card to inspect the gallery and structured knowledge.',
    search: 'Search',
    category: 'Category',
    style: 'Style',
    exportMd: 'Export Markdown',
    exportJson: 'Export JSON',
    clear: 'Clear',
    archiveTitle: 'Create an aesthetic card.',
    archiveCopy: 'Preserve personal aesthetic knowledge manually or with local image analysis. Data is stored locally in this browser only.',
    savePrivate: 'Save aesthetic card',
    reset: 'Reset',
    privateItems: 'Private aesthetic archive',
    savedTitle: 'Saved',
    loginTitle: 'Login',
    loginCopy: 'Sign in with Supabase to sync your private workspace.',
    identityLabel: 'Email or phone',
    continueIdentity: 'Continue with Email / Phone',
    continueGoogle: 'Continue with Google',
    loginNote: 'Sign in to sync private cards, boards, profile, and Provider settings.'
  }
};

const conceptMap = {
  '住宅': ['residential', 'minimalist', 'quiet luxury', 'zen', 'stone', 'moss'],
  '入口': ['entrance', 'ceremonial', 'space', 'architecture'],
  '东方': ['zen', 'wabi', 'japanese', 'oriental', 'karesansui'],
  '克制': ['minimalist', 'quiet luxury', 'silence', 'reduction', 'editorial minimalism'],
  '低维护': ['stone', 'gravel', 'moss', 'minimalist', 'low saturation'],
  '粗野': ['brutalism', 'raw concrete', 'industrial', 'exposed structure'],
  '工业': ['industrial', 'raw concrete', 'utilitarian', 'system design'],
  '品牌': ['brand', 'graphic', 'visual system', 'editorial'],
  '展陈': ['exhibition', 'space', 'gallery', 'brutalism'],
  '电影': ['cinematic', 'film', 'dark', 'editorial'],
  '杂志': ['editorial', 'grid', 'typography', 'layout'],
  '学术': ['academic', 'archival', 'editorial minimalism', 'swiss grid'],
  '自然': ['biophilic', 'organic', 'wabi', 'moss', 'plant'],
  '手作': ['craft', 'handmade', 'letterpress', 'folk'],
  '奢华': ['quiet luxury', 'art deco', 'old money', 'glamour']
};

function asset(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `/local-mvp/legacy/updated/${path}`;
}

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch (_) { return fallback; }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Aesthetic Archive local save failed:', error);
    const message = error?.name === 'QuotaExceededError'
      ? '本地存储空间不足：请减少图片数量，或使用 Remove Images 后再保存。'
      : '本地保存失败，请检查浏览器存储权限。';
    setArchiveStatus(message, 'error');
    toast(message);
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function estimateArchiveStorage() {
  const privateCases = getPrivateCases();
  const raw = localStorage.getItem(STORAGE.privateCases) || '[]';
  const bytes = raw.length * 2;
  const images = privateCases.reduce((count, item) => count + (item.gallery || []).filter(src => /^data:/i.test(src)).length, 0);
  const publicItems = privateCases.filter(item => item.visibility === 'public' && item.publishStatus === 'published').length;
  return { cards: privateCases.length, images, publicItems, bytes };
}

function setArchiveStatus(message, type = 'ready') {
  if (!els.archiveSaveStatus) return;
  els.archiveSaveStatus.className = `save-status is-${type}`;
  els.archiveSaveStatus.textContent = message;
}

function updateArchiveHealth() {
  if (!els.archiveHealth) return;
  const health = estimateArchiveStorage();
  const level = health.bytes > 4.2 * 1024 * 1024 ? 'is-danger' : (health.bytes > 3 * 1024 * 1024 ? 'is-warning' : '');
  els.archiveHealth.className = `storage-health ${level}`.trim();
  els.archiveHealth.innerHTML = `
    <div class="health-cell"><span>Storage</span><strong>${formatBytes(health.bytes)}</strong></div>
    <div class="health-cell"><span>Cards</span><strong>${health.cards}</strong></div>
    <div class="health-cell"><span>Local Images</span><strong>${health.images}</strong></div>
    <div class="health-cell"><span>Published</span><strong>${health.publicItems}</strong></div>
  `;
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[，。；、/|+()\[\]：:·,.;]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function expandedTerms(query) {
  const terms = new Set(tokenize(query));
  Object.entries(conceptMap).forEach(([cn, mapped]) => {
    if (String(query).includes(cn)) mapped.forEach(term => tokenize(term).forEach(t => terms.add(t)));
  });
  return [...terms];
}

function searchableText(item) {
  return [
    item.id, item.title, item.titleZh, item.category, item.summary,
    item.designLogic, item.historicalOrigin, item.typography, item.imagery,
    ...(item.styleTags || []), ...(item.materialTags || []), ...(item.spaceTags || []), ...(item.scenarioTags || []),
    item.promptZh, item.promptEn
  ].join(' ').toLowerCase();
}

function scoreCase(item, query) {
  if (!query.trim()) return 1;
  const terms = expandedTerms(query);
  const text = searchableText(item);
  const titleText = `${item.title} ${item.titleZh} ${item.id}`.toLowerCase();
  const tagText = [...(item.styleTags || []), ...(item.materialTags || []), ...(item.spaceTags || []), ...(item.scenarioTags || [])].join(' ').toLowerCase();
  let score = 0;
  terms.forEach(term => {
    if (term.length < 2) return;
    if (titleText.includes(term)) score += 6;
    else if (tagText.includes(term)) score += 4;
    else if (text.includes(term)) score += 2;
  });
  return score;
}

function getPrivateCases() {
  return cloudState === 'online' ? cloudCards : loadJSON(STORAGE.privateCases, []);
}

function defaultPreferences() {
  return { language: 'zh-CN', exportFormat: 'png', defaultTab: 'plaza', density: 'compact', promptTemplateId: 'system-default', promptOutput: 'image', promptFraming: 'wide', promptRatio: '16:9', publishConfirm: true, copyrightReminder: true, sourceReminder: true, localOnly: true };
}

function defaultProfile() {
  return { avatar: '', name: '', email: '', contact: '', bio: '', specialty: '' };
}

function defaultCardTemplate() {
  return { id: 'system-default', name: '空间与建筑复现', scope: '建筑 / 室内 / 景观 / 展陈', focus: '空间主体、体量拓扑、结构节奏、镜头位置、透视、尺度参照、表面材料、反射粗糙度、光向、色温、主辅色比例', instructions: '只依据参考图可见证据，先锁定最能代表整组图册的一个具体生成场景。中英文 Prompt 都必须可直接复制生成：写明真实具体的主体、数量、位置关系、前中后景、镜头高度与方向、焦段感、透视、材料表面状态、主辅色比例、光线方向和强弱、空气与渲染质感。不得使用占位符、括号待填项、“用户提供的主体”、使用场景说明或模型参数。主体必须具体但可被用户直接改写；风格骨架、构图、色系和质感必须保持稳定。Negative Prompt 独立输出，排除破坏结构与材质一致性的错误。', system: true, isDefault: true, version: 3, updatedAt: new Date().toISOString() };
}

function builtInTemplates() {
  const base = defaultCardTemplate();
  return [base,
    { id: 'template-editorial-brand', name: '品牌、平面与 UI 复现', scope: '品牌 / 海报 / 编辑 / 包装 / Web UI', focus: '画布比例、网格列数、信息密度、视觉锚点、文字块形态、字体分类与字重、对齐、留白、图文占比、色块比例、印刷或屏幕质感', instructions: '选择一个具体可生成的海报、封面、包装正面或界面作为主体。中英文 Prompt 必须直接写明画布结构、网格、主视觉位置、文字块数量与形态、字体类别、层级、对齐、留白、色彩面积比例、图像处理和介质质感。不可读文字只规定为简短清晰的无品牌标题，不臆造来源；不得使用占位符或“替换文案”等元文字。避免只写风格名，必须把风格拆成可见版式规则。', system: true, version: 3 },
    { id: 'template-cinematic-photo', name: '摄影与影像复现', scope: '摄影 / 人像 / 静物 / 电影感场景', focus: '具体主体与动作、环境叙事、景别、机位、焦段感、景深、焦点、快门观感、主辅光、色温、动态范围、胶片或数字质感', instructions: '选择参考图中最具代表性的一个具体瞬间，生成 Prompt 时锁定主体外观与动作、空间关系、景别、机位、镜头方向、焦段感、景深、焦点、主辅光、时间、色温、色彩分级、颗粒和动态范围。中英文均为可直接执行的完整摄影指令，不含占位符、选项列表或互相冲突的镜头要求。负面约束重点排除错误肢体、焦点漂移、过度 HDR、塑料皮肤、杂乱背景和文字水印。', system: true, version: 3 },
    { id: 'template-product-object', name: '产品、家具与装置复现', scope: '产品 / 家具 / 装置 / 时尚配饰', focus: '对象类别、轮廓比例、部件关系、结构节点、材料厚度、表面工艺、接缝、色彩分区、承托场景、镜头和商业光线', instructions: '选择一个具体产品或装置作为直接生成主体。Prompt 必须锁定整体轮廓、长宽高观感、关键部件数量与连接关系、边角、接缝、厚度、材料与表面工艺、颜色分区、摆放方式、背景、机位、镜头和光线。中英文均不得出现占位符、待填写变量或泛泛的“高级产品设计”；用户可直接改产品类别，但其余造型语法、材质、色系和质感应可复用。负面约束排除结构断裂、漂浮部件、错误接缝、廉价塑料感、品牌标志和水印。', system: true, version: 3 }
  ];
}

function getTemplates() {
  const stored = loadJSON(STORAGE.templates, null);
  if (!Array.isArray(stored) || !stored.length) {
    const templates = builtInTemplates();
    saveJSON(STORAGE.templates, templates);
    return templates;
  }
  const builtIns = builtInTemplates();
  const known = new Map(stored.map(item => [item.id, item]));
  const merged = builtIns.map(item => {
    const existing = known.get(item.id);
    return existing && Number(existing.version || 0) >= Number(item.version || 0) ? existing : item;
  }).concat(stored.filter(item => !builtIns.some(base => base.id === item.id)));
  if (JSON.stringify(merged) !== JSON.stringify(stored)) saveJSON(STORAGE.templates, merged);
  return merged;
}

function getDefaultTemplate() {
  const templates = getTemplates();
  const preferredId = getPreferences().promptTemplateId;
  return templates.find(item => item.id === preferredId) || templates.find(item => item.isDefault) || templates[0] || defaultCardTemplate();
}

function getProfile() { return { ...defaultProfile(), ...loadJSON(STORAGE.profile, {}) }; }

function defaultUsageStats() {
  return { cardsCreated: 0, cardsOpened: 0, cardsEdited: 0, promptPacksGenerated: 0, collageItemsAdded: 0, exports: 0, publicViews: null, publicSaves: null, publicBoardAdds: null };
}

function getUsageStats() { return { ...defaultUsageStats(), ...loadJSON(STORAGE.usageStats, {}) }; }

function recordUsage(key, amount = 1) {
  const stats = getUsageStats();
  if (typeof stats[key] !== 'number') return;
  stats[key] += amount;
  saveJSON(STORAGE.usageStats, stats);
}

function getPreferences() {
  return { ...defaultPreferences(), ...loadJSON(STORAGE.preferences, {}) };
}

function populateSettings() {
  const prefs = getPreferences();
  const profile = getProfile();
  if (profile.name && profile.email && profile.name.trim().toLowerCase() === profile.email.trim().toLowerCase()) profile.name = '';
  const set = (id, value) => { const field = document.getElementById(id); if (field) field.value = value ?? ''; };
  const check = (id, value) => { const field = document.getElementById(id); if (field) field.checked = Boolean(value); };
  set('setting-language', prefs.language);
  set('setting-export-format', prefs.exportFormat === 'json' ? 'md' : prefs.exportFormat);
  set('setting-default-tab', prefs.defaultTab);
  set('setting-density', prefs.density);
  set('setting-avatar', profile.avatar); set('setting-name', profile.name); set('setting-email', profile.email); set('setting-contact', profile.contact); set('setting-bio', profile.bio); set('setting-specialty', profile.specialty);
  check('setting-publish-confirm', prefs.publishConfirm); check('setting-copyright-reminder', prefs.copyrightReminder); check('setting-source-reminder', prefs.sourceReminder);
  renderAvatarPicker(profile.avatar);
  renderTemplateSettings();
  renderArchiveTemplateSelect();
  updateSettingsStats();
}

function updateSettingsStats() {
  if (!els.settingsStats) return;
  const privateCases = getPrivateCases(); const saved = getSaved(); const board = getCollageBoard(); const providers = getProviders(); const stats = getUsageStats();
  const bytes = Object.values(STORAGE).reduce((sum, key) => sum + (localStorage.getItem(key)?.length || 0) * 2, 0);
  const labels = isEnglish() ? ['Cards created', 'Cards opened', 'Prompt packs', 'Board adds', 'Exports', 'Local storage', 'Public use'] : ['生成卡片', '打开卡片', 'Prompt 包', '加入画板', '导出次数', '本地占用', '广场使用'];
  const publicUse = isEnglish() ? 'Not enabled' : '暂未启用';
  const values = [stats.cardsCreated || privateCases.length, stats.cardsOpened, stats.promptPacksGenerated, stats.collageItemsAdded || board.items.length, stats.exports, formatBytes(bytes), publicUse];
  const max = Math.max(1, ...values.slice(0, 5).map(Number));
  els.settingsStats.innerHTML = values.map((value, index) => `<div class="stat-card ${index === 6 ? 'is-muted' : ''}"><div class="stat-card-top"><span>${labels[index]}</span><strong>${value}</strong></div><i class="stat-bar"><b style="width:${index === 5 || index === 6 ? 100 : Math.max(8, Math.round((Number(value) / max) * 100))}%"></b></i><small>${index === 6 ? (isEnglish() ? 'Server metrics will appear after account sync.' : '接入账号和服务端后启用') : (isEnglish() ? 'Current browser' : '当前浏览器')}</small></div>`).join('');
  const summary = document.getElementById('settings-storage-summary');
  if (summary) summary.textContent = `${privateCases.length} ${isEnglish() ? 'private cards' : '张私人卡片'} · ${saved.length} ${isEnglish() ? 'saved' : '张收藏'} · ${providers.length} ${isEnglish() ? 'providers' : '个 AI 服务'} · ${formatBytes(bytes)}`;
}

function applyDensity(density) {
  document.body.dataset.density = ['compact', 'standard', 'spacious'].includes(density) ? density : 'standard';
}

function saveWorkspacePreferences(event) {
  event.preventDefault();
  const current = getPreferences();
  const prefs = { ...current, language: document.getElementById('setting-language')?.value || current.language, exportFormat: document.getElementById('setting-export-format')?.value || current.exportFormat, defaultTab: document.getElementById('setting-default-tab')?.value || current.defaultTab, density: document.getElementById('setting-density')?.value || current.density, localOnly: true };
  if (!saveJSON(STORAGE.preferences, prefs)) return;
  localStorage.setItem(STORAGE.language, prefs.language);
  if (prefs.language !== document.documentElement.lang) setLanguage(prefs.language, false);
  const status = els.settingsStatus;
  if (status) { status.className = 'save-status is-success'; status.textContent = document.documentElement.lang === 'en' ? 'Workspace settings saved.' : '工作区设置已保存。'; }
  applyDensity(prefs.density);
  toast(document.documentElement.lang === 'en' ? 'Workspace settings saved' : '工作区设置已保存');
}

const AVATAR_PRESETS = [
  { id: 'cat', label: '小猫', value: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="48" fill="%23f6c56f"/%3E%3Cpath d="M24 39 19 20l18 11c7-3 15-3 22 0l18-11-5 19c5 6 7 13 7 20 0 17-13 26-31 26S17 76 17 59c0-7 2-14 7-20Z" fill="%23fff4d6"/%3E%3Ccircle cx="35" cy="55" r="4" fill="%23222222"/%3E%3Ccircle cx="61" cy="55" r="4" fill="%23222222"/%3E%3Cpath d="M45 64q3 4 6 0M30 65l-10-3m10 8-10 2m46-7 10-3m-10 8 10 2" fill="none" stroke="%23222222" stroke-linecap="round" stroke-width="2"/%3E%3C/svg%3E' },
  { id: 'bear', label: '小熊', value: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="48" fill="%23b9d9d2"/%3E%3Ccircle cx="29" cy="31" r="14" fill="%237b5b4a"/%3E%3Ccircle cx="67" cy="31" r="14" fill="%237b5b4a"/%3E%3Ccircle cx="48" cy="53" r="29" fill="%23a9795c"/%3E%3Ccircle cx="38" cy="51" r="4" fill="%23222222"/%3E%3Ccircle cx="58" cy="51" r="4" fill="%23222222"/%3E%3Cellipse cx="48" cy="63" rx="10" ry="7" fill="%23e9c7ae"/%3E%3Cpath d="M44 63q4 5 8 0" fill="none" stroke="%23222222" stroke-linecap="round" stroke-width="2"/%3E%3C/svg%3E' },
  { id: 'bunny', label: '小兔', value: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="48" fill="%23d8c4e8"/%3E%3Cellipse cx="34" cy="22" rx="10" ry="23" fill="%23fff8f0"/%3E%3Cellipse cx="62" cy="22" rx="10" ry="23" fill="%23fff8f0"/%3E%3Cellipse cx="34" cy="22" rx="4" ry="15" fill="%23e8a9b9"/%3E%3Cellipse cx="62" cy="22" rx="4" ry="15" fill="%23e8a9b9"/%3E%3Cellipse cx="48" cy="57" rx="28" ry="27" fill="%23fff8f0"/%3E%3Ccircle cx="38" cy="54" r="4" fill="%23222222"/%3E%3Ccircle cx="58" cy="54" r="4" fill="%23222222"/%3E%3Cpath d="M45 65q3 4 6 0" fill="none" stroke="%23222222" stroke-linecap="round" stroke-width="2"/%3E%3C/svg%3E' },
  { id: 'frog', label: '小青蛙', value: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="48" fill="%23f0d98a"/%3E%3Cellipse cx="48" cy="57" rx="31" ry="25" fill="%236e9f6b"/%3E%3Ccircle cx="31" cy="32" r="14" fill="%236e9f6b"/%3E%3Ccircle cx="65" cy="32" r="14" fill="%236e9f6b"/%3E%3Ccircle cx="31" cy="32" r="5" fill="%23fff"/%3E%3Ccircle cx="65" cy="32" r="5" fill="%23fff"/%3E%3Ccircle cx="31" cy="32" r="2"/%3E%3Ccircle cx="65" cy="32" r="2"/%3E%3Cpath d="M32 62q16 12 32 0" fill="none" stroke="%23222222" stroke-linecap="round" stroke-width="3"/%3E%3C/svg%3E' }
];
function renderAvatarPicker(value = '') {
  if (els.avatarPreview) { els.avatarPreview.style.background = value ? `center / cover no-repeat url('${value}')` : 'linear-gradient(135deg, #f6c56f, #b9d9d2)'; els.avatarPreview.textContent = value ? '' : 'AA'; }
  if (els.avatarPresets) els.avatarPresets.innerHTML = AVATAR_PRESETS.map(item => `<button type="button" class="avatar-preset" data-avatar-preset="${escapeHTML(item.value)}" title="${escapeHTML(item.label)}" aria-label="${escapeHTML(item.label)}" style="background-image:url('${escapeHTML(item.value)}')"></button>`).join('');
}

async function saveProfile(event) {
  event.preventDefault();
  const current = getProfile();
  const profile = { avatar: formValue('setting-avatar'), name: formValue('setting-name'), email: formValue('setting-email') || current.email, contact: formValue('setting-contact'), bio: formValue('setting-bio').slice(0, 500), specialty: formValue('setting-specialty').slice(0, 300) };
  if (!saveJSON(STORAGE.profile, profile)) return;
  if (cloudState === 'online') {
    try { await cloudRequest('/api/profile', { method: 'PATCH', body: JSON.stringify({ ...profile, avatar: /^data:image\//i.test(profile.avatar) ? '' : profile.avatar }) }); } catch (error) { toast(`云端资料保存失败：${error.message}`); return; }
  }
  const currentUser = getUser();
  if (currentUser) setUser({ ...currentUser, name: profile.name || currentUser.name, avatar: profile.avatar || '' });
  renderAvatarPicker(profile.avatar);
  const status = document.getElementById('profile-status'); if (status) { status.className = 'save-status is-success'; status.textContent = isEnglish() ? 'Profile saved.' : '个人资料已保存。'; }
  toast(isEnglish() ? 'Profile saved' : '个人资料已保存');
}

function renderArchiveTemplateSelect() {
  if (!els.archiveTemplateSelect) return;
  const selected = getDefaultTemplate().id;
  els.archiveTemplateSelect.innerHTML = getTemplates().map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join('');
  els.archiveTemplateSelect.value = selected;
}

function savePrivacySettings() {
  const prefs = getPreferences();
  prefs.publishConfirm = Boolean(document.getElementById('setting-publish-confirm')?.checked); prefs.copyrightReminder = Boolean(document.getElementById('setting-copyright-reminder')?.checked); prefs.sourceReminder = Boolean(document.getElementById('setting-source-reminder')?.checked);
  saveJSON(STORAGE.preferences, prefs);
  const status = document.getElementById('privacy-status'); if (status) { status.className = 'save-status is-success'; status.textContent = isEnglish() ? 'Privacy and rights settings saved.' : '隐私与版权设置已保存。'; }
  toast(isEnglish() ? 'Privacy and rights settings saved' : '隐私与版权设置已保存');
}

function renderTemplateSettings() {
  const select = els.settingsTemplateSelect; if (!select) return;
  const templates = getTemplates(); const selected = select.value || getDefaultTemplate().id;
  select.innerHTML = templates.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}${item.system ? ' · 系统' : ''}</option>`).join('');
  const folders = document.getElementById('setting-template-folders');
  if (folders) folders.innerHTML = templates.map(item => `<button type="button" class="template-folder ${item.id === selected ? 'is-active' : ''}" data-template-folder="${escapeHTML(item.id)}"><span class="folder-tab"></span><span class="folder-icon">▰</span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.scope || '审美分析')}</small><em>${item.system ? '系统默认' : `v${item.version || 1}`}</em></button>`).join('');
  select.value = templates.some(item => item.id === selected) ? selected : templates[0].id;
  const template = templates.find(item => item.id === select.value) || templates[0];
  const prefs = getPreferences();
  if (prefs.promptTemplateId !== select.value) { prefs.promptTemplateId = select.value; saveJSON(STORAGE.preferences, prefs); }
  const set = (id, value) => { const field = document.getElementById(id); if (field) field.value = value || ''; };
  set('setting-template-name', template.name); set('setting-template-scope', template.scope); set('setting-template-focus', template.focus); set('setting-template-instructions', template.instructions);
  const en = document.documentElement.lang === 'en';
  const state = document.getElementById('setting-template-state'); if (state) state.textContent = template.system ? (en ? 'System default / Read only' : '系统默认 / Read only') : `${en ? 'Custom' : '自定义'} v${template.version || 1}`;
  const preview = document.getElementById('setting-template-preview'); if (preview) preview.textContent = en ? `INPUT\nReference image: {{reference_image}}\nTopic: {{topic}}\nProject context: {{project_context}}\n\nANALYSIS\n${template.focus}\n\nRULES\n${template.instructions}\n\nOUTPUT\nStructured card + Chinese Prompt + English Prompt + Negative Prompt + reviewNotes` : `输入\n参考图片：{{reference_image}}\n主题：{{topic}}\n项目上下文：{{project_context}}\n\n分析重点\n${template.focus}\n\n生成规则\n${template.instructions}\n\n输出\n结构化卡片 + 中文 Prompt + English Prompt + Negative Prompt + reviewNotes`;
}

function saveTemplateSettings() {
  const id = els.settingsTemplateSelect?.value || 'system-default'; const templates = getTemplates(); const current = templates.find(item => item.id === id) || defaultCardTemplate();
  if (current.system) { toast(isEnglish() ? 'Copy a system template before editing it.' : '系统默认模板不可直接修改，请先复制并编辑。'); return; }
  const name = formValue('setting-template-name');
  const scope = formValue('setting-template-scope');
  const focus = formValue('setting-template-focus');
  const instructions = formValue('setting-template-instructions');
  const invalid = !name || !scope || !focus || !instructions || name.length > 80 || scope.length > 300 || focus.length > 1000 || instructions.length > 6000;
  if (invalid) {
    const status = document.getElementById('template-status');
    if (status) { status.className = 'save-status is-warning'; status.textContent = isEnglish() ? 'Complete all fields. Limits: name 80, scope 300, focus 1000, rules 6000 characters.' : '请填写全部字段。长度上限：名称 80、场景 300、重点 1000、规则 6000 字。'; }
    return;
  }
  const next = { ...current, name, scope, focus, instructions, updatedAt: new Date().toISOString(), version: (current.version || 1) + 1 };
  const saved = templates.map(item => item.id === id ? next : item); saveJSON(STORAGE.templates, saved); renderTemplateSettings();
  const status = document.getElementById('template-status'); if (status) { status.className = 'save-status is-success'; status.textContent = isEnglish() ? 'Custom card template saved.' : '自定义卡片模板已保存。'; }
  toast(isEnglish() ? 'Card generation template saved' : '卡片生成模板已保存');
}

function newTemplateSettings() {
  const en = isEnglish();
  const template = {
    id: `template-${Date.now()}`,
    name: en ? 'My Prompt template' : '我的 Prompt 模板',
    scope: '',
    focus: '',
    instructions: '',
    system: false,
    isDefault: false,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  saveJSON(STORAGE.templates, [...getTemplates(), template]);
  renderTemplateSettings();
  if (els.settingsTemplateSelect) els.settingsTemplateSelect.value = template.id;
  renderTemplateSettings();
  renderArchiveTemplateSelect();
  document.getElementById('setting-template-name')?.focus();
  toast(en ? 'New editable template created' : '已新建可编辑模板');
}

function copyTemplateSettings() {
  const source = getTemplates().find(item => item.id === els.settingsTemplateSelect?.value) || defaultCardTemplate();
  const copy = { ...source, id: `template-${Date.now()}`, name: `${source.name} · 我的版本`, system: false, isDefault: false, version: 1, updatedAt: new Date().toISOString() };
  saveJSON(STORAGE.templates, [...getTemplates().filter(item => item.id !== copy.id), copy]); renderTemplateSettings(); if (els.settingsTemplateSelect) els.settingsTemplateSelect.value = copy.id; renderTemplateSettings(); toast('已创建可编辑的模板副本');
}

function resetTemplateSettings() {
  const custom = getTemplates().filter(item => !item.system);
  saveJSON(STORAGE.templates, [...builtInTemplates(), ...custom]);
  if (els.settingsTemplateSelect) els.settingsTemplateSelect.value = 'system-default';
  renderTemplateSettings(); renderArchiveTemplateSelect(); toast('已恢复系统默认模板');
}

function testTemplateSettings() {
  const topic = formValue('setting-template-test-topic') || '一处安静的住宅入口，天然石材、柔和自然光和克制构图'; const focus = formValue('setting-template-focus') || '文化背景、材料与工艺、空间关系、光线、构图、色彩'; const instructions = formValue('setting-template-instructions') || defaultCardTemplate().instructions; const result = document.getElementById('setting-template-test-result');
  if (result) result.textContent = `测试主题：${topic}\n\n结构提取：${focus}\n\nPrompt 预览：${topic}。请结合可见材料、光线、空间关系与构图生成具体、可复用的中文和英文 Prompt；区分可见事实与文化推断。\n\n约束：${instructions}`;
}

function backupWorkspace() {
  const providers = getProviders().map(provider => ({ ...provider, secretState: provider.hasSecret ? 'server-managed' : 'missing', hasSecret: Boolean(provider.hasSecret), key: undefined, secret: undefined, apiKey: undefined }));
  return { version: 2, exportedAt: new Date().toISOString(), note: 'Provider API keys are redacted. Re-enter them after import.', privateCases: getPrivateCases(), saved: getSaved(), collage: getCollageBoard(), providers, preferences: getPreferences(), profile: getProfile(), templates: getTemplates(), usageStats: getUsageStats() };
}

function exportWorkspaceBackup() {
  download('aesthetic-archive-workspace-backup.json', JSON.stringify(backupWorkspace(), null, 2), 'application/json');
  toast(document.documentElement.lang === 'en' ? 'Backup exported' : '工作区备份已导出');
}

async function importWorkspaceBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (!backup || ![1, 2].includes(backup.version) || !Array.isArray(backup.privateCases)) throw new Error('Unsupported backup format');
    if (!saveJSON(STORAGE.privateCases, backup.privateCases)) return;
    saveJSON(STORAGE.saved, Array.isArray(backup.saved) ? backup.saved : []);
    saveJSON(STORAGE.collage, backup.collage || normalizeBoard());
    // Provider metadata and secrets are server-owned; backups never restore them locally.
    localStorage.removeItem(STORAGE.providers);
    localStorage.removeItem(STORAGE.provider);
    saveJSON(STORAGE.preferences, backup.preferences || defaultPreferences());
    saveJSON(STORAGE.profile, backup.profile || defaultProfile());
    saveJSON(STORAGE.templates, Array.isArray(backup.templates) && backup.templates.length ? backup.templates : [defaultCardTemplate()]);
    saveJSON(STORAGE.usageStats, backup.usageStats || defaultUsageStats());
    populateSettings(); syncCases(); renderCards(); renderArchive(); updateSavedUI(); renderCollage(); loadProvider();
    toast(document.documentElement.lang === 'en' ? 'Backup imported. Provider settings were reloaded from the server.' : '备份已导入，Provider 设置已从服务端重新加载。');
  } catch (error) { toast(`导入失败：${error.message}`); }
  event.target.value = '';
}

function openConfirm(title, message, action) {
  if (!els.modal) return Promise.resolve(action());
  els.modalTitle.textContent = title;
  els.modalMessage.textContent = message;
  els.modal.hidden = false;
  return new Promise(resolve => {
    const finish = value => { els.modal.hidden = true; els.modalConfirm.onclick = null; resolve(value); };
    els.modalConfirm.onclick = async () => { try { await action(); finish(true); } catch (error) { finish(false); toast(error.message); } };
    els.modal.querySelector('[data-modal-cancel]')?.addEventListener('click', () => finish(false), { once: true });
    els.modal.querySelector('[data-modal-close]')?.addEventListener('click', () => finish(false), { once: true });
  });
}

async function clearCloudData(type) {
  if (cloudState !== 'online') return;
  if (type === 'saved') await cloudRequest('/api/saved?all=true', { method: 'DELETE' });
  if (type === 'private') {
    for (const card of cloudCards) await cloudRequest(`/api/cards?id=${encodeURIComponent(card.id)}`, { method: 'DELETE' });
  }
  if (type === 'board' && cloudBoardId) { await cloudRequest(`/api/boards?id=${encodeURIComponent(cloudBoardId)}`, { method: 'DELETE' }); cloudBoardId = null; }
}

function clearWorkspace() {
  const message = document.documentElement.lang === 'en' ? 'Clear the entire local workspace, including profile, templates and preferences? This cannot be undone.' : '确定清空整个本地工作区吗？这会删除个人资料、私人卡片、收藏、画板、Provider、模板和偏好，且无法撤销。';
  openConfirm('清空整个本地工作区', message, async () => {
    try { await clearCloudData('saved'); await clearCloudData('private'); await clearCloudData('board'); } catch (error) { return toast(`云端清理失败：${error.message}`); }
    [STORAGE.privateCases, STORAGE.saved, STORAGE.collage, STORAGE.providers, STORAGE.provider, STORAGE.user, STORAGE.profile, STORAGE.templates, STORAGE.usageStats, STORAGE.preferences].forEach(key => localStorage.removeItem(key));
    cloudCards = []; cloudSaved = new Set(); cloudBoardId = null;
    syncCases(); renderCards(); renderArchive(); updateSavedUI(); renderCollage(); loadProvider(); populateSettings();
    toast(document.documentElement.lang === 'en' ? 'Local workspace cleared' : '本地工作区已清除');
  });
}

function clearSettingData(type) {
  const labels = { private: '私人审美库', saved: '个人收藏', board: 'Collage 画板' }; const key = { private: STORAGE.privateCases, saved: STORAGE.saved, board: STORAGE.collage }[type];
  if (!key) return;
  openConfirm(`清空${labels[type]}`, `确定清空${labels[type]}吗？此操作无法撤销。`, async () => {
    try { await clearCloudData(type); } catch (error) { return toast(`云端清理失败：${error.message}`); }
    localStorage.removeItem(key); syncCases(); renderCards(); renderArchive(); updateSavedUI(); renderCollage(); updateSettingsStats(); toast(`${labels[type]}已清空`);
  });
}

function syncCases() {
  cases = mergeDisplayCases(publicCases, cloudPublicCards, getPrivateCases());
}

function getSaved() {
  if (cloudState === 'online') {
    const visible = mergeDisplayCases(cloudCards, cloudPublicCards, publicCases);
    return visible.filter(item => cloudSaved.has(item.id)).map(item => ({ ...item, savedAt: item.updatedAt || new Date().toISOString() }));
  }
  return loadJSON(STORAGE.saved, []);
}

function setSaved(saved) {
  if (cloudState === 'online') {
    cloudSaved = new Set(saved.map(item => item.id));
    updateSavedUI();
    return;
  }
  saveJSON(STORAGE.saved, saved);
  updateSavedUI();
}

function isSaved(item) {
  return getSaved().some(saved => saved.id === item.id);
}

function getPublishedPrivateCases() {
  return getPrivateCases().filter(item => item.visibility === 'public' && item.publishStatus === 'published');
}

const uiCopy = {
  zh: { noResults: '没有匹配的公开审美案例。', noResultsHint: '尝试清空搜索，或换一个风格、材料、场景关键词。', privateCase: '私人卡片', noImage: '暂无图片', noGallery: '暂无图册', save: '收藏', saved: '已收藏', edit: '编辑', remove: '移除收藏', delete: '删除', collage: '加入画板', archiveEmpty: '还没有审美卡片。', archiveEmptyHint: '填写下方表单，或先上传图片并用 AI 分析生成一张审美卡片。', savedEmpty: '还没有收藏。', savedEmptyHint: '在视觉库广场点击收藏，把它加入个人收藏。', promptPending: '待补充中文 Prompt。', englishPromptPending: '待补充英文 Prompt。', negativePending: '请补充与当前图像目标相关的负面限制。', culturalPending: '待补充风格文化背景。', elementsPending: '待补充设计元素。', useCases: '设计参考 / Prompt 生成 / 情绪板', boardEmpty: '画板为空', summaryGenerating: '正在生成画板总结...', summary: '画板总结', boardStatus: '测试中 · 未来待开放' },
  en: { noResults: 'No public aesthetic cases match your search.', noResultsHint: 'Clear the search or try another style, material, or scene keyword.', privateCase: 'Private Case', noImage: 'No Image', noGallery: 'No Gallery', save: 'Save', saved: 'Saved', edit: 'Edit', remove: 'Remove', delete: 'Delete', collage: 'Add to Collage', archiveEmpty: 'No aesthetic cards yet.', archiveEmptyHint: 'Fill in the fields below, or upload an image and use AI analysis to generate a card.', savedEmpty: 'No saved cards yet.', savedEmptyHint: 'Click Save in Public Plaza to add a card here.', promptPending: 'Chinese Prompt pending.', englishPromptPending: 'English Prompt pending.', negativePending: 'Add executable negative constraints for this image.', culturalPending: 'Cultural context pending.', elementsPending: 'Design elements pending.', useCases: 'design reference / prompt generation / moodboard', boardEmpty: 'The board is empty', summaryGenerating: 'Generating board summary...', summary: 'Board Summary', boardStatus: 'In testing · Coming soon' }
};
function ui(key) { return uiCopy[isEnglish() ? 'en' : 'zh'][key] || key; }
function isEnglish() { return document.documentElement.lang === 'en'; }
function primaryTitle(item) { return isEnglish() ? (item.title || item.titleZh || 'Untitled') : (item.titleZh || item.title || '未命名'); }
function secondaryTitle(item) { return isEnglish() ? (item.titleZh || '') : (item.title || ''); }

function publishLabel(item) {
  if (item.visibility !== 'public') return isEnglish() ? 'Private' : '仅自己可见';
  if (item.publishStatus === 'published') return isEnglish() ? 'Published' : '已公开';
  if (item.publishStatus === 'rejected') return isEnglish() ? 'Rejected' : '未通过';
  return isEnglish() ? 'Pending Review' : '待审核';
}

function publishClass(item) {
  if (item.visibility !== 'public') return 'private-badge';
  if (item.publishStatus === 'published') return 'public-badge';
  if (item.publishStatus === 'rejected') return 'rejected-badge';
  return 'pending-badge';
}

function getVisibleCases() {
  const cloudPublished = cloudState === 'online' ? cloudPublicCards : [];
  let list = mergeDisplayCases(publicCases, cloudPublished, getPublishedPrivateCases()).filter(item => state.activeCategory === 'All' || item.category === state.activeCategory);
  if (state.query.trim()) {
    list = list
      .map(item => ({ item, score: scoreCase(item, state.query) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }
  return list;
}

function paletteHTML(item) {
  return (item.palette || []).slice(0, 4).map(color => {
    const hex = typeof color === 'string' ? color : color.hex;
    const name = typeof color === 'string' ? color : color.name;
    return `<i style="background:${escapeHTML(hex)}" title="${escapeHTML(name || hex)}"></i>`;
  }).join('');
}

function coverHTML(item) {
  if (item.image) {
    return `<img src="${asset(item.image)}" alt="${escapeHTML(item.titleZh || item.title)}" loading="lazy" onerror="this.parentElement.style.background='#e0d7c7';this.remove()">`;
  }
  return `<span class="image-placeholder">${item.source === 'private' ? ui('privateCase') : ui('noImage')}</span>`;
}

function getArchiveImageList() {
  return String(els.archiveImage?.value || '')
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function updateArchiveImagePreview(value = '') {
  if (!els.archiveImagePreview) return;
  const images = Array.isArray(value)
    ? value
    : String(value || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
  els.archiveImagePreview.innerHTML = images.length
    ? images.slice(0, 6).map((src, index) => `<img src="${escapeHTML(src)}" alt="Uploaded reference preview ${index + 1}">`).join('')
    : `<span>${ui('noImage')}</span>`;
}

function cardKnowledgeHTML(item) {
  const composition = item.composition || inferComposition(item);
  const useCase = item.useCases || (item.scenarioTags || [])[0] || 'Prompt asset';
  return `<div class="card-knowledge"><span>${escapeHTML(composition)}</span><span>${escapeHTML(useCase)}</span></div>`;
}

function renderCards() {
  const list = getVisibleCases();
  els.resultCount.textContent = isEnglish() ? `${list.length} styles` : `${list.length} 个风格`; 
  if (!list.length) {
    els.grid.innerHTML = `<div class="empty-state"><span>${isEnglish() ? 'NO RESULTS' : '暂无结果'}</span><h3>${ui('noResults')}</h3><p>${ui('noResultsHint')}</p></div>`;
    return;
  }
  els.grid.innerHTML = list.map(item => `
    <article class="style-card" tabindex="0" data-case-id="${escapeHTML(item.id)}">
      <div class="card-image">${coverHTML(item)}</div>
      <div class="card-body">
        <div class="card-meta"><span>${escapeHTML(item.category)}</span><span class="${item.source === 'private' ? 'public-badge' : ''}">${escapeHTML(item.source === 'private' ? (isEnglish() ? 'Published' : '用户公开') : item.id)}</span></div>
        <h3>${escapeHTML(primaryTitle(item))}</h3>
        <small>${escapeHTML(secondaryTitle(item))}</small>
        <p>${escapeHTML(item.summary || '')}</p>
        ${cardKnowledgeHTML(item)}
        <div class="tag-row">${(item.styleTags || []).slice(0, 3).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>
        <div class="palette">${paletteHTML(item)}</div>
        <div class="card-actions">
          <button class="icon-action is-like-action ${item.likedByViewer ? 'is-active' : ''}" type="button" data-action="like" data-case-id="${escapeHTML(item.id)}" ${item.ownCard ? 'disabled title="不能点赞自己的卡片"' : ''}>${item.likedByViewer ? '♥' : '♡'} ${Number(item.likeCount || 0)}</button>
          <button class="icon-action is-save-action" type="button" data-action="save" data-case-id="${escapeHTML(item.id)}">${isSaved(item) ? ui('saved') : ui('save')}</button>
          ${item.source === 'private' ? '<button class="icon-action" type="button" data-action="edit-private" data-case-id="' + escapeHTML(item.id) + '">' + (isEnglish() ? 'Edit' : '编辑') + '</button>' : ''}
          <button class="icon-action" type="button" data-action="collage" data-case-id="${escapeHTML(item.id)}">+ ${ui('collage')}</button>
        </div>
      </div>
    </article>
  `).join('');
}

function findCase(id) {
  syncCases();
  return cases.find(item => item.id === id);
}

function authorForCard(item) {
  const profile = getProfile();
  const user = getUser();
  if (item?.ownerId && user?.id && item.ownerId === user.id) {
    return {
      name: profile.name || user.name || (isEnglish() ? 'Aesthetic Archive Member' : '审美库成员'),
      avatar: profile.avatar || user.avatar || item.author?.avatar || '',
      role: user.role || item.author?.role || 'user',
      publicId: item.author?.publicId || ''
    };
  }
  if (item?.author && typeof item.author === 'object') {
    return {
      name: item.author.name || (isEnglish() ? 'Aesthetic Archive Member' : '审美库成员'),
      avatar: item.author.avatar || '',
      role: item.author.role || 'user',
      publicId: item.author.publicId || ''
    };
  }
  if (item?.source === 'private') {
    return {
      name: profile.name || user?.name || (isEnglish() ? 'Aesthetic Archive Member' : '审美库成员'),
      avatar: profile.avatar || user?.avatar || '',
      role: user?.role || 'user',
      publicId: item.author?.publicId || ''
    };
  }
  const interaction = cardInteractions.get(item?.id) || {};
  return { name: '系统作者yy', avatar: '', role: 'curator', publicId: interaction.author?.publicId || '' };
}

function authorRoleLabel(role) {
  const labels = isEnglish()
    ? { admin: 'Administrator', reviewer: 'Reviewer', user: 'Member', curator: 'Curated reference' }
    : { admin: '管理员', reviewer: '审核员', user: '创作者', curator: '系统策展' };
  return labels[role] || labels.user;
}

function renderDetailAuthor(item) {
  const author = authorForCard(item);
  const link = document.getElementById('detail-author');
  const avatar = document.getElementById('detail-author-avatar');
  const name = document.getElementById('detail-author-name');
  const role = document.getElementById('detail-author-role');
  if (!avatar || !name || !role) return;
  const publicId = author.publicId || item?.author?.publicId || '';
  if (link) {
    link.href = publicId ? `/authors/${encodeURIComponent(publicId)}` : '#';
    link.classList.toggle('is-disabled', !publicId);
    link.setAttribute('aria-disabled', publicId ? 'false' : 'true');
  }
  name.textContent = author.name;
  role.textContent = authorRoleLabel(author.role);
  avatar.textContent = author.avatar ? '' : (author.name.trim().charAt(0).toUpperCase() || 'AA');
  avatar.style.backgroundImage = author.avatar ? `url("${String(author.avatar).replace(/"/g, '%22')}")` : '';
  avatar.classList.toggle('has-image', Boolean(author.avatar));
}

function renderDetailLike(item) {
  const button = document.getElementById('detail-like');
  const count = document.getElementById('detail-like-count');
  if (!button || !count) return;
  count.textContent = String(Number(item?.likeCount || 0));
  button.classList.toggle('is-active', Boolean(item?.likedByViewer));
  button.querySelector('span').textContent = item?.likedByViewer ? '♥' : '♡';
  button.disabled = cloudState !== 'online' || Boolean(item?.ownCard) || (item?.source === 'private' && item?.publishStatus !== 'published');
  button.title = item?.ownCard ? (isEnglish() ? 'You cannot like your own card' : '不能点赞自己的卡片') : '';
}

async function toggleLike(item) {
  if (!item || cloudState !== 'online' || item.ownCard) return;
  const wasLiked = Boolean(item.likedByViewer);
  const oldCount = Number(item.likeCount || 0);
  item.likedByViewer = !wasLiked;
  item.likeCount = Math.max(0, oldCount + (wasLiked ? -1 : 1));
  renderCards(); renderArchive(); renderDetailLike(item);
  try {
    const result = await cloudRequest(`/api/cards/${encodeURIComponent(item.id)}/like`, { method: wasLiked ? 'DELETE' : 'POST' });
    item.likedByViewer = Boolean(result.liked);
    item.likeCount = Number(result.likeCount || 0);
    cardInteractions.set(item.id, { ...(cardInteractions.get(item.id) || {}), likedByViewer: item.likedByViewer, likeCount: item.likeCount });
  } catch (error) {
    item.likedByViewer = wasLiked; item.likeCount = oldCount;
    toast(`点赞操作失败：${error.message}`);
  }
  renderCards(); renderArchive(); renderDetailLike(item); await syncUnreadCount();
}

function openDetail(item) {
  if (!item) return;
  recordUsage('cardsOpened');
  state.selectedCase = item;
  state.currentGallery = (item.gallery && item.gallery.length ? item.gallery : [item.image]).filter(Boolean);
  els.detailCategory.textContent = `${item.category || (isEnglish() ? 'Style Case' : '风格卡片')} · ${item.source === 'private' ? publishLabel(item) : item.id}`;
  els.detailTitle.textContent = primaryTitle(item);
  els.detailSubtitle.textContent = secondaryTitle(item);
  els.detailCultural.textContent = item.historicalOrigin || item.culturalBackground || item.summary || ui('culturalPending');
  els.detailElements.textContent = [
    item.designLogic,
    item.designElements,
    item.typography ? `Typography: ${item.typography}` : '',
    item.imagery ? `Imagery: ${item.imagery}` : ''
  ].filter(Boolean).join('\n\n') || ui('elementsPending');
  els.detailComposition.textContent = item.composition || inferComposition(item);
  els.detailUseCases.textContent = item.useCases || (item.scenarioTags || []).join(' / ') || ui('useCases');
  els.detailPromptZh.textContent = item.promptZh || ui('promptPending');
  els.detailPromptEn.textContent = item.promptEn || ui('englishPromptPending');
  reorderDetailPrompts();
  els.detailNegative.textContent = item.negativePrompt || ui('negativePending');
  if (els.detailCopyEdit) {
    const isPrivate = item.source === 'private';
    els.detailCopyEdit.textContent = isPrivate
      ? (document.documentElement.lang === 'en' ? 'Edit private case' : '编辑私人条目')
      : (document.documentElement.lang === 'en' ? 'Copy to My Archive' : '复制到个人审美库');
    els.detailCopyEdit.dataset.mode = isPrivate ? 'edit' : 'copy';
  }
  renderDetailPalette(item);
  renderDetailAuthor(item);
  renderDetailLike(item);
  renderGallery(0);
  els.galleryNote.textContent = item.summary || '低饱和、结构清晰、适合沉淀为项目风格参考。';
  els.overlay.classList.add('is-open');
  els.overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('detail-open');
}

function inferComposition(item) {
  const text = searchableText(item);
  if (text.includes('grid') || text.includes('网格')) return 'Grid system / structured editorial composition';
  if (text.includes('cinematic') || text.includes('电影')) return 'Cinematic framing / atmospheric depth';
  if (text.includes('zen') || text.includes('karesansui') || text.includes('禅')) return 'Axial / negative space / low horizon';
  if (text.includes('brutalism') || text.includes('粗野')) return 'Monolithic mass / strong geometry / heavy shadow';
  if (text.includes('collage')) return 'Layered collage / mixed visual hierarchy';
  return 'Balanced reference composition / human-review required';
}

function renderDetailPalette(item) {
  els.detailPalette.innerHTML = (item.palette || []).slice(0, 4).map(color => {
    const hex = typeof color === 'string' ? color : color.hex;
    const name = typeof color === 'string' ? color : color.name;
    return `<div class="detail-color" style="background:${escapeHTML(hex)}"><span>${escapeHTML(name || hex)}<br>${escapeHTML(hex)}</span></div>`;
  }).join('');
}

function renderGallery(activeIndex) {
  const paths = state.currentGallery;
  const active = paths[activeIndex] || paths[0];
  els.mainImage.innerHTML = active ? `<img src="${asset(active)}" alt="${escapeHTML(state.selectedCase?.title || 'Style reference')}" onerror="this.parentElement.style.background='#ddd2c0';this.remove()">` : '<span class="image-placeholder">No Gallery</span>';
  els.thumbs.innerHTML = paths.slice(0, 8).map((path, index) => `
    <button class="thumb ${index === activeIndex ? 'is-active' : ''}" type="button" data-thumb-index="${index}">
      <img src="${asset(path)}" alt="Gallery thumbnail ${index + 1}" loading="lazy" onerror="this.parentElement.style.background='#ddd2c0';this.remove()">
    </button>
  `).join('');
}

function closeDetail() {
  els.overlay.classList.remove('is-open');
  els.overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('detail-open');
}

async function saveCase(item) {
  if (!item) return;
  const alreadySaved = isSaved(item);
  try {
    if (cloudState === 'online') {
      await cloudRequest(alreadySaved ? `/api/saved?cardId=${encodeURIComponent(item.id)}` : '/api/saved', { method: alreadySaved ? 'DELETE' : 'POST', ...(alreadySaved ? {} : { body: JSON.stringify({ cardId: item.id }) }) });
      if (alreadySaved) cloudSaved.delete(item.id); else cloudSaved.add(item.id);
    } else {
      const saved = getSaved();
      if (!alreadySaved) saved.push({ ...item, savedAt: new Date().toISOString() });
      setSaved(saved);
    }
    renderCards(); renderArchive(); updateSavedUI();
    toast(alreadySaved ? (document.documentElement.lang === 'en' ? 'Removed from saved' : '已取消收藏') : (document.documentElement.lang === 'en' ? 'Saved' : '已保存到个人收藏'));
  } catch (error) { toast(`收藏操作失败：${error.message}`); }
}

async function removeSaved(id) {
  try {
    if (cloudState === 'online') { await cloudRequest(`/api/saved?cardId=${encodeURIComponent(id)}`, { method: 'DELETE' }); cloudSaved.delete(id); }
    else setSaved(getSaved().filter(item => item.id !== id));
    renderCards(); renderArchive(); updateSavedUI(); toast('已从收藏移除');
  } catch (error) { toast(`取消收藏失败：${error.message}`); }
}

function renderArchive(highlightId = '') {
  const privateCases = getPrivateCases();
  if (!els.archiveGrid) return;
  if (!privateCases.length) {
    updateArchiveHealth();
    els.archiveGrid.innerHTML = `<div class="empty-state"><span>${isEnglish() ? 'PRIVATE ARCHIVE' : '私人审美库'}</span><h3>${ui('archiveEmpty')}</h3><p>${ui('archiveEmptyHint')}</p></div>`;
    return;
  }
  updateArchiveHealth();
  els.archiveGrid.innerHTML = privateCases.map(item => `
    <article class="style-card ${item.id === highlightId ? 'is-new' : ''}" tabindex="0" data-case-id="${escapeHTML(item.id)}">
      <div class="card-image">${coverHTML(item)}</div>
      <div class="card-body">
        <div class="card-meta"><span>${escapeHTML(item.category || (isEnglish() ? 'Private' : '私人卡片'))}</span><span class="${publishClass(item)}">${publishLabel(item)}</span></div>
        <h3>${escapeHTML(primaryTitle(item))}</h3>
        <small>${escapeHTML(secondaryTitle(item))}</small>
        <p>${escapeHTML(item.summary || (isEnglish() ? 'A private aesthetic card ready to edit and export.' : '审美卡片，可查看详情、编辑或导出。'))}</p>
        <div class="tag-row">${(item.styleTags || []).slice(0, 3).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')} ${item.promptEngineering?.review ? `<span class="prompt-status is-${escapeHTML(item.promptEngineering.review.status)}">Prompt ${escapeHTML(item.promptEngineering.review.score)}/100</span>` : ''}</div>
        <div class="owner-metrics"><span>♡ ${Number(item.likeCount || 0)} ${isEnglish() ? 'Likes' : '点赞'}</span><span>▣ ${Number(item.savedCount || 0)} ${isEnglish() ? 'Saves' : '收藏'}</span></div>
        <div class="palette">${paletteHTML(item)}</div>
        <div class="card-actions">
          <button class="icon-action" type="button" data-action="save" data-case-id="${escapeHTML(item.id)}">${isSaved(item) ? (isEnglish() ? 'Saved' : '已收藏') : (isEnglish() ? 'Save' : '收藏')}</button>
          <button class="icon-action" type="button" data-action="edit-private" data-case-id="${escapeHTML(item.id)}">${isEnglish() ? 'Edit' : '编辑'}</button>
          ${item.visibility === 'public' && item.publishStatus === 'rejected' ? `<button class="icon-action" type="button" data-action="resubmit-public" data-case-id="${escapeHTML(item.id)}">${isEnglish() ? 'Resubmit' : '重新提交'}</button>` : ''}
          <button class="icon-action" type="button" data-action="delete-private" data-case-id="${escapeHTML(item.id)}">${isEnglish() ? 'Delete' : '删除'}</button>
        </div>
      </div>
    </article>
  `).join('');
}

async function updatePublishStatus(id, status) {
  try {
    if (cloudState === 'online') {
      const action = status === 'published' ? 'publish' : status === 'rejected' ? 'reject' : status === 'private' ? 'unpublish' : 'submit';
      await cloudRequest('/api/cards/review', { method: 'POST', body: JSON.stringify({ cardId: id, action }) });
      await syncCloudWorkspace();
    } else {
      const next = getPrivateCases().map(item => item.id !== id ? item : status === 'private' ? { ...item, visibility: 'private', publishStatus: 'private' } : { ...item, visibility: 'public', publishStatus: status });
      if (!saveJSON(STORAGE.privateCases, next)) return;
      syncCases(); renderCards(); renderArchive(id); updateSavedUI();
    }
    toast(status === 'published' ? '已通过审核并发布到广场' : (status === 'rejected' ? '审核未通过，卡片仍保留在私人审美库' : status === 'pending' ? '已提交审核，审核通过后才会进入广场' : '已下架为私密'));
  } catch (error) { toast(`审核操作失败：${error.message}`); }
}

async function deletePrivateCase(id) {
  if (cloudState === 'online') {
    try { await cloudRequest(`/api/cards?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); await syncCloudWorkspace(); toast('已删除私人条目'); } catch (error) { toast(`删除失败：${error.message}`); }
    return;
  }
  const next = getPrivateCases().filter(item => item.id !== id);
  saveJSON(STORAGE.privateCases, next);
  setSaved(getSaved().filter(item => item.id !== id));
  removeFromCollage(id);
  if (state.selectedCase?.id === id) closeDetail();
  syncCases();
  renderCards();
  renderArchive();
  updateSavedUI();
  toast('已删除私人条目');
}

function updateSavedUI() {
  const saved = getSaved();
  els.savedCount.textContent = isEnglish() ? `${saved.length} saved` : `已收藏 ${saved.length} 张`;
  if (!els.savedGrid) return;
  if (!saved.length) {
    els.savedGrid.innerHTML = `<div class="empty-state"><span>${isEnglish() ? 'SAVED' : '个人收藏'}</span><h3>${ui('savedEmpty')}</h3><p>${ui('savedEmptyHint')}</p></div>`;
    return;
  }
  els.savedGrid.innerHTML = saved.map(savedItem => {
    const item = findCase(savedItem.id) || savedItem;
    return `
      <article class="style-card" tabindex="0" data-case-id="${escapeHTML(item.id)}">
        <div class="card-image">${coverHTML(item)}</div>
        <div class="card-body">
          <div class="card-meta"><span>${escapeHTML(item.category || 'Saved')}</span><span class="${item.source === 'private' ? 'private-badge' : ''}">${escapeHTML(item.source === 'private' ? 'Private' : item.id)}</span></div>
          <h3>${escapeHTML(primaryTitle(item))}</h3>
          <small>${escapeHTML(secondaryTitle(item))}</small>
          <p>${escapeHTML(item.summary || (isEnglish() ? 'Saved aesthetic material ready for a board or export.' : '已收藏的审美资料，可继续加入画板或导出。'))}</p>
          <div class="palette">${paletteHTML(item)}</div>
          <div class="card-actions"><button class="icon-action" type="button" data-action="remove" data-case-id="${escapeHTML(item.id)}">${isEnglish() ? 'Remove' : '移除收藏'}</button></div>
        </div>
      </article>`;
  }).join('');
}

function caseMarkdown(item) {
  return `# ${item.id} · ${item.title}\n\n${item.titleZh || ''}\n\n## Summary\n${item.summary || ''}\n\n## Cultural Background\n${item.historicalOrigin || item.culturalBackground || ''}\n\n## Design Elements\n${item.designElements || item.designLogic || ''}\n\n## Palette\n${(item.palette || []).map(color => typeof color === 'string' ? color : `${color.name || ''} ${color.hex || ''}`.trim()).join(', ')}\n\n## Composition Type\n${item.composition || inferComposition(item)}\n\n## Use Cases\n${item.useCases || (item.scenarioTags || []).join(', ')}\n\n## Prompt ZH\n\`\`\`text\n${item.promptZh || ''}\n\`\`\`\n\n## Prompt EN\n\`\`\`text\n${item.promptEn || ''}\n\`\`\``;
}

function exportPlaza(format) {
  const list = getVisibleCases();
  if (!list.length) return toast('当前广场结果为空');
  if (format === 'json') {
    download('aesthetic-archive-plaza-results.json', JSON.stringify(list, null, 2), 'application/json');
    return;
  }
  download('aesthetic-archive-plaza-results.md', list.map(caseMarkdown).join('\n\n---\n\n'), 'text/markdown');
}

function clearPlazaFilters() {
  state.activeCategory = 'All';
  state.query = '';
  els.search.value = '';
  document.querySelectorAll('[data-filter-group="category"]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.filter === 'All');
  });
  document.querySelectorAll('[data-query]').forEach(button => button.classList.remove('is-active'));
  renderCards();
  toast('已清空广场搜索与筛选');
}

function exportSaved(format) {
  recordUsage('exports');
  const saved = getSaved().map(entry => findCase(entry.id) || entry);
  if (!saved.length) return toast('收藏为空');
  const filename = `aesthetic-archive-saved.${format}`;
  const content = format === 'json'
    ? JSON.stringify(saved, null, 2)
    : saved.map(caseMarkdown).join('\n\n---\n\n');
  download(filename, content, format === 'json' ? 'application/json' : 'text/markdown');
}

let exportDirectoryHandle = null;
async function download(filename, content, mime) {
  const date = new Date().toISOString().slice(0, 10);
  const extension = filename.split('.').pop()?.toLowerCase() || 'file';
  const typeFolder = extension === 'json' ? 'backup-json' : extension === 'md' ? 'markdown' : extension === 'html' ? 'html' : extension === 'pdf' ? 'pdf' : 'images';
  const structuredName = `aesthetic-archive/${typeFolder}/${date}/${filename}`;
  if (exportDirectoryHandle?.getDirectoryHandle && typeof exportDirectoryHandle.getFileHandle === 'function') {
    try {
      const typeDirectory = await exportDirectoryHandle.getDirectoryHandle(typeFolder, { create: true });
      const day = await typeDirectory.getDirectoryHandle(date, { create: true });
      const file = await day.getFileHandle(filename.split('/').pop(), { create: true });
      const writable = await file.createWritable();
      await writable.write(new Blob([content], { type: mime }));
      await writable.close();
      toast(`已保存到本地文件夹：${typeFolder}/${date}/${filename.split('/').pop()}`);
      return;
    } catch (error) { console.warn('Folder export failed, falling back to browser download:', error); }
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${date}-${filename.replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
  link.title = structuredName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function copyText(text) {
  if (!text) return toast('没有可复制内容');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  toast('Copied');
}

let reviewQueue = [];

function reviewCardImage(card) {
  const images = Array.isArray(card.card_images) ? card.card_images : [];
  return images.find(image => image?.url)?.url || card.image || '';
}

function renderReviewQueue() {
  if (!els.reviewGrid) return;
  const en = isEnglish();
  if (!reviewQueue.length) {
    els.reviewGrid.innerHTML = `<div class="empty-state"><span>${en ? 'QUEUE CLEAR' : 'QUEUE CLEAR'}</span><h3>${en ? 'No cards awaiting review.' : '当前没有待审核卡片。'}</h3><p>${en ? 'New public submissions will appear here.' : '新的公开提交会显示在这里。'}</p></div>`;
    return;
  }
  els.reviewGrid.innerHTML = reviewQueue.map(card => {
    const image = reviewCardImage(card);
    const latest = Array.isArray(card.publish_reviews) ? card.publish_reviews.at(-1) : null;
    return `<article class="review-card" data-review-card="${escapeHTML(card.id)}">
      <div class="review-card-image">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(card.title || '')}">` : '<span>No image</span>'}</div>
      <div class="review-card-body"><div class="card-meta"><span>${escapeHTML(card.category || 'Other')}</span><span>${escapeHTML(card.publish_status || 'pending')}</span></div>
      <h3>${escapeHTML(card.title_zh || card.title || 'Untitled')}</h3><p class="review-card-en">${escapeHTML(card.title || '')}</p><p>${escapeHTML(card.summary || '暂无摘要')}</p>
      <div class="review-review-notes"><strong>${en ? 'Review note' : '审核备注'}</strong><span>${escapeHTML(latest?.note || '暂无')}</span></div>
      <div class="review-actions"><button class="button primary" type="button" data-review-action="approve" data-review-id="${escapeHTML(card.id)}">${en ? 'Approve' : '通过'}</button><button class="button danger" type="button" data-review-action="reject" data-review-id="${escapeHTML(card.id)}">${en ? 'Reject' : '驳回'}</button></div></div>
    </article>`;
  }).join('');
}

async function loadReviewQueue() {
  if (!els.reviewGrid) return;
  if (els.reviewStatus) els.reviewStatus.textContent = isEnglish() ? 'Loading review queue…' : '正在读取审核队列…';
  const user = getUser();
  if (!user || user.provider !== 'supabase') {
    if (els.reviewStatus) els.reviewStatus.textContent = isEnglish() ? 'Sign in with a Supabase reviewer or admin account to load the queue.' : '请使用 Supabase reviewer 或 admin 账号登录后加载审核队列。';
    els.reviewGrid.innerHTML = `<div class="empty-state"><span>${isEnglish() ? 'REVIEW ACCESS REQUIRED' : '需要审核权限'}</span><h3>${isEnglish() ? 'Review Queue is ready.' : '审核队列页面已准备就绪。'}</h3><p>${isEnglish() ? 'Only authenticated reviewer and admin accounts can load or action public submissions.' : '只有已认证的 reviewer 或 admin 账号可以加载和处理公开提交。'}</p><button class="button primary" type="button" data-login-open>${isEnglish() ? 'Sign in' : '登录'}</button></div>`;
    return;
  }
  try {
    const response = await fetch('/api/admin/reviews', { credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 403 || response.status === 401) {
      if (els.reviewStatus) els.reviewStatus.textContent = isEnglish() ? 'This account does not have review permission.' : '当前账号没有审核权限。';
      els.reviewGrid.innerHTML = `<div class="empty-state"><span>${isEnglish() ? 'ACCESS DENIED' : '无审核权限'}</span><h3>${isEnglish() ? 'Reviewer or admin access is required.' : '需要 reviewer 或 admin 权限。'}</h3><p>${isEnglish() ? 'Ask an administrator to assign the reviewer role to this account.' : '请联系管理员为当前账号分配 reviewer 角色。'}</p></div>`;
      return;
    }
    if (!response.ok) throw new Error(payload.error?.message || `Review API ${response.status}`);
    reviewQueue = Array.isArray(payload.data) ? payload.data : [];
    document.querySelectorAll('.reviewer-only').forEach(node => { node.hidden = false; });
    if (els.reviewStatus) els.reviewStatus.textContent = `${reviewQueue.length} ${isEnglish() ? 'cards in queue' : '张卡片待审核'}`;
    renderReviewQueue();
  } catch (error) {
    if (els.reviewStatus) els.reviewStatus.textContent = `${isEnglish() ? 'Unable to load queue: ' : '审核队列加载失败：'}${error.message}`;
    els.reviewGrid.innerHTML = `<div class="empty-state"><span>${isEnglish() ? 'QUEUE UNAVAILABLE' : '审核队列不可用'}</span><h3>${isEnglish() ? 'The review service is unavailable.' : '审核服务暂时不可用。'}</h3><p>${isEnglish() ? 'Check Supabase authentication and try refreshing the queue.' : '请检查 Supabase 登录状态后刷新队列。'}</p></div>`;
  }
}

async function reviewCard(cardId, action) {
  try {
    const response = await fetch(`/api/admin/reviews?id=${encodeURIComponent(cardId)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Review API ${response.status}`);
    toast(action === 'approve' ? (isEnglish() ? 'Card approved' : '卡片已通过审核') : (isEnglish() ? 'Card rejected' : '卡片已驳回'));
    await loadReviewQueue();
  } catch (error) { toast(`${isEnglish() ? 'Review failed: ' : '审核失败：'}${error.message}`); }
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === tab));
  if (tab === 'saved') updateSavedUI();
  if (tab === 'collage') renderCollage();
  if (tab === 'provider') {
    renderProviders();
    renderProviderSelectors();
  }
  if (tab === 'reviews') loadReviewQueue();
}

function getUser() {
  return loadJSON(STORAGE.user, null);
}

function setUser(user) {
  if (user) saveJSON(STORAGE.user, user);
  else localStorage.removeItem(STORAGE.user);
  renderAuthState();
  populateSettings();
}

function renderAuthState() {
  const user = getUser();
  const profile = getProfile();
  document.body.classList.toggle('is-authenticated', Boolean(user));
  const lang = document.documentElement.lang || 'zh-CN';
  const label = user ? (profile.name || user.name || user.identity || '').slice(0, 22) : (i18n[lang] || i18n['zh-CN']).login;
  document.querySelectorAll('[data-login-open]').forEach(button => {
    const name = button.querySelector('[data-account-name]');
    const avatar = button.querySelector('[data-account-avatar]');
    if (name) name.textContent = label;
    else button.textContent = label;
    if (avatar) {
      const avatarValue = profile.avatar || user?.avatar || '';
      avatar.textContent = avatarValue ? '' : (user ? (label.trim().charAt(0).toUpperCase() || 'AA') : 'AA');
      avatar.style.backgroundImage = avatarValue ? `url("${String(avatarValue).replace(/"/g, '%22')}")` : '';
      avatar.classList.toggle('has-image', Boolean(avatarValue));
    }
    button.title = user ? user.identity : 'Login';
  });
  if (els.loginIdentity) els.loginIdentity.value = user?.identity || '';
  if (els.logout) els.logout.hidden = !user;
  if (els.loginEmail) els.loginEmail.hidden = Boolean(user);
  if (els.loginGoogle) els.loginGoogle.hidden = Boolean(user);
  if (els.loginNote) els.loginNote.textContent = user ? (lang === 'en' ? 'Signed in with Supabase.' : '当前账号已通过 Supabase 登录。') : (lang === 'en' ? 'Sign in to sync your private workspace.' : '登录后同步私人工作区。');
} 

function loginWithIdentity(event) {
  event.preventDefault();
  const identity = els.loginIdentity.value.trim();
  if (!identity) return toast(document.documentElement.lang === 'en' ? 'Enter an email or phone number' : '请输入邮箱或电话');
  const name = identity.includes('@') ? identity.split('@')[0] : identity;
  setUser({ provider: 'local', identity, name, signedInAt: new Date().toISOString() });
  closeLogin();
  toast(document.documentElement.lang === 'en' ? 'Logged in locally' : '已登录本地演示账号');
}

function loginWithGoogle() {
  setUser({ provider: 'google-demo', identity: 'google-demo@aesthetic.archive', name: 'Google Demo', signedInAt: new Date().toISOString() });
  closeLogin();
  toast(document.documentElement.lang === 'en' ? 'Google demo login active' : '已使用 Google 演示登录');
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    setUser(null);
    closeLogin();
    window.location.assign('/auth');
  }
}

function openLogin() {
  window.location.assign('/auth');
}

function closeLogin() {
  els.loginPopover.classList.remove('is-open');
  els.loginPopover.setAttribute('aria-hidden', 'true');
}

function toggleLanguageMenu(event) {
  const menu = event.currentTarget.closest('[data-language-menu]');
  const shouldOpen = !menu.classList.contains('is-open');
  document.querySelectorAll('[data-language-menu]').forEach(item => {
    item.classList.remove('is-open');
    item.querySelector('[data-language-toggle]')?.setAttribute('aria-expanded', 'false');
  });
  menu.classList.toggle('is-open', shouldOpen);
  event.currentTarget.setAttribute('aria-expanded', String(shouldOpen));
}

function text(selector, value) {
  document.querySelectorAll(selector).forEach(node => { node.textContent = value; });
}

function labelText(fieldId, value) {
  const field = document.getElementById(fieldId);
  const label = field?.closest('label');
  if (!label) return;
  const node = [...label.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
  if (node) node.textContent = `${value} `;
}

function labelContentText(id, value) {
  const node = document.getElementById(id);
  if (!node) return;
  const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
  if (textNode) textNode.textContent = value;
}

function placeholder(id, value) {
  const field = document.getElementById(id);
  if (field) field.placeholder = value;
}

function setFilePickerLabels(lang) {
  const en = lang === 'en';
  const labels = {
    'archive-file-label': en ? 'Choose files' : '选择文件',
    'setting-avatar-file-label': en ? 'Choose image' : '选择图片',
    'settings-import-file-label': en ? 'Import backup' : '导入工作区备份'
  };
  Object.entries(labels).forEach(([id, value]) => text(`#${id}`, value));
}

function optionText(selector, values) {
  const field = document.querySelector(selector);
  if (!field) return;
  [...field.options].forEach(option => { if (values[option.value] || values[option.textContent]) option.textContent = values[option.value] || values[option.textContent]; });
}

function applyWorkspaceTranslations(lang) {
  const en = lang === 'en';
  const tr = en ? {
    providerEyebrow: 'BRING YOUR OWN PROVIDER', providerTitle: 'Connect models, keep your method.', providerIntro: 'Provider selects the model. Card templates define how it extracts cultural context, design elements and reusable prompts. API keys are encrypted server-side in your private Provider Vault.', localKey: 'SERVER-SIDE ENCRYPTION', configured: 'Configured providers', configuredCopy: 'Choose a service for image analysis and Prompt generation.', current: 'Current providers', serviceConfig: 'Provider configuration', serviceConfigCopy: 'Saved services can be selected in My Archive.', basic: 'Connection', capabilities: 'Model capabilities', imageModels: 'Vision models', textModels: 'Text models', imageCapable: 'This service supports image analysis', imageProcessing: 'Image processing', saveProvider: 'Save provider', newProvider: 'New provider',
    settingsEyebrow: 'WORKSPACE SETTINGS', settingsTitle: 'Manage your profile and workspace method.', settingsIntro: 'Profile, card generation rules and local data stay in this browser. The Provider calls the model; the card template shapes how it understands your aesthetic.', localWorkspace: 'LOCAL WORKSPACE', profile: 'Profile', profileCopy: 'Keep the basics ready for future accounts, sync and services.', saveProfile: 'Save profile', workspace: 'Local workspace', workspaceCopy: 'These defaults affect new actions only. Existing cards are unchanged.', saveWorkspace: 'Save workspace settings', templates: 'Card generation templates', templatesCopy: 'Define how AI extracts information from images, topics and cultural context to create reusable cards and Prompts.', copyTemplate: 'Copy and edit', resetTemplate: 'Restore system default', templatePreview: 'Template preview', testPrompt: 'Test topic', testButton: 'Generate test Prompt', saveTemplate: 'Save template', usage: 'Usage data', usageCopy: 'Personal actions in this browser are recorded. Public Plaza metrics are not fabricated before account and server sync.', privacy: 'Privacy and rights', privacyCopy: 'Reminders help you confirm sources and permissions; they do not judge rights for you.', publishConfirm: 'Confirm before publishing', publishCopy: 'Review content and visibility before sending a private card to the shared Plaza.', copyright: 'Remind me to confirm image rights', copyrightCopy: 'Confirm image source and usage rights before publishing.', source: 'Remind me about sources on export', sourceCopy: 'Keep source information when exporting materials with external images.', localInfo: 'Local workspace', localInfoCopy: 'Private cards, saves, boards and settings stay in this browser. Provider API keys are redacted in backups and must be re-entered after import.', noUpload: 'Private data is not uploaded', redacted: 'API keys are redacted', rights: 'You own the rights decision', savePrivacy: 'Save privacy and rights', data: 'Data and backup', dataCopy: 'JSON is a machine-readable workspace backup, not a normal content export.', localLibrary: 'Local library', backupRules: 'Backup rules', exportBackup: 'Export workspace backup', importBackup: 'Import workspace backup', danger: 'Danger zone', dangerCopy: 'Clear one category at a time instead of deleting the whole workspace.', clearPrivate: 'Clear private archive', clearSaved: 'Clear saved cards', clearBoard: 'Clear Collage Board', clearAll: 'Clear entire local workspace', dangerNote: 'Clearing the entire workspace removes private cards, saves, board, providers, profile, templates and preferences. Public Plaza and project files are not deleted.',
    name: 'Name', email: 'Email', contact: 'Contact', specialty: 'Design focus', avatar: 'Avatar', language: 'Language', exportFormat: 'Default content export', defaultTab: 'Default opening page', density: 'Display density', templateName: 'Template name', templateScope: 'Use cases', templateFocus: 'Analysis focus', templateRules: 'Generation rules', testTopic: 'Test topic',
  } : {
    providerEyebrow: '自带 AI 服务 / BRING YOUR OWN PROVIDER', providerTitle: '连接模型，保留你的分析方法。', providerIntro: 'Provider 决定使用哪个模型；卡片生成模板决定模型如何提取文化背景、设计元素和可复用 Prompt。API Key 经服务端加密后存入你的私有 Provider Vault。', localKey: '服务端加密存储', configured: '已配置服务', configuredCopy: '选择一个服务用于图片分析和 Prompt 生成。', current: '当前服务', serviceConfig: '服务配置', serviceConfigCopy: '保存后可在个人审美库中选择对应模型。', basic: '基础连接', capabilities: '模型能力', imageModels: '可识图模型', textModels: '文本模型', imageCapable: '此服务支持图片分析', imageProcessing: '图片处理', saveProvider: '保存 AI 服务', newProvider: '新建服务',
    settingsEyebrow: '个人设置 / WORKSPACE SETTINGS', settingsTitle: '管理你的资料与工作区方法。', settingsIntro: '个人资料、卡片生成规则和本地数据都保存在当前浏览器。Provider 只负责调用模型，卡片模板决定模型如何理解你的审美。', localWorkspace: '本地工作区 · LOCAL ONLY', profile: '个人资料', profileCopy: '为未来的账号、同步和服务扩展保留基础信息。', saveProfile: '保存个人资料', workspace: '本地工作区', workspaceCopy: '只影响之后的新操作，不会改变已经保存的卡片。', saveWorkspace: '保存工作区设置', templates: '卡片生成模板', templatesCopy: '决定 AI 如何从图片、主题和文化语境中提取信息，并生成可复用的结构化卡片与 Prompt。', copyTemplate: '复制并编辑', resetTemplate: '恢复系统默认', templatePreview: '模板预览 / Template preview', testPrompt: '测试主题', testButton: '生成测试 Prompt', saveTemplate: '保存模板', usage: '使用数据', usageCopy: '记录当前浏览器内的个人操作；公共广场数据在接入账号和服务端前不会伪造。', privacy: '隐私与版权', privacyCopy: '提醒你确认来源和使用权限，但不会替你判断图片是否拥有授权。', publishConfirm: '公开前再次确认', publishCopy: '将私人卡片提交到共享广场前，先确认内容和可见范围。', copyright: '提醒确认图片授权', copyrightCopy: '公开卡片前提醒你确认图片来源和使用权。', source: '导出时提醒来源', sourceCopy: '导出包含外部图片的资料时，提醒保留来源信息。', localInfo: '本地工作区', localInfoCopy: '私人卡片、收藏、画板和设置保存在当前浏览器。Provider API Key 不会以明文进入备份，导入后需要重新填写。', noUpload: '不自动上传私人资料', redacted: 'API Key 备份时脱敏', rights: '版权判断由你负责', savePrivacy: '保存隐私与版权设置', data: '数据与备份', dataCopy: 'JSON 只用于机器可读的完整工作区备份，不是普通内容导出格式。', localLibrary: '本地文件库', backupRules: '备份规则', exportBackup: '导出工作区备份', importBackup: '导入工作区备份', danger: '危险操作', dangerCopy: '分开清理，避免为了删除一类资料而清空整个工作区。', clearPrivate: '清空私人审美库', clearSaved: '清空个人收藏', clearBoard: '清空 Collage 画板', clearAll: '清空整个本地工作区', dangerNote: '清空整个工作区会删除私人卡片、收藏、画板、Provider 配置、个人资料、模板和偏好；不会删除公开视觉库或项目文件。',
    name: '名称 / Name', email: '邮箱 / Email', contact: '联系方式 / Contact', specialty: '设计方向 / Design focus', avatar: '头像 / Avatar', language: '界面语言 / Language', exportFormat: '默认内容导出格式', defaultTab: '默认打开页面', density: '显示密度', templateName: '模板名称', templateScope: '适用场景', templateFocus: '分析重点', templateRules: '生成规则', testTopic: '测试主题',
  };
  const set = (selector, value) => text(selector, value);
  set('.provider-intro .eyebrow', tr.providerEyebrow); set('.provider-intro h2', tr.providerTitle); set('.provider-intro > div > p:not(.eyebrow)', tr.providerIntro); set('.provider-intro .local-badge', tr.localKey); set('.provider-accounts h3', tr.configured); set('.provider-accounts .provider-section-head p', tr.configuredCopy); set('.provider-count-row span', tr.current); set('.provider-form h3', tr.serviceConfig); set('.provider-form .provider-section-head p', tr.serviceConfigCopy); set('.provider-fieldset:nth-of-type(1) legend', tr.basic); set('.provider-fieldset:nth-of-type(2) legend', tr.capabilities); set('.provider-fieldset:nth-of-type(3) legend', tr.imageProcessing); labelText('provider-image-capable', tr.imageCapable); set('#provider-form button[type="submit"]', tr.saveProvider); set('#provider-new-btn', tr.newProvider);
  set('.settings-intro .eyebrow', tr.settingsEyebrow); set('.settings-intro h2', tr.settingsTitle); set('.settings-intro p:not(.eyebrow)', tr.settingsIntro); set('.settings-intro .local-badge', tr.localWorkspace); set('.settings-profile h3', tr.profile); set('.settings-profile .settings-section-head p', tr.profileCopy); set('#settings-profile-form button[type="submit"]', tr.saveProfile); set('#settings-form .settings-section-head h3', tr.workspace); set('#settings-form .settings-section-head p', tr.workspaceCopy); set('#settings-form button[type="submit"]', tr.saveWorkspace); set('.settings-template-section h3', tr.templates); set('.settings-template-section .settings-section-head p', tr.templatesCopy); set('#setting-template-new', en ? 'New template' : '新建模板'); set('#setting-template-copy', tr.copyTemplate); set('#setting-template-reset', tr.resetTemplate); set('.template-preview-head span:first-child', tr.templatePreview); set('#setting-template-test', tr.testButton); set('#setting-template-save', tr.saveTemplate); set('[data-panel="settings"] .settings-section:nth-of-type(4) h3', tr.usage); set('[data-panel="settings"] .settings-section:nth-of-type(4) .settings-section-head p', tr.usageCopy); set('.settings-privacy-section h3', tr.privacy); set('.settings-privacy-section .settings-section-head p', tr.privacyCopy); set('.privacy-option:nth-child(1) strong', tr.publishConfirm); set('.privacy-option:nth-child(1) small', tr.publishCopy); set('.privacy-option:nth-child(2) strong', tr.copyright); set('.privacy-option:nth-child(2) small', tr.copyrightCopy); set('.privacy-option:nth-child(3) strong', tr.source); set('.privacy-option:nth-child(3) small', tr.sourceCopy); set('.local-info-heading strong', tr.localInfo); set('.local-info p', tr.localInfoCopy); set('.local-info-points span:nth-child(1)', tr.noUpload); set('.local-info-points span:nth-child(2)', tr.redacted); set('.local-info-points span:nth-child(3)', tr.rights); set('#settings-privacy-save', tr.savePrivacy); set('.settings-data-section h3', tr.data); set('.settings-data-section .settings-section-head p', tr.dataCopy); set('.data-grid > div:nth-child(1) strong', tr.localLibrary); set('.data-grid > div:nth-child(2) strong', tr.backupRules); set('#settings-export-btn', tr.exportBackup); const importText = document.querySelector('.settings-file-button'); if (importText?.firstChild) importText.firstChild.textContent = `${tr.importBackup} `; set('.settings-danger-section h3', tr.danger); set('.settings-danger-section .settings-section-head p', tr.dangerCopy); set('#settings-clear-private-btn', tr.clearPrivate); set('#settings-clear-saved-btn', tr.clearSaved); set('#settings-clear-board-btn', tr.clearBoard); set('#settings-clear-btn', tr.clearAll); set('.danger-note', tr.dangerNote);
  labelText('provider-name', en ? 'Service name' : '服务名称'); labelText('provider-type', en ? 'Service type' : '服务类型'); labelText('provider-key', en ? 'API key' : 'API 密钥'); labelText('provider-base-url', en ? 'Endpoint' : '接口地址'); labelText('provider-image-models', tr.imageModels); labelText('provider-text-models', tr.textModels); labelText('provider-image-api', en ? 'Image processing service' : '图片处理服务'); labelText('provider-image-api-url', en ? 'Processing endpoint' : '图片处理接口地址');
  labelText('setting-avatar', tr.avatar); labelText('setting-name', tr.name); labelText('setting-email', tr.email); labelText('setting-contact', tr.contact); labelText('setting-specialty', tr.specialty); labelText('setting-language', tr.language); labelText('setting-export-format', tr.exportFormat); labelText('setting-default-tab', tr.defaultTab); labelText('setting-density', tr.density); labelText('setting-template-name', tr.templateName); labelText('setting-template-scope', tr.templateScope); labelText('setting-template-focus', tr.templateFocus); labelText('setting-template-instructions', tr.templateRules); labelText('setting-template-test-topic', tr.testTopic);
  placeholder('provider-name', en ? 'e.g. Work OpenAI / Personal Gemini' : '例如：工作用 OpenAI / 个人 Gemini'); placeholder('provider-key', en ? 'Encrypted and stored server-side' : '经服务端加密保存'); placeholder('provider-base-url', en ? 'Only required for a custom endpoint' : '只有自定义接口需要填写'); placeholder('provider-image-models', en ? 'e.g. gpt-4o\\ngemini-1.5-pro' : '例如：gpt-4o\\ngemini-1.5-pro'); placeholder('provider-text-models', en ? 'e.g. gpt-4o-mini\\nclaude-3.5-sonnet' : '例如：gpt-4o-mini\\nclaude-3.5-sonnet'); placeholder('provider-image-api-url', en ? 'Custom image-processing endpoint' : '自定义去背景接口或代理地址'); placeholder('setting-name', en ? 'Your name' : '你的名称'); placeholder('setting-email', 'name@example.com'); placeholder('setting-contact', en ? 'Optional' : '可选'); placeholder('setting-specialty', en ? 'e.g. spatial design, brand visual, AI generation' : '例如：空间设计、品牌视觉、AI 生成'); placeholder('setting-template-name', en ? 'e.g. Residential material study' : '例如：住宅空间审美分析'); placeholder('setting-template-scope', en ? 'Spatial design / Brand visual / AI image generation' : '空间设计 / 品牌视觉 / AI 生图'); placeholder('setting-template-focus', en ? 'Cultural context, materials, spatial relations, light, composition, palette' : '文化背景、材料与工艺、空间关系、光线、构图、色彩'); placeholder('setting-template-instructions', en ? 'Write the rules you want AI to follow.' : '写下你希望 AI 遵守的分析和 Prompt 规则'); placeholder('setting-template-test-topic', en ? 'e.g. quiet residential entrance, natural stone and soft daylight' : '例如：安静的住宅入口，天然石材与柔和自然光');
  optionText('#setting-export-format', en ? { png: 'PNG image', jpg: 'JPG image', pdf: 'PDF document', html: 'HTML archive', md: 'Markdown archive' } : { png: 'PNG 图片', jpg: 'JPG 图片', pdf: 'PDF 文档', html: 'HTML 图文档案', md: 'Markdown 文本档案' }); optionText('#provider-type', en ? { OpenAI: 'OpenAI', Gemini: 'Gemini', OpenRouter: 'OpenRouter', 'Custom Endpoint': 'Custom Endpoint' } : { OpenAI: 'OpenAI', Gemini: 'Gemini', OpenRouter: 'OpenRouter', 'Custom Endpoint': 'Custom Endpoint' }); optionText('#provider-image-api', en ? { none: 'Not used', removebg: 'remove.bg', clipdrop: 'Clipdrop', 'custom-remove-bg': 'Custom remove-background endpoint' } : { none: '不使用', removebg: 'remove.bg', clipdrop: 'Clipdrop', 'custom-remove-bg': '自定义去背景接口' }); optionText('#setting-default-tab', en ? { plaza: 'Public Plaza', archive: 'My Archive', saved: 'Saved', collage: 'Collage Board' } : { plaza: '视觉库广场', archive: '个人审美库', saved: '个人收藏', collage: 'Collage 画板' }); optionText('#setting-density', en ? { compact: 'Compact', standard: 'Standard', spacious: 'Spacious' } : { compact: '紧凑', standard: '标准', spacious: '宽松' });
  set('#collage-summary span', en ? 'BOARD SUMMARY' : '画板总结 / Board Summary'); set('#collage-summary p', en ? 'Click + Collage from Plaza, My Archive or a detail view to add references to your project board.' : '从广场、私人审美库或详情页点击 + Collage，把参考图加入项目风格板。'); set('#collage-export-menu summary', en ? 'Export' : '导出'); set('#clear-collage-btn', en ? 'Clear Board' : '清空画板'); set('#collage-inspector', en ? 'Select an element to edit, duplicate, reorder or remove it.' : '选择一个元素后，可以编辑、复制、调整层级或移除。'); set('#detail-add-gallery', en ? 'Add gallery to Collage' : '将整组图片加入画板'); set('.gallery-note span', en ? 'GALLERY NOTES' : '图册备注 / Gallery Notes'); set('#detail-negative + *', ''); set('#detail-content .prompt-block.is-primary h3', en ? 'Chinese Prompt' : '中文提示词'); set('#detail-content .prompt-block.is-secondary h3', en ? 'English Prompt' : '英文提示词'); set('#detail-content .detail-block:nth-of-type(1) h3', en ? 'Negative Prompt' : '负面提示词'); set('#detail-content .detail-block:nth-of-type(2) h3', en ? 'Cultural Context' : '文化背景'); set('#detail-content .detail-block:nth-of-type(3) h3', en ? 'Design Elements' : '设计要素'); set('#detail-content .detail-block:nth-of-type(4) h3', en ? 'Palette' : '色卡'); set('#detail-content .detail-block:nth-of-type(5) h3', en ? 'Composition' : '构图方式'); set('#detail-content .detail-block:nth-of-type(6) h3', en ? 'Use Cases' : '使用场景'); set('#profile-status', en ? 'Profile is stored in this browser.' : '资料保存在当前浏览器。'); set('#template-status', en ? 'System default has not been edited.' : '未修改系统默认模板。'); set('#setting-template-test-result', en ? 'Save a template, then check whether its Prompt is specific and reusable.' : '保存模板后，可以在这里检查 Prompt 是否具体、可复用。'); set('#setting-template-state', en ? 'System default / Read only' : '系统默认 / Read only');
}

function applyTranslations(lang) {
  const t = i18n[lang] || i18n['zh-CN'];
  text('.hero-copy .eyebrow', t.heroEyebrow);
  text('.hero-copy h1', t.heroTitle);
  text('.hero-lede', t.heroLede);
  const heroButtons = document.querySelectorAll('.hero-copy .button');
  if (heroButtons[0]) heroButtons[0].textContent = t.explorePlaza;
  if (heroButtons[1]) heroButtons[1].textContent = t.buildArchive;
  text('#why .section-heading h2', t.whyTitle);
  text('#why .section-heading p:not(.eyebrow)', t.whyCopy);
  const whyCards = document.querySelectorAll('#why article');
  [[t.whyOneTitle, t.whyOneCopy], [t.whyTwoTitle, t.whyTwoCopy], [t.whyThreeTitle, t.whyThreeCopy]].forEach(([title, copy], index) => {
    if (!whyCards[index]) return;
    whyCards[index].querySelector('h3').textContent = title;
    whyCards[index].querySelector('p').textContent = copy;
  });
  text('#how .section-heading h2', t.howTitle);
  text('#join h2', t.joinTitle);
  text('#join .join-panel > p:not(.eyebrow)', t.joinCopy);
  const joinButtons = document.querySelectorAll('#join .button');
  if (joinButtons[0]) joinButtons[0].textContent = t.openApp;
  if (joinButtons[1]) joinButtons[1].textContent = t.connectProvider;
  renderAuthState();
  text('.sidebar-title strong', t.workspace);
  const nav = {
    plaza: t.plazaNav,
    archive: t.archiveNav,
    saved: t.savedNav,
    collage: t.boardNav,
    provider: lang === 'en' ? 'Models' : '模型',
    reviews: lang === 'en' ? 'Review Queue' : '审核队列',
    settings: lang === 'en' ? 'Settings' : '设置',
    feedback: lang === 'en' ? 'Feedback' : '意见箱'
  };
  document.querySelectorAll('.side-item').forEach(button => {
    const label = nav[button.dataset.tab] || (button.classList.contains('feedback-link') ? nav.feedback : '');
    if (label) {
      const labelNode = button.querySelector('.feedback-title b') || button.querySelector('span');
      if (labelNode) labelNode.textContent = label;
    }
    const subtitle = button.querySelector('small');
    if (subtitle) subtitle.hidden = true;
  });
  text('#review-eyebrow', lang === 'en' ? 'REVIEW QUEUE / MODERATION' : '审核队列 / 内容审核');
  text('#review-title', lang === 'en' ? 'Review public visual cards.' : '审核公开视觉卡片。');
  text('#review-copy', lang === 'en' ? 'Check images, descriptions, cultural context and rights notes before cards enter Public Plaza.' : '检查提交到 Public Plaza 的图片、描述、文化背景和版权提示。');
  text('#review-refresh-btn', lang === 'en' ? 'Refresh queue' : '刷新队列');
  text('#feedback-title', lang === 'en' ? 'Feedback' : '意见箱');
  text('#feedback-copy', lang === 'en' ? 'Tell us what needs improvement or what you would like to see next.' : '告诉我们哪里需要改进，或提交你希望加入的功能。');
  labelContentText('feedback-message-label', lang === 'en' ? 'Message' : '反馈内容');
  placeholder('feedback-message', lang === 'en' ? 'Tell us what happened or what you would improve.' : '请输入你的意见或遇到的问题');
  text('[data-feedback-close]', lang === 'en' ? 'Cancel' : '取消');
  text('#feedback-submit', lang === 'en' ? 'Send feedback' : '提交反馈');
  reorderDetailPrompts();
  text('.plaza-hero h1', t.plazaTitle);
  text('.plaza-hero p:not(.eyebrow)', t.plazaCopy);
  text('.search-line label', t.search);
  text('.filter-bar[aria-label="Category filters"] > span', t.category);
  text('.filter-bar[aria-label="Quick filters"] > span', t.style);
  text('#export-md-btn', t.exportMd);
  text('#export-json-btn', t.exportJson);
  text('#archive-export-menu summary', lang === 'en' ? 'Export' : '导出');
  text('#plaza-clear-btn, #clear-saved-btn, #clear-archive-btn', t.clear);
  text('.archive-form .form-head h3', t.archiveTitle);
  text('.archive-form .form-head p:not(.eyebrow)', t.archiveCopy);
  text('.archive-form .form-head .eyebrow', lang === 'en' ? 'MY ARCHIVE' : '个人审美库 / MY ARCHIVE');
  text('.archive-form .archive-manual-section .archive-section-heading .eyebrow', lang === 'en' ? '02 / REVIEW & ADJUST' : '02 / 检查与调整');
  const formActions = document.querySelectorAll('.form-actions .button');
  if (formActions[0]) formActions[0].textContent = state.editingPrivateId ? (lang === 'en' ? 'Update aesthetic card' : '更新审美卡片') : t.savePrivate;
  if (formActions[1]) formActions[1].textContent = lang === 'en' ? 'New Card' : '新建卡片';
  if (formActions[2]) formActions[2].textContent = state.editingPrivateId ? (lang === 'en' ? 'Cancel edit' : '取消编辑') : t.reset;
  text('.archive-list-panel .saved-toolbar h3', t.privateItems);
  text('[data-panel="saved"] .saved-toolbar h3', t.savedTitle);
  text('#login-title', t.loginTitle);
  text('#login-copy', t.loginCopy);
  const identityLabel = document.getElementById('login-identity-label');
  if (identityLabel?.firstChild) identityLabel.firstChild.textContent = `${t.identityLabel}\n          `;
  text('#login-email-btn', t.continueIdentity);
  text('#login-google-btn', t.continueGoogle);
  text('#logout-btn', t.logout);
  text('#login-note', t.loginNote);
  text('#archive-ai-btn', lang === 'en' ? 'AI Analyze Image' : 'AI 分析图片');
  text('#archive-title + small', lang === 'en' ? 'English title' : 'English title'); text('#archive-title-zh + small', lang === 'en' ? 'Chinese title' : '主要显示');
  text('#archive-category + small', 'Category'); text('#archive-visibility + small', 'Visibility');
  text('#archive-summary + small', 'Summary'); text('#archive-cultural + small', 'Cultural background'); text('#archive-elements + small', 'Design elements');
  text('#archive-palette + small', 'Palette'); text('#archive-tags + small', 'Tags'); text('#archive-composition + small', 'Composition'); text('#archive-use-cases + small', 'Use cases');
  text('#archive-prompt-zh + small', 'Prompt ZH'); text('#archive-prompt-en + small', 'Prompt EN'); text('#archive-negative + small', 'Negative prompt');
  const archiveLabels = { title: ['English title', '英文标题'], titleZh: ['Chinese title', '中文标题'], category: ['Category', '分类'], visibility: ['Visibility', '可见范围'], summary: ['Summary', '风格概述'], cultural: ['Cultural background', '文化背景'], elements: ['Design elements', '设计要素'], palette: ['Palette', '色卡'], tags: ['Tags', '标签'], composition: ['Composition', '构图方式'], useCases: ['Use cases', '使用场景'], promptZh: ['Chinese Prompt', '中文提示词'], promptEn: ['English Prompt', '英文提示词'], negative: ['Negative prompt', '负面提示词'] };
  Object.entries(archiveLabels).forEach(([id, values]) => { const field = document.getElementById(`archive-${id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`); const label = field?.closest('label'); if (label) { const textNode = [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()); if (textNode) textNode.textContent = `${lang === 'en' ? values[0] : values[1]} `; } });
  optionText('#archive-category', lang === 'en' ? { Architecture: 'Architecture', Interior: 'Interior', 'Graphic Design': 'Graphic Design', 'Brand Identity': 'Brand Identity', 'Product Design': 'Product Design', Fashion: 'Fashion', Photography: 'Photography', 'Art Direction': 'Art Direction', Typography: 'Typography', 'Web / UI': 'Web / UI', Landscape: 'Landscape', Furniture: 'Furniture', Packaging: 'Packaging', Other: 'Other' } : { Architecture: 'Architecture', Interior: 'Interior', 'Graphic Design': 'Graphic Design', 'Brand Identity': 'Brand Identity', 'Product Design': 'Product Design', Fashion: 'Fashion', Photography: 'Photography', 'Art Direction': 'Art Direction', Typography: 'Typography', 'Web / UI': 'Web / UI', Landscape: 'Landscape', Furniture: 'Furniture', Packaging: 'Packaging', Other: 'Other' });
  optionText('#archive-visibility', lang === 'en' ? { private: 'Private', public: 'Submit for public review' } : { private: '仅自己可见 · Private', public: '申请公开审核' });
  text('#archive-clear-image-btn', lang === 'en' ? 'Clear Image' : '清除图片');
  text('#archive-auto-title', lang === 'en' ? 'Upload a reference and generate the card with AI' : '先上传参考图，让 AI 生成审美卡片');
  text('.archive-auto-section .archive-section-heading .eyebrow', lang === 'en' ? '01 / UPLOAD & GENERATE' : '01 / 上传与生成');
  text('.archive-manual-section .archive-section-heading .eyebrow', lang === 'en' ? '02 / REVIEW & ADJUST' : '02 / 检查与调整');
  setFilePickerLabels(lang);
  text('.file-field-label', lang === 'en' ? 'Upload reference images' : '上传参考图片');
  text('#archive-file + small', lang === 'en' ? 'Multiple images supported' : '支持多张');
  text('#archive-image-preview span', lang === 'en' ? 'NO IMAGE' : '暂无图片');
  text('#archive-image + small', lang === 'en' ? 'One per line' : '每行一张');
  text('#archive-ai-status', lang === 'en' ? 'Local MVP: images stay in this browser. AI analysis uses a simulated draft until a real Provider is configured.' : '本地 MVP：图片保存在浏览器本地。AI 分析先用模拟生成，真实 Provider 调用已预留。');
  text('.archive-auto-section .archive-section-heading p', lang === 'en' ? 'Upload images and run AI analysis first. The system will draft the title, category, description, palette and prompts.' : '上传图片并点击 AI 分析，系统会先生成标题、分类、描述、色卡和 Prompt。');
  labelContentText('prompt-max-length-label', lang === 'en' ? 'Prompt character limit' : '提示词字数上限');
  text('#archive-manual-title', lang === 'en' ? 'Review, adjust and save the AI result' : '检查 AI 结果，再手动修改和保存');
  text('.archive-manual-section .archive-section-heading p', lang === 'en' ? 'The fields below are filled with the AI draft. Review and edit any result before saving.' : '下面的字段会回填 AI 生成结果，也可以全部手动填写或继续调整。');
  text('#archive-save-status', lang === 'en' ? 'Ready · Upload an image and generate a draft before reviewing the card.' : 'Ready · 上传图片并生成后，可以检查和调整审美卡片。');
  labelText('archive-file', lang === 'en' ? 'Upload reference images' : '上传参考图片'); labelText('archive-image', lang === 'en' ? 'Cover and gallery URLs' : '封面与图册地址'); labelText('archive-provider-select', lang === 'en' ? 'AI provider' : 'AI 服务商'); labelText('archive-template-select', lang === 'en' ? 'Analysis template' : '分析模板'); labelText('archive-model-select', lang === 'en' ? 'Vision model' : '图片模型');
  text('#archive-provider-select + small', 'Provider'); text('#archive-model-select + small', lang === 'en' ? 'Image model' : '图片模型'); text('#archive-template-select + small', lang === 'en' ? 'Prompt template' : 'Prompt 模板'); text('#prompt-max-length-label small', lang === 'en' ? 'Generation limit' : 'AI 生成前的长度限制'); text('#prompt-length-status', lang === 'en' ? 'Chinese and English prompts are shortened to this limit.' : '中文和英文提示词会按此上限自动截短。');
  placeholder('archive-image', lang === 'en' ? 'One image URL per line, or upload local images' : '每行输入一个图片地址，也可以直接上传本地图片'); placeholder('archive-category-other', lang === 'en' ? 'Enter a custom category' : '输入自定义分类'); placeholder('archive-summary', lang === 'en' ? 'Describe the style and where it can be used.' : '一句话说明这个风格适合什么场景。'); placeholder('archive-cultural', lang === 'en' ? 'Cultural context, period, and aesthetic keywords.' : '文化来源、时代语境、审美关键词。'); placeholder('archive-elements', lang === 'en' ? 'Materials, forms, typography, imagery, and spatial language.' : '材质、形态、字体、影像、空间语言。'); placeholder('archive-tags', lang === 'en' ? 'wabi-sabi, stone, restraint' : '侘寂、石材、克制'); placeholder('archive-composition', lang === 'en' ? 'Axial whitespace / modular editorial grid' : '轴线留白 / 模块化编辑网格'); placeholder('archive-use-cases', lang === 'en' ? 'Residential entry, brand moodboard, AI image generation' : '住宅入口、品牌情绪板、AI 图片生成'); placeholder('archive-prompt-zh', lang === 'en' ? 'Chinese image-generation prompt' : '中文生成提示词'); placeholder('archive-prompt-en', lang === 'en' ? 'English image-generation prompt' : 'English prompt'); placeholder('archive-negative', lang === 'en' ? 'Avoid generic decoration, low-quality rendering, and inconsistent material logic.' : '避免泛化装饰、低质量渲染、材料逻辑不一致……');
  text('#archive-export-menu [data-archive-export="png"]', lang === 'en' ? 'PNG image' : 'PNG 图片');
  text('#archive-export-menu [data-archive-export="jpg"]', lang === 'en' ? 'JPG image' : 'JPG 图片');
  text('#archive-export-menu [data-archive-export="pdf"]', lang === 'en' ? 'PDF document' : 'PDF 文档');
  text('#archive-export-menu [data-archive-export="html"]', lang === 'en' ? 'HTML archive' : 'HTML 图文档案');
  text('#archive-export-menu [data-archive-export="md"]', lang === 'en' ? 'Markdown archive' : 'Markdown 文本档案');
  text('#detail-category + h2', state.selectedCase ? primaryTitle(state.selectedCase) : '');
  text('#detail-save', lang === 'en' ? 'Save' : '收藏');
  text('#detail-copy-edit', lang === 'en' ? 'Copy to My Archive' : '复制到个人审美库');
  text('#detail-add-collage', lang === 'en' ? 'Add to Collage' : '加入画板');
  text('#detail-export', lang === 'en' ? 'Export Markdown' : '导出 Markdown');
  text('[data-panel="collage"] .saved-toolbar h3', lang === 'en' ? 'Collage Board' : '拼贴画板');
  text('#collage-summary-btn', lang === 'en' ? 'Generate Summary' : '生成画板总结');
  text('[data-panel="collage"] .feature-status', lang === 'en' ? 'Beta · Coming soon' : '测试中 · 未来待开放');
  text('#collage-summary span', lang === 'en' ? 'BOARD SUMMARY' : '画板总结 / Board Summary');
  text('#collage-summary p', lang === 'en' ? 'Click + Collage from Plaza, My Archive or a detail view to add references to your project board.' : '从广场、私人审美库或详情页点击 + Collage，把参考图加入项目风格板。');
  text('#collage-export-menu summary', lang === 'en' ? 'Export' : '导出');
  text('#clear-collage-btn', lang === 'en' ? 'Clear Board' : '清空画板');
  text('#collage-inspector', lang === 'en' ? 'Select an element to edit, duplicate, reorder or remove it.' : '选择一个元素后，可以编辑、复制、调整层级或移除。');
  text('[data-collage-export="png"]', lang === 'en' ? 'PNG image' : 'PNG 图片');
  text('[data-collage-export="jpg"]', lang === 'en' ? 'JPG image' : 'JPG 图片');
  text('[data-collage-export="pdf"]', lang === 'en' ? 'PDF document' : 'PDF 文档');
  text('[data-collage-export="html"]', lang === 'en' ? 'HTML archive' : 'HTML 图文档案');
  text('[data-collage-export="md"]', lang === 'en' ? 'Markdown archive' : 'Markdown 文本档案');
  text('#settings-export-btn', lang === 'en' ? 'Export backup JSON' : '导出工作区备份');
  const importLabel = document.querySelector('.settings-file-button');
  if (importLabel?.firstChild) importLabel.firstChild.textContent = lang === 'en' ? 'Import backup JSON' : '导入工作区备份';
  text('#settings-clear-btn', lang === 'en' ? 'Clear local workspace' : '清除本地工作区');
  text('.avatar-option-label', lang === 'en' ? 'Default avatar' : '默认头像');
  text('.avatar-upload-group .avatar-option-label', lang === 'en' ? 'Local image' : '本地图片');
  text('#settings-status, #privacy-status', lang === 'en' ? 'Settings are ready.' : '设置已准备就绪。');
  text('.stats-note', lang === 'en' ? 'Personal stats: generation, open, edit, Prompt, board and export actions in this browser. Plaza views, saves and Collage actions by other users are not enabled yet.' : '个人统计：当前浏览器内的生成、打开、编辑、Prompt、画板和导出行为。广场他人查看、收藏和加入画板：当前版本暂未启用。');
  text('#settings-storage-summary', lang === 'en' ? 'Reading local data…' : '正在读取本地数据…');
  text('#settings-folder-btn', lang === 'en' ? 'Choose local export folder' : '选择本地导出文件夹');
  text('#settings-folder-status', lang === 'en' ? 'No folder selected. Exports download to the browser default folder.' : '未选择文件夹，导出将下载到浏览器默认目录。');
  text('.settings-data-section .data-grid > div:first-child p', lang === 'en' ? 'Private cards, saves, Prompt templates, boards, Provider settings and workspace preferences.' : '私人卡片、收藏、Prompt 模板、画板、Provider 配置和工作区偏好。');
  text('.settings-data-section .data-grid > div:nth-child(2) p', lang === 'en' ? 'Provider API keys export as [redacted]; Markdown only references image URLs and never embeds local Base64.' : 'Provider API Key 导出为 [redacted]；Markdown 只引用图片 URL，不嵌入本地 Base64。');
  applyWorkspaceTranslations(lang);
}

function setLanguage(lang, notify = true) {
  document.documentElement.lang = lang;
  localStorage.setItem(STORAGE.language, lang);
  document.querySelectorAll('[data-language-menu]').forEach(menu => {
    menu.classList.remove('is-open');
    const toggle = menu.querySelector('[data-language-toggle]');
    toggle?.setAttribute('aria-expanded', 'false');
    if (toggle) toggle.textContent = lang === 'en' ? 'EN' : '中文';
  });
  document.querySelectorAll('[data-language-option]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.languageOption === lang);
  });
  applyTranslations(lang);
  renderAuthState();
  renderCards();
  renderArchive();
  updateSavedUI();
  renderProviders();
  renderTemplateSettings();
  updateSettingsStats();
  if (notify) toast(lang === 'zh-CN' ? '已切换为中文' : 'Switched to English');
}

function splitList(value) {
  return String(value || '')
    .split(/[,，、\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function setFieldValue(id, value, overwrite = false) {
  const field = document.getElementById(id);
  if (!field) return;
  if (overwrite || !field.value.trim()) field.value = value;
}

let providerCache = [];
let providerSyncState = 'local';

function getProviders() {
  return providerCache;
}

function setProviders(providers) {
  providerCache = Array.isArray(providers) ? providers : [];
  renderProviders();
  renderProviderSelectors();
}

function setProviderStatus(message, state = '') {
  const status = document.getElementById('provider-save-status');
  if (!status) return;
  status.className = `save-status provider-save-status${state ? ` is-${state}` : ''}`;
  status.textContent = message;
}

async function syncProvidersFromServer() {
  try {
    const response = await fetch('/api/providers', { credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${payload.error?.message || `Provider API HTTP ${response.status}`}${payload.requestId ? `（请求 ID：${payload.requestId}）` : ''}`);
    setProviders((payload.data || []).map(provider => ({
      ...provider,
      baseUrl: provider.base_url || '',
      imageCapable: provider.image_capable !== false,
      imageModels: provider.image_models || [],
      textModels: provider.text_models || [],
      defaultImageModel: provider.default_image_model || '',
      defaultTextModel: provider.default_text_model || '',
      imageApi: provider.image_api || 'none',
      imageApiUrl: provider.image_api_url || '',
      isDefault: Boolean(provider.is_default),
      hasSecret: Boolean(provider.hasSecret),
      storage: 'server'
    })));
    providerSyncState = 'server';
    setProviderStatus(isEnglish() ? 'Provider Vault is ready.' : 'Provider Vault 已就绪。', 'success');
    return true;
  } catch (error) {
    providerSyncState = 'local';
    setProviderStatus(`${isEnglish() ? 'Provider Vault unavailable: ' : 'Provider Vault 暂不可用：'}${error.message}`, 'warning');
    return false;
  }
}

function selectedProviderSettings() {
  const providers = getProviders().filter(provider => provider.hasSecret && provider.imageCapable);
  const selectedId = els.archiveProviderSelect?.value || '';
  if (els.archiveProviderSelect && selectedId === '') return null;
  const provider = providers.find(item => item.id === selectedId) || providers.find(item => item.isDefault) || providers[0];
  if (!provider) return null;
  const model = els.archiveModelSelect?.value || provider.defaultImageModel || provider.imageModels?.[0] || provider.textModels?.[0] || '';
  return { ...provider, visionModel: model, textModel: provider.defaultTextModel || provider.textModels?.[0] || '' };
}

function selectedTextProviderSettings() {
  const providers = getProviders().filter(provider => provider.hasSecret && (provider.textModels || []).length);
  const selectedId = els.archiveProviderSelect?.value || '';
  const provider = providers.find(item => item.id === selectedId) || providers.find(item => item.isDefault) || providers[0];
  if (!provider) return null;
  return { ...provider, textModel: provider.defaultTextModel || provider.textModels?.[0] || provider.defaultImageModel || provider.imageModels?.[0] || '' };
}

function providerReady() {
  const settings = selectedProviderSettings();
  return Boolean(settings?.id && settings?.visionModel && providerSyncState === 'server');
}

function providerSystemPrompt() {
  const template = getTemplates().find(item => item.id === els.archiveTemplateSelect?.value) || getDefaultTemplate();
  return `${template.instructions}\n\nYou are an expert design researcher and prompt engineer for an aesthetic knowledge base. Analyze only visible evidence in the reference image. Return ONLY valid JSON with this exact schema: {"category":"Architecture|Interior|Graphic Design|Brand Identity|Product Design|Fashion|Photography|Art Direction|Typography|Web / UI|Landscape|Furniture|Packaging|Other","customCategory":"only when category is Other","title":"specific concise English title naming the visible subject and visual language, never a generic placeholder","titleZh":"准确的中文标题","summary":"specific one-sentence summary","cultural":"中文文化 context; distinguish documented origin from visual inference","elements":"中文可见设计要素，material, light, geometry, typography or imagery","palette":["#hex","#hex","#hex","#hex"],"tags":["5-8 concise English style or material tags"],"composition":"specific composition","useCases":["3-5 concrete use cases"],"promptZh":"中文 AI 图像生成提示词","promptEn":"English AI image generation prompt","negative":"specific negative prompt","reviewNotes":"uncertainties or fields requiring human review"}. Title must describe the actual image, not the filename. Tags must be short searchable nouns or noun phrases, not a sentence. Template focus: ${template.focus}. Never invent provenance. Do not wrap JSON in markdown.`;
}

function extractJSONFromText(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

const ARCHIVE_CATEGORIES = ['Architecture', 'Interior', 'Graphic Design', 'Brand Identity', 'Product Design', 'Fashion', 'Photography', 'Art Direction', 'Typography', 'Web / UI', 'Landscape', 'Furniture', 'Packaging', 'Other'];
function cleanGeneratedTitle(value, fallback = 'Untitled visual reference') {
  const title = String(value || '').replace(/^(AI generated|generated|untitled|aesthetic system)[:：-]?\s*/i, '').replace(/\s+/g, ' ').trim();
  return title.length >= 4 ? title.slice(0, 120) : fallback;
}
function cleanGeneratedTags(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,，、;；|\n]+/);
  return [...new Set(values.map(tag => String(tag).replace(/^#/, '').trim().replace(/\s+/g, ' ')).filter(tag => tag.length >= 2 && tag.length <= 40 && !/[。！？.!?]/.test(tag)))].slice(0, 8);
}
function normalizeCategory(value) {
  const raw = String(value || '').trim();
  return ARCHIVE_CATEGORIES.includes(raw) ? raw : raw.toLowerCase().includes('graphic') ? 'Graphic Design' : raw.toLowerCase().includes('interior') ? 'Interior' : raw.toLowerCase().includes('brand') ? 'Brand Identity' : 'Other';
}
function normalizeProviderDraft(data) {
  if (!data || typeof data !== 'object') return null;
  const category = normalizeCategory(data.category);
  return {
    category,
    customCategory: category === 'Other' ? String(data.customCategory || '').trim().slice(0, 80) : '',
    title: cleanGeneratedTitle(data.title),
    titleZh: cleanGeneratedTitle(data.titleZh || data.title_zh, '未命名视觉参考'),
    summary: data.summary || '',
    cultural: Array.isArray(data.culturalContext) ? data.culturalContext.join(' / ') : (data.cultural_context || data.cultural || data.culturalBackground || data.historicalOrigin || ''),
    elements: Array.isArray(data.visibleFacts) ? data.visibleFacts.join(' / ') : (data.elements || data.designElements || data.designLogic || ''),
    palette: (Array.isArray(data.palette) ? data.palette : String(data.palette || '').split(/[,，、\s]+/)).filter(color => validHex(String(color).trim())).slice(0, 8).join(', '),
    tags: cleanGeneratedTags(data.tags || data.styleTags).join(', '),
    composition: data.composition || '',
    useCases: Array.isArray(data.useCases) ? data.useCases.slice(0, 5).join(', ') : (data.use_cases || data.useCases || ''),
    promptZh: data.promptZh || data.prompt_zh || '',
    promptEn: data.promptEn || data.prompt_en || '',
    negative: data.negative || data.negativePrompt || data.negative_prompt || '',
    reviewNotes: Array.isArray(data.reviewNotes) ? data.reviewNotes.join(' / ') : (data.review_notes || data.reviewNotes || '')
  };
}

async function callTextProvider(prompt, settings) {
  if (!settings?.id || !settings?.textModel || providerSyncState !== 'server') return '';
  const response = await fetch('/api/ai/generate-prompt', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId: settings.id,
      model: settings.textModel,
      card: { summary: prompt, promptZh: '', promptEn: '' },
      language: document.documentElement.lang === 'en' ? 'en' : 'zh-CN'
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError(payload, response.status);
  return payload.data?.summary || payload.data?.promptEn || payload.data?.promptZh || JSON.stringify(payload.data || {});
}

async function callGatewayVision(imageData, settings) {
  if (!settings?.id || !settings?.visionModel || providerSyncState !== 'server') return null;
  const match = String(imageData).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!match) throw new Error('图片格式不受支持，请使用 JPG、PNG 或 WebP');
  const template = getTemplates().find(item => item.id === els.archiveTemplateSelect?.value) || getDefaultTemplate();
  const response = await fetch('/api/ai/analyze-image', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: settings.id, model: settings.visionModel, image: { mimeType: match[1].toLowerCase(), data: match[2] }, templateId: template.id, templateVersion: template.version || 1, projectContext: `使用模板「${template.name}」。分析重点：${template.focus}。生成规则：${template.instructions}` })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError(payload, response.status);
  return normalizeProviderDraft(payload.data);
}

async function analyzeImageWithProvider(imageData, providerSettings) {
  if (!providerSettings?.hasSecret || !(providerSettings.visionModel || providerSettings.textModel)) return null;
  try {
    const draft = await callGatewayVision(imageData, providerSettings);
    if (!draft) throw new Error('Provider returned no parseable JSON');
    return draft;
  } catch (error) {
    console.error('AI Provider analysis failed:', error);
    if (els.archiveAiStatus) els.archiveAiStatus.textContent = `Provider 调用失败：${error.message}`;
    throw error;
  }
}

function compressImageFile(file, maxSize = 960, quality = 0.72) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function formValue(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function promptLimit() {
  const value = Number(els.promptMaxLength?.value || 1000);
  return Math.min(4000, Math.max(80, Number.isFinite(value) ? Math.round(value) : 1000));
}
function limitPrompt(value) {
  const text = String(value || '').trim();
  return [...text].slice(0, promptLimit()).join('');
}
function updatePromptLengthStatus() {
  const limit = promptLimit();
  ['archive-prompt-zh', 'archive-prompt-en', 'archive-negative'].forEach(id => {
    const field = document.getElementById(id);
    if (field && field.value.length > limit) field.value = limitPrompt(field.value);
  });
  if (els.promptLengthStatus) els.promptLengthStatus.textContent = `中文、英文提示词和负面提示词最多 ${limit} 个字符，超出会自动截短。`;
}
function syncCategoryOther() {
  const isOther = els.archiveCategory?.value === 'Other';
  if (els.archiveCategoryOther) {
    els.archiveCategoryOther.hidden = !isOther;
    els.archiveCategoryOther.required = isOther;
  }
}
function selectedCategory() {
  return els.archiveCategory?.value === 'Other' ? (formValue('archive-category-other') || 'Other') : (els.archiveCategory?.value || 'Other');
}

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}


function setGenerationBusy(button, busy, labels = {}) {
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = labels.busy || '生成中…';
    button.disabled = true;
    button.classList.add('is-generating');
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.idleLabel || labels.idle || button.textContent;
    button.disabled = false;
    button.classList.remove('is-generating');
    button.removeAttribute('aria-busy');
  }
}

function providerError(payload, status) {
  const message = payload?.error?.message || `AI Gateway HTTP ${status}`;
  return new Error(`${message}${payload?.requestId ? `（请求 ID：${payload.requestId}）` : ''}`);
}


function generateLocalAestheticDraft(imageData = '', filename = '') {
  const name = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const lower = `${name} ${document.getElementById('archive-category')?.value || ''}`.toLowerCase();
  const isGraphic = lower.includes('poster') || lower.includes('graphic') || lower.includes('brand');
  const isInterior = lower.includes('interior') || lower.includes('room') || lower.includes('hotel');
  const category = isGraphic ? 'Graphic Design' : (isInterior ? 'Interior' : 'Architecture');
  const title = cleanGeneratedTitle(name ? `${name.replace(/\b\w/g, char => char.toUpperCase())} reference` : '', 'Untitled visual reference');
  const titleZh = isGraphic ? 'AI 生成图形审美系统' : (isInterior ? 'AI 生成室内审美系统' : 'AI 生成空间审美系统');
  const palette = isGraphic ? '#111111, #f4f1e8, #d94f2b, #2f5f8f' : '#e8e1d5, #b8aa98, #6f7468, #242521';
  const tags = isGraphic ? 'editorial, contrast, visual system, prompt asset' : 'quiet luxury, material, natural light, restrained composition';
  return {
    category,
    title,
    titleZh,
    summary: 'AI local draft based on the uploaded reference. Use it as a structured starting point, then refine the language before saving or publishing.',
    cultural: isGraphic
      ? '源自现代编辑设计、品牌视觉系统和展览海报语言，强调信息层级、留白、节奏与强识别符号。'
      : '源自当代极简空间、自然材料审美和低饱和环境叙事，强调克制、触感、光线与秩序。',
    elements: isGraphic
      ? '高对比字体层级、模块化网格、留白区、单一主视觉、少量强调色、清晰信息节奏。'
      : '天然石材或木质肌理、低饱和墙面、漫射自然光、简化线条、少量植物或器物点景。',
    palette,
    tags: cleanGeneratedTags(tags).join(', '),
    composition: isGraphic ? 'Modular editorial grid / asymmetric hierarchy' : 'Axial negative space / calm material composition',
    useCases: isGraphic ? 'brand moodboard, poster direction, AI visual system prompt' : 'interior moodboard, residential concept, AI image generation',
    promptZh: isGraphic
      ? '现代编辑设计风格，模块化网格，高对比字体层级，低饱和纸张质感，单一强主视觉，少量强调色，克制但有张力，适合品牌视觉系统与海报方向，清晰信息层级，高级排版。'
      : '当代极简空间审美，天然材质，低饱和暖灰色调，柔和自然光，克制构图，大面积留白，安静高级的空间氛围，真实材质细节，适合室内与建筑概念图。',
    promptEn: isGraphic
      ? 'modern editorial design system, modular grid, high-contrast typographic hierarchy, muted paper texture, one strong key visual, restrained accent color, sophisticated layout, clear information hierarchy, brand moodboard quality'
      : 'contemporary minimalist spatial aesthetic, natural materials, muted warm-gray palette, soft daylight, restrained composition, generous negative space, quiet premium atmosphere, realistic material details, interior and architecture concept image',
    negative: 'avoid generic decoration, cluttered composition, low quality render, inconsistent material logic, over-saturated color, noisy background'
  };
}

async function analyzeArchiveImage() {
  const imageList = getArchiveImageList();
  const imageData = imageList[0];
  if (!imageData) return toast(document.documentElement.lang === 'en' ? 'Upload or enter an image first' : '请先上传图片或填写图片 URL');
  const settings = selectedProviderSettings();
  const useProvider = providerReady();
  setGenerationBusy(els.archiveAiBtn, true, { busy: document.documentElement.lang === 'en' ? 'Analyzing…' : '分析生成中…' });
  if (els.archiveAiStatus) els.archiveAiStatus.textContent = useProvider
    ? `Provider 已配置，正在调用 ${settings.name || settings.type} / ${settings.visionModel} 分析图片...`
    : '未配置 Provider。本地 MVP 使用模拟 AI 生成可编辑草稿。';
  setArchiveStatus(useProvider ? 'Analyzing... 正在调用 AI Provider。' : 'Analyzing... 正在生成本地草稿。', 'saving');
  let providerDraft = null;
  try {
    providerDraft = useProvider ? await analyzeImageWithProvider(imageData, settings) : null;
  } catch (error) {
    if (els.archiveAiStatus) els.archiveAiStatus.textContent = `Provider 调用失败：${error.message}`;
    setArchiveStatus('Provider 调用失败，请根据提示修正模型或接口地址后重试。', 'warning');
    toast(`AI 调用失败：${error.message}`);
    return;
  } finally {
    setGenerationBusy(els.archiveAiBtn, false, { idle: document.documentElement.lang === 'en' ? 'AI Analyze Image' : 'AI 分析图片' });
  }
  const draft = providerDraft || generateLocalAestheticDraft(imageData, els.archiveFile?.files?.[0]?.name || '');
  if (els.archiveAiStatus) els.archiveAiStatus.textContent = providerDraft
    ? 'Provider 分析完成，已生成可编辑审美卡片草稿。'
    : (els.archiveAiStatus.textContent || '已生成本地可编辑草稿。');
  if (imageList.length > 1 && els.archiveAiStatus) els.archiveAiStatus.textContent += ` 已读取 ${imageList.length} 张参考图，当前草稿以第一张为主。`;
  setFieldValue('archive-category', ARCHIVE_CATEGORIES.includes(draft.category) ? draft.category : 'Other', true);
  if (els.archiveCategoryOther) els.archiveCategoryOther.value = draft.customCategory || '';
  syncCategoryOther();
  setFieldValue('archive-title', draft.title);
  setFieldValue('archive-title-zh', draft.titleZh);
  setFieldValue('archive-summary', draft.summary);
  setFieldValue('archive-cultural', draft.cultural);
  setFieldValue('archive-elements', draft.elements);
  setFieldValue('archive-palette', draft.palette);
  setFieldValue('archive-tags', draft.tags);
  setFieldValue('archive-composition', draft.composition);
  setFieldValue('archive-use-cases', draft.useCases);
  setFieldValue('archive-prompt-zh', limitPrompt(draft.promptZh));
  setFieldValue('archive-prompt-en', limitPrompt(draft.promptEn));
  setFieldValue('archive-negative', limitPrompt(draft.negative));
  updatePromptLengthStatus();
  setArchiveStatus(providerDraft ? 'Ready · Provider 已生成草稿，检查后可保存审美卡片。' : 'Ready · 本地草稿已生成，检查后可保存审美卡片。', 'success');
  toast(document.documentElement.lang === 'en' ? 'AI draft generated' : 'AI 草稿已生成');
}

function fillArchiveForm(item) {
  state.editingPrivateId = item?.id || null;
  document.getElementById('archive-title').value = item?.title || '';
  document.getElementById('archive-title-zh').value = item?.titleZh || '';
  const knownCategory = ARCHIVE_CATEGORIES.includes(item?.category) ? item.category : 'Other';
  document.getElementById('archive-category').value = knownCategory;
  document.getElementById('archive-category-other').value = knownCategory === 'Other' ? (item?.customCategory || item?.category || '') : '';
  if (els.promptMaxLength) els.promptMaxLength.value = item?.promptEngineering?.maxLength || 1000;
  syncCategoryOther();
  document.getElementById('archive-visibility').value = item?.visibility || 'private';
  document.getElementById('archive-image').value = item?.image || '';
  updateArchiveImagePreview(item?.image || '');
  document.getElementById('archive-summary').value = item?.summary || '';
  document.getElementById('archive-cultural').value = item?.historicalOrigin || item?.culturalBackground || '';
  document.getElementById('archive-elements').value = item?.designElements || item?.designLogic || '';
  document.getElementById('archive-palette').value = Array.isArray(item?.palette)
    ? item.palette.map(color => typeof color === 'string' ? color : (color.hex || '')).filter(Boolean).join(', ')
    : '';
  document.getElementById('archive-tags').value = cleanGeneratedTags(item?.styleTags || []).join(', ');
  document.getElementById('archive-composition').value = item?.composition || '';
  document.getElementById('archive-use-cases').value = item?.useCases || (item?.scenarioTags || []).join(', ');
  document.getElementById('archive-prompt-zh').value = item?.promptZh || '';
  document.getElementById('archive-prompt-en').value = item?.promptEn || '';
  document.getElementById('archive-negative').value = item?.negativePrompt || '';
  updatePromptLengthStatus();
  if (els.archiveSubmit) els.archiveSubmit.textContent = item?.id ? '更新审美卡片' : '保存审美卡片';
  if (els.archiveReset) els.archiveReset.textContent = item?.id ? 'Cancel edit' : 'Reset';
}

function resetArchiveForm(statusMessage = 'Ready · 填写标题后即可保存审美卡片。') {
  state.editingPrivateId = null;
  ['archive-title','archive-title-zh','archive-image','archive-summary','archive-cultural','archive-elements','archive-palette','archive-tags','archive-composition','archive-use-cases','archive-prompt-zh','archive-prompt-en','archive-negative'].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = '';
  });
  document.getElementById('archive-category').value = 'Architecture';
  document.getElementById('archive-category-other').value = '';
  syncCategoryOther();
  if (els.promptMaxLength) els.promptMaxLength.value = 1000;
  updatePromptLengthStatus();
  if (els.archiveFile) els.archiveFile.value = '';
  updateArchiveImagePreview('');
  if (els.archiveAiStatus) els.archiveAiStatus.textContent = '本地 MVP：图片保存在浏览器本地。AI 分析先用模拟生成，真实 Provider 调用已预留。';
  if (els.archiveSubmit) {
    els.archiveSubmit.disabled = false;
    els.archiveSubmit.textContent = document.documentElement.lang === 'en' ? 'Save aesthetic card' : '保存审美卡片';
  }
  if (els.archiveReset) els.archiveReset.textContent = (i18n[document.documentElement.lang || 'zh-CN'] || i18n['zh-CN']).reset;
  setArchiveStatus(statusMessage, 'ready');
}

function privateCaseFromForm(existingId = null) {
  const now = new Date();
  const title = document.getElementById('archive-title').value.trim();
  if (!title) return null;
  const palette = splitList(document.getElementById('archive-palette').value).slice(0, 6);
  const tags = splitList(document.getElementById('archive-tags').value);
  const images = getArchiveImageList();
  return {
    id: existingId || `private-${now.getTime()}`,
    source: 'private',
    title,
    titleZh: document.getElementById('archive-title-zh').value.trim(),
    category: selectedCategory(),
    visibility: document.getElementById('archive-visibility').value,
    publishStatus: document.getElementById('archive-visibility').value === 'public'
      ? (findCase(existingId)?.publishStatus === 'published' ? 'published' : 'pending')
      : 'private',
    image: images[0] || '',
    gallery: images,
    summary: document.getElementById('archive-summary').value.trim(),
    historicalOrigin: document.getElementById('archive-cultural').value.trim(),
    culturalBackground: document.getElementById('archive-cultural').value.trim(),
    designElements: document.getElementById('archive-elements').value.trim(),
    designLogic: document.getElementById('archive-elements').value.trim(),
    palette,
    styleTags: tags,
    materialTags: [],
    spaceTags: [],
    scenarioTags: splitList(document.getElementById('archive-use-cases').value),
    composition: document.getElementById('archive-composition').value.trim(),
    useCases: document.getElementById('archive-use-cases').value.trim(),
    promptZh: limitPrompt(document.getElementById('archive-prompt-zh').value),
    promptEn: limitPrompt(document.getElementById('archive-prompt-en').value),
    negativePrompt: limitPrompt(document.getElementById('archive-negative').value),
    customCategory: els.archiveCategory?.value === 'Other' ? formValue('archive-category-other') : '',
    promptEngineering: {
      version: 2,
      maxLength: promptLimit(),
      generatedAt: now.toISOString()
    },
    createdAt: existingId ? (findCase(existingId)?.createdAt || now.toISOString()) : now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function cloudCardPayload(item) {
  return {
    source: item.source || 'private', title: item.title, titleZh: item.titleZh, category: item.category,
    visibility: item.visibility, summary: item.summary, culturalBackground: item.culturalBackground || item.historicalOrigin,
    designElements: item.designElements || item.designLogic, palette: item.palette || [], styleTags: item.styleTags || [],
    materialTags: item.materialTags || [], spaceTags: item.spaceTags || [], scenarioTags: item.scenarioTags || [],
    composition: item.composition, useCases: item.useCases, promptZh: item.promptZh, promptEn: item.promptEn,
    negativePrompt: item.negativePrompt
  };
}

function upsertPrivateCase(item) {
  const next = getPrivateCases();
  const index = next.findIndex(entry => entry.id === item.id);
  if (index >= 0) next[index] = item;
  else next.unshift(item);
  const savedOk = saveJSON(STORAGE.privateCases, next);
  if (!savedOk) return false;
  const saved = getSaved();
  if (saved.some(entry => entry.id === item.id)) {
    saveJSON(STORAGE.saved, saved.map(entry => entry.id === item.id ? { ...item, savedAt: entry.savedAt || new Date().toISOString() } : entry));
  }
  const board = getCollageBoard();
  if (board.items.some(entry => entry.refId === item.id)) {
    board.items = board.items.map(entry => entry.refId === item.id ? {
      ...entry,
      title: item.title,
      titleZh: item.titleZh || '',
      category: item.category || 'Style',
      summary: item.summary || '',
      image: item.image || collageImage(item),
      gallery: (item.gallery || []).slice(0, 6),
      palette: item.palette || [],
      styleTags: item.styleTags || [],
      composition: item.composition || inferComposition(item),
      promptZh: item.promptZh || '',
      promptEn: item.promptEn || ''
    } : entry);
    saveCollageBoard(board);
  }
  return true;
}

async function createPrivateCase(event) {
  event.preventDefault();
  const wasEditing = Boolean(state.editingPrivateId);
  const item = privateCaseFromForm(state.editingPrivateId);
  if (!item) {
    setArchiveStatus('请先填写 English Title，或点击 AI Analyze Image 自动生成。', 'warning');
    toast(document.documentElement.lang === 'en' ? 'Please enter an English title' : '请先填写 English Title');
    return;
  }
  const preferences = getPreferences();
  if (item.visibility === 'public' && preferences.publishConfirm) {
    const copy = preferences.copyrightReminder
      ? '提交后卡片会进入审核队列，不会立即显示在广场。请确认你拥有图片使用权，并已人工复核文化背景、色卡和 Prompt。'
      : '提交后卡片会进入审核队列，审核通过后才会显示在广场。确认继续吗？';
    const approved = await openConfirm('提交公开审核', copy, () => Promise.resolve());
    if (!approved) return;
  }
  if (!item.image) setArchiveStatus('Saving... 没有图片也可以保存，但建议上传至少一张参考图。', 'warning');
  else setArchiveStatus('Saving... 正在保存到本地浏览器。', 'saving');
  if (els.archiveSubmit) els.archiveSubmit.disabled = true;
  const savedOk = upsertPrivateCase(item);
  if (els.archiveSubmit) els.archiveSubmit.disabled = false;
  if (!savedOk) return;
  if (cloudState === 'online') {
    try {
      const savedCard = await cloudRequest(state.editingPrivateId ? `/api/cards?id=${encodeURIComponent(state.editingPrivateId)}` : '/api/cards', {
        method: state.editingPrivateId ? 'PATCH' : 'POST', body: JSON.stringify(cloudCardPayload(item))
      });
      const localCard = cloudCardToLocal(savedCard);
      const index = cloudCards.findIndex(card => card.id === localCard.id || card.id === item.id);
      if (index >= 0) cloudCards[index] = localCard; else cloudCards.unshift(localCard);
      item.id = localCard.id;
      await uploadCardImages(localCard.id, item.gallery || []);
      await syncCloudWorkspace();
    } catch (error) {
      toast(`云端保存失败，当前本地草稿仍保留：${error.message}`);
      return;
    }
  }
  recordUsage(wasEditing ? 'cardsEdited' : 'cardsCreated');
  state.editingPrivateId = item.id;
  syncCases();
  renderCards();
  renderArchive(item.id);
  updateSavedUI();
  if (els.archiveSubmit) els.archiveSubmit.textContent = document.documentElement.lang === 'en' ? 'Update aesthetic card' : '更新审美卡片';
  if (els.archiveReset) els.archiveReset.textContent = document.documentElement.lang === 'en' ? 'Cancel edit' : '取消编辑';
  const reviewNote = item.visibility === 'public' && item.publishStatus === 'pending' ? ' 已提交公开审核，审核通过后才会进入广场。' : '';
  setArchiveStatus(wasEditing ? `Saved · 审美卡片已更新，右侧私人审美库已同步。${reviewNote}` : `Saved · 审美卡片已保存，表单内容已保留，可继续编辑或点击 New Card。${reviewNote}`, 'success');
  toast(wasEditing ? (document.documentElement.lang === 'en' ? 'Aesthetic card updated' : '审美卡片已更新') : (document.documentElement.lang === 'en' ? 'Aesthetic card saved' : '审美卡片已保存'));
}

function copyPublicCaseToArchive(item) {
  if (!item) return;
  const copy = {
    ...item,
    id: `private-${item.id}-${Date.now()}`,
    source: 'private',
    visibility: 'private',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!upsertPrivateCase(copy)) return;
  syncCases();
  renderArchive(copy.id);
  updateSavedUI();
  toast(document.documentElement.lang === 'en' ? 'Copied to My Archive' : '已复制到个人审美库');
  switchTab('archive');
  fillArchiveForm(copy);
}

function removeLocalImagesFromArchive() {
  const next = getPrivateCases().map(item => ({
    ...item,
    image: /^data:/i.test(item.image || '') ? '' : item.image,
    gallery: (item.gallery || []).filter(src => !/^data:/i.test(src))
  }));
  if (!saveJSON(STORAGE.privateCases, next)) return;
  syncCases();
  renderCards();
  renderArchive();
  updateSavedUI();
  setArchiveStatus('Done · 已移除私人审美库中的本地图片，文本和 Prompt 已保留。', 'success');
}

function privateCaseMarkdown(item) {
  const image = item.image && !/^data:/i.test(item.image) ? `\n\n![${item.titleZh || item.title}](${asset(item.image)})` : '';
  const imageNote = item.image && /^data:/i.test(item.image) ? '\n\n> 图片保存在浏览器本地，未嵌入 Markdown。请使用 HTML、PDF、PNG 或 JPG 导出保留视觉内容。' : '';
  return `# ${item.titleZh || item.title}\n\n${item.title || ''}${image}${imageNote}\n\n可见范围：${publishLabel(item)}\n\n## 风格概述\n${item.summary || ''}\n\n## 文化背景\n${item.historicalOrigin || item.culturalBackground || ''}\n\n## 设计要素\n${item.designElements || item.designLogic || ''}\n\n## 色卡\n${(item.palette || []).map(color => typeof color === 'string' ? color : color.hex).join(', ')}\n\n## 构图方式\n${item.composition || ''}\n\n## 使用场景\n${item.useCases || (item.scenarioTags || []).join(', ')}\n\n## 中文提示词\n\`\`\`text\n${item.promptZh || ''}\n\`\`\`\n\n## 英文提示词\n\`\`\`text\n${item.promptEn || ''}\n\`\`\`\n\n## 负面提示词\n${item.negativePrompt || ''}`;
}

function normalizeBoard(raw = loadJSON(STORAGE.collage, null)) {
  const fallback = { version: 2, tool: 'select', selectedId: null, items: [], strokes: [], penColor: '#111111', penSize: 3 };
  if (!raw) return fallback;
  if (Array.isArray(raw)) {
    return {
      ...fallback,
      items: raw.map((item, index) => ({
        nodeId: `node-${item.id || Date.now()}-${index}`,
        refId: item.id,
        type: 'image',
        title: item.title || 'Collage image',
        titleZh: item.titleZh || '',
        summary: item.summary || '',
        category: item.category || 'Style',
        image: collageImage(item),
        gallery: item.gallery || [],
        styleTags: item.styleTags || [],
        composition: item.composition || '',
        promptZh: item.promptZh || '',
        promptEn: item.promptEn || '',
        x: 40 + (index % 4) * 170,
        y: 42 + Math.floor(index / 4) * 150,
        w: 150,
        h: 112,
        z: index + 1
      }))
    };
  }
  return { ...fallback, ...raw, items: raw.items || [], strokes: raw.strokes || [] };
}

function getCollageBoard() { return normalizeBoard(); }
function getCollageItems() { return getCollageBoard().items; }
function saveCollageBoard(board, sync = true) {
  const saved = saveJSON(STORAGE.collage, { ...board, version: 2 });
  if (saved && sync) scheduleCloudBoardSync();
  return saved;
}
function pushBoardHistory() {
  state.boardUndo.push(JSON.stringify(getCollageBoard()));
  if (state.boardUndo.length > 40) state.boardUndo.shift();
  state.boardRedo = [];
}
function setCollageBoard(board, trackHistory = true) {
  if (trackHistory) pushBoardHistory();
  if (saveCollageBoard(board)) renderCollage();
}
function undoCollage() {
  if (!state.boardUndo.length) return toast('没有可撤销的画布操作');
  state.boardRedo.push(JSON.stringify(getCollageBoard()));
  const previous = JSON.parse(state.boardUndo.pop());
  saveCollageBoard(previous);
  renderCollage();
}
function redoCollage() {
  if (!state.boardRedo.length) return toast('没有可重做的画布操作');
  state.boardUndo.push(JSON.stringify(getCollageBoard()));
  const next = JSON.parse(state.boardRedo.pop());
  saveCollageBoard(next);
  renderCollage();
}
function clearLastStroke() {
  const board = getCollageBoard();
  if (!board.strokes?.length) return toast('没有可清除的画笔线条');
  board.strokes = board.strokes.slice(0, -1);
  setCollageBoard(board);
  toast('已清除上一笔');
}
function collageImage(item) { return (item.gallery || []).find(Boolean) || item.image || ''; }
function nextBoardZ(board) { return Math.max(0, ...board.items.map(item => item.z || 0)) + 1; }

function addToCollage(item, image = '') {
  if (!item) return;
  const board = getCollageBoard();
  const selectedImage = image || collageImage(item);
  if (!selectedImage) return toast('这张卡片没有可加入画板的图片');
  const duplicate = board.items.some(entry => entry.refId === item.id && entry.image === selectedImage);
  if (duplicate) return toast('这张图片已经在画板中');
  recordUsage('collageItemsAdded');
  const index = board.items.length;
  const node = {
    nodeId: `node-${item.id}-${Date.now()}-${index}`, refId: item.id, type: 'image',
    title: item.title, titleZh: item.titleZh || '', category: item.category || 'Style', summary: item.summary || '',
    image: selectedImage, gallery: (item.gallery || []).slice(0, 6), palette: item.palette || [], styleTags: item.styleTags || [],
    composition: item.composition || inferComposition(item), promptZh: item.promptZh || '', promptEn: item.promptEn || '',
    x: 42 + (index % 4) * 168, y: 44 + Math.floor(index / 4) * 142, w: 156, h: 116, z: nextBoardZ(board), addedAt: new Date().toISOString()
  };
  board.items.push(node); board.selectedId = node.nodeId;
  if (!saveCollageBoard(board)) return;
  renderCollage();
  closeDetail();
  toast('图片已加入画板');
}

function openCollagePicker(item) {
  if (!item) return;
  const images = [...new Set((item.gallery || []).concat(item.image || []).filter(Boolean))];
  if (!images.length) return toast('这张卡片没有可加入画板的图片');
  if (images.length === 1) return addToCollage(item, images[0]);
  if (!els.collagePicker || !els.collagePickerOptions) return addToCollage(item, images[0]);
  els.collagePickerOptions.innerHTML = `<button class="collage-picker-all" type="button" data-collage-all>将全部 ${images.length} 张图片加入画板</button>${images.map((image, index) => `<button type="button" class="collage-picker-option" data-collage-image-index="${index}"><img src="${escapeHTML(asset(image))}" alt="图片 ${index + 1}"><span>加入第 ${index + 1} 张</span></button>`).join('')}`;
  els.collagePicker.hidden = false;
  els.collagePicker.dataset.caseId = item.id;
  els.collagePicker._images = images;
}

function updateBoardNode(nodeId, patch, trackHistory = false) {
  const board = getCollageBoard();
  if (trackHistory) pushBoardHistory();
  board.items = board.items.map(item => item.nodeId === nodeId ? { ...item, ...patch } : item);
  saveCollageBoard(board);
}

function selectBoardNode(nodeId) {
  const board = getCollageBoard();
  board.selectedId = nodeId;
  saveCollageBoard(board);
  renderCollage();
}

function clearBoardSelection() {
  const board = getCollageBoard();
  board.selectedId = null;
  saveCollageBoard(board);
  renderCollage();
}

function removeFromCollage(id) {
  const board = getCollageBoard();
  board.items = board.items.filter(item => item.nodeId !== id && item.refId !== id);
  if (board.selectedId === id) board.selectedId = null;
  setCollageBoard(board);
  toast(isEnglish() ? 'Removed from Collage Board' : '已从 Collage Board 移除');
}

function clearCollage() {
  const board = getCollageBoard();
  if (!board.items.length && !board.strokes.length) return toast(ui('boardEmpty'));
  setCollageBoard({ version: 2, tool: 'select', selectedId: null, items: [], strokes: [] });
  toast('已清空 Collage Board');
}

function addBoardText(type = 'text') {
  const board = getCollageBoard();
  const node = {
    nodeId: `node-${type}-${Date.now()}`,
    type,
    title: type === 'sticky' ? 'Sticky note' : 'Text note',
    text: type === 'sticky' ? '写下创意备注' : 'Double click to edit',
    x: 90,
    y: 90,
    w: type === 'sticky' ? 160 : 180,
    h: type === 'sticky' ? 120 : 70,
    z: nextBoardZ(board),
    background: type === 'sticky' ? '#fff4bd' : 'transparent',
    color: '#222222',
    fontWeight: type === 'sticky' ? '700' : '500'
  };
  board.items.push(node);
  board.selectedId = node.nodeId;
  board.tool = 'select';
  setCollageBoard(board);
}

function setCollageTool(tool) {
  if (tool === 'text' || tool === 'sticky') return addBoardText(tool);
  const board = getCollageBoard();
  board.tool = tool;
  if (tool === 'pen') board.selectedId = null;
  saveCollageBoard(board);
  renderCollage();
}

function updateToolRail(tool) {
  document.querySelectorAll('[data-collage-tool]').forEach(button => button.classList.toggle('is-active', button.dataset.collageTool === tool));
}

function duplicateBoardNode(nodeId) {
  const board = getCollageBoard();
  const item = board.items.find(node => node.nodeId === nodeId);
  if (!item) return;
  const copy = { ...item, nodeId: `node-copy-${Date.now()}`, x: item.x + 24, y: item.y + 24, z: nextBoardZ(board) };
  board.items.push(copy);
  board.selectedId = copy.nodeId;
  setCollageBoard(board);
}

function bringBoardNodeForward(nodeId) {
  const board = getCollageBoard();
  board.items = board.items.map(item => item.nodeId === nodeId ? { ...item, z: nextBoardZ(board) } : item);
  setCollageBoard(board);
}

function sendBoardNodeBack(nodeId) {
  const board = getCollageBoard();
  board.items = board.items.map(item => item.nodeId === nodeId ? { ...item, z: 1 } : item);
  setCollageBoard(board);
}

function imageInspectorHTML(item) {
  const en = document.documentElement.lang === 'en';
  const palette = (item.palette || []).map(color => `<span class="detail-color" style="background:${escapeHTML(color)}">${escapeHTML(color)}</span>`).join('');
  return `<div class="inspector-controls">
    <label>${en ? 'Image URL' : '图片地址'}<input type="url" value="${escapeHTML(collageImage(item))}" data-image-replace="${escapeHTML(item.nodeId)}" placeholder="${en ? 'Paste replacement image URL' : '粘贴替换图片地址'}"></label>
    <div class="inspector-actions"><button class="icon-action" type="button" data-image-remove-bg="${escapeHTML(item.nodeId)}">${en ? 'Remove background' : '去除背景'}</button><button class="icon-action" type="button" data-image-palette="${escapeHTML(item.nodeId)}">${en ? 'Extract palette' : '提取色板'}</button></div>
    ${palette ? `<div class="detail-palette">${palette}</div>` : ''}
    <p>${en ? 'Remove background requires remove.bg, Clipdrop or a custom endpoint in Provider settings.' : '去除背景需要在 Provider 中配置 remove.bg、Clipdrop 或自定义接口。'}</p>
  </div>`;
}

function textInspectorHTML(item) {
  if (!['text', 'sticky'].includes(item.type)) return '';
  const en = document.documentElement.lang === 'en'; const colors = item.type === 'sticky' ? ['#fff4bd', '#ffd8a8', '#dff5c8', '#cfe8ff', '#f2d5ff', '#ffffff'] : ['#222222', '#9b2f25', '#2f5f8f', '#111111', '#6f7468', '#ffffff'];
  return `<div class="inspector-controls">
    ${item.type === 'sticky' ? `<label>${en ? 'Sticky color' : '便签颜色'}<input type="color" value="${escapeHTML(item.background || '#fff4bd')}" data-board-style="background" data-board-style-id="${escapeHTML(item.nodeId)}"><div class="swatch-row">${colors.map(color => `<button class="swatch-button" type="button" style="background:${color}" data-board-style="background" data-board-style-value="${color}" data-board-style-id="${escapeHTML(item.nodeId)}"></button>`).join('')}</div></label>` : ''}
    <label>${en ? 'Text color' : '文字颜色'}<input type="color" value="${escapeHTML(item.color || '#222222')}" data-board-style="color" data-board-style-id="${escapeHTML(item.nodeId)}"></label>
    <label>${en ? 'Weight' : '字重'}<select data-board-style="fontWeight" data-board-style-id="${escapeHTML(item.nodeId)}"><option value="400" ${item.fontWeight === '400' ? 'selected' : ''}>${en ? 'Regular' : '常规'}</option><option value="500" ${(!item.fontWeight || item.fontWeight === '500') ? 'selected' : ''}>${en ? 'Medium' : '中等'}</option><option value="700" ${item.fontWeight === '700' ? 'selected' : ''}>${en ? 'Bold' : '粗体'}</option><option value="800" ${item.fontWeight === '800' ? 'selected' : ''}>${en ? 'Heavy' : '特粗'}</option></select></label>
  </div>`;
}

function penInspectorHTML(board) {
  const en = document.documentElement.lang === 'en';
  return `<strong>${en ? 'Pen settings' : '画笔设置'}</strong><p>${en ? 'Select Pen to annotate an image or the canvas.' : '选择画笔后可在图片或画布上标注。'}</p><div class="inspector-controls">
    <label>${en ? 'Pen color' : '画笔颜色'}<input type="color" value="${escapeHTML(board.penColor || '#111111')}" data-pen-style="color"></label>
    <label>${en ? 'Pen size' : '画笔大小'}<input type="range" min="1" max="14" value="${Number(board.penSize) || 3}" data-pen-style="size"></label>
  </div>`;
}

function updateBoardStyle(nodeId, prop, value) {
  updateBoardNode(nodeId, { [prop]: value }, true);
  renderCollage();
}

function updatePenStyle(prop, value) {
  const board = getCollageBoard();
  if (prop === 'color') board.penColor = value;
  if (prop === 'size') board.penSize = Number(value) || 3;
  saveCollageBoard(board);
  renderCollage();
}

function replaceBoardImage(nodeId, imageUrl) {
  if (!imageUrl.trim()) return;
  updateBoardNode(nodeId, { image: imageUrl.trim(), gallery: [imageUrl.trim()] }, true);
  renderCollage();
}

function imageProcessingProvider() {
  return getProviders().find(provider => provider.hasSecret && provider.imageApi && provider.imageApi !== 'none');
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function removeBackgroundFromNode(nodeId) {
  const board = getCollageBoard();
  const node = board.items.find(item => item.nodeId === nodeId && item.type === 'image');
  if (!node) return;
  if (!imageProcessingProvider()) return toast('请先在 AI Provider 中配置图片处理 API');
  toast('Remove Background 的服务端 Gateway 尚未接入，当前不会从浏览器直连第三方 API。');
}

function extractPaletteFromNode(nodeId) {
  const board = getCollageBoard();
  const node = board.items.find(item => item.nodeId === nodeId && item.type === 'image');
  if (!node) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 24;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 16) {
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const key = `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const palette = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color);
    updateBoardNode(nodeId, { palette }, true);
    toast(`Palette: ${palette.join(', ')}`);
  };
  img.onerror = () => toast('无法提取色板：图片可能存在跨域限制');
  img.src = asset(collageImage(node));
}

function collageSummaryText(items = getCollageItems()) {
  const imageItems = items.filter(item => item.type === 'image');
  if (!items.length) return isEnglish() ? 'Click + Collage from Plaza, My Archive or a detail view to add references to your project board.' : '从广场、私人审美库或详情页点击 + Collage，把参考图加入项目风格板。';
  const tags = [...new Set(imageItems.flatMap(item => item.styleTags || []))].slice(0, 8).join(', ') || 'mixed aesthetic references';
  const notes = items.filter(item => item.type !== 'image').map(item => item.text).filter(Boolean).slice(0, 4).join(' / ');
  const categories = [...new Set(imageItems.map(item => item.category).filter(Boolean))].join(' / ');
  return `当前自由画布包含 ${items.length} 个元素，其中 ${imageItems.length} 个图片参考，覆盖 ${categories || 'multiple'}。主要风格标签：${tags}。备注线索：${notes || '暂无'}。`;
}

function boardSummaryPrompt(board = getCollageBoard()) {
  return `You are a senior creative director. Summarize this moodboard/collage into reusable design production material. Return concise bilingual sections: 1) Creative Direction, 2) Visual System, 3) Palette / Material, 4) Composition, 5) Prompt EN, 6) Prompt ZH. Board JSON:\n${JSON.stringify({ items: board.items, strokes: board.strokes?.length || 0 }, null, 2)}`;
}

async function generateBoardAISummary() {
  const board = getCollageBoard();
  setGenerationBusy(document.getElementById('collage-summary-btn'), true, { busy: document.documentElement.lang === 'en' ? 'Generating…' : '生成中…' });
  if (!board.items.length && !board.strokes.length) return toast(ui('boardEmpty'));
  if (els.collageSummary) els.collageSummary.innerHTML = document.documentElement.lang === 'en' ? '<span>BOARD AI SUMMARY</span><p>Generating board summary...</p>' : '<span>Board AI Summary</span><p>正在生成画板总结...</p>';
  const settings = selectedTextProviderSettings();
  try {
    let aiText = '';
    const cardIds = board.items.map(item => item.refId || item.id).filter(Boolean);
    if (settings && cardIds.length) {
      const response = await fetch('/api/ai/board-summary', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: settings.id, model: settings.textModel, cardIds, boardTitle: 'Collage Board', boardContext: boardSummaryPrompt(board) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw providerError(payload, response.status);
      aiText = payload.data?.summary || '';
    }
    const summary = aiText || collageSummaryText(board.items);
    board.summary = summary;
    board.summaryUpdatedAt = new Date().toISOString();
    saveCollageBoard(board);
    if (els.collageSummary) els.collageSummary.innerHTML = `<span>${aiText ? 'Board AI Summary' : 'Board Summary'}</span><p>${escapeHTML(summary)}</p>`;
    toast(aiText ? (isEnglish() ? 'Board AI Summary generated' : 'Board AI Summary 已生成') : (isEnglish() ? 'Local board summary generated' : '已生成本地画板总结'));
  } catch (error) {
    console.error('Board summary failed:', error);
    if (els.collageSummary) els.collageSummary.innerHTML = `<span>${isEnglish() ? 'BOARD AI SUMMARY FAILED' : '画板 AI 总结失败'}</span><p>${isEnglish() ? 'Provider request failed: ' : 'Provider 调用失败：'}${escapeHTML(error.message)}</p>`;
    toast(`Provider 调用失败：${error.message}`);
  } finally {
    setGenerationBusy(document.getElementById('collage-summary-btn'), false, { idle: document.documentElement.lang === 'en' ? 'Generate Summary' : '生成画板总结' });
  }
}

function renderCollage() {
  if (!els.collageCanvas || !els.collageList) return;
  const board = getCollageBoard();
  const items = board.items;
  const en = document.documentElement.lang === 'en';
  if (els.collageSummary) els.collageSummary.innerHTML = `<span>${board.summary ? (en ? 'BOARD AI SUMMARY' : 'Board AI Summary') : (en ? 'BOARD SUMMARY' : 'Board Summary')}</span><p>${escapeHTML(board.summary || (items.length ? collageSummaryText(items) : (en ? 'Click + Collage from Plaza, My Archive or a detail view to add references to your project board.' : '从广场、私人审美库或详情页点击 + Collage，把参考图加入项目风格板。')))}</p>`;
  els.collageCanvas.classList.toggle('is-pen', board.tool === 'pen');
  updateToolRail(board.tool || 'select');
  const width = Math.max(1, Math.round(els.collageCanvas.clientWidth));
  const height = Math.max(1, Math.round(els.collageCanvas.clientHeight));
  els.collageCanvas.innerHTML = `${!items.length && !board.strokes.length ? `<div class="collage-empty">${en ? 'The canvas is empty. Click + Collage to add an image, or use Text / Sticky / Pen to start.' : '自由画布为空。点击 + Collage 添加图片，或使用 Text / Sticky / Pen 开始创作。'}</div>` : ''}
    <svg class="board-stroke" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${(board.strokes || []).map(stroke => {
      const points = Array.isArray(stroke) ? stroke : (stroke.points || []);
      const color = Array.isArray(stroke) ? '#111111' : (stroke.color || '#111111');
      const size = Array.isArray(stroke) ? 3 : (stroke.size || 3);
      return `<path d="${points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')}" stroke="${escapeHTML(color)}" stroke-width="${Number(size) || 3}"></path>`;
    }).join('')}</svg>
    ${items.map(item => {
      const selected = item.nodeId === board.selectedId ? ' is-selected' : '';
      const style = `left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;z-index:${item.z || 1}`;
      if (item.type === 'image') return `<div class="board-node${selected}" data-board-node="${escapeHTML(item.nodeId)}" style="${style}"><img src="${asset(collageImage(item))}" alt="${escapeHTML(item.title)}"><span class="board-node-label">${escapeHTML(item.titleZh || item.title)}</span><i class="board-resize" data-board-resize="${escapeHTML(item.nodeId)}"></i></div>`;
      const textStyle = `${style};background:${item.type === 'text' ? 'transparent' : (item.background || '#fff4bd')};color:${item.color || '#222222'};font-weight:${item.fontWeight || '500'}`;
      return `<div class="board-node board-node-${item.type}${selected}" data-board-node="${escapeHTML(item.nodeId)}" style="${textStyle}" contenteditable="true" spellcheck="false"><b class="board-drag-handle" contenteditable="false" data-board-drag="${escapeHTML(item.nodeId)}">✥</b>${escapeHTML(item.text || item.title || 'Note')}<i class="board-resize" contenteditable="false" data-board-resize="${escapeHTML(item.nodeId)}"></i></div>`;
    }).join('')}`;
  const selected = items.find(item => item.nodeId === board.selectedId);
  document.getElementById('collage-inspector').innerHTML = selected
    ? `<strong>${escapeHTML(selected.title || selected.type)}</strong><p>${Math.round(selected.w)} × ${Math.round(selected.h)} · x ${Math.round(selected.x)}, y ${Math.round(selected.y)}</p><div class="inspector-actions"><button class="icon-action" type="button" data-board-duplicate="${escapeHTML(selected.nodeId)}">${en ? 'Duplicate' : '复制'}</button><button class="icon-action" type="button" data-board-front="${escapeHTML(selected.nodeId)}">${en ? 'Bring front' : '置于顶层'}</button><button class="icon-action" type="button" data-board-back="${escapeHTML(selected.nodeId)}">${en ? 'Send back' : '置于底层'}</button><button class="icon-action" type="button" data-collage-remove="${escapeHTML(selected.nodeId)}">${en ? 'Remove' : '移除'}</button></div>${selected.type === 'image' ? imageInspectorHTML(selected) : textInspectorHTML(selected)}`
    : penInspectorHTML(board);
  els.collageList.innerHTML = items.map(item => `<article class="collage-item"><div><h4>${escapeHTML(item.title || item.type)}</h4><p>${escapeHTML(item.summary || item.text || item.composition || (en ? 'Board element' : '画板元素'))}</p></div><button class="icon-action" type="button" data-board-select="${escapeHTML(item.nodeId)}">${en ? 'Select' : '选择'}</button></article>`).join('');
}

function exportCollage() {
  const board = getCollageBoard();
  if (!board.items.length && !board.strokes.length) return toast('Collage Board 为空');
  const content = `# Aesthetic Archive · Collage Board\n\n## Summary\n${collageSummaryText(board.items)}\n\n## Elements\n${board.items.map(item => `- ${item.type}: ${item.title || item.text || item.nodeId} (${Math.round(item.x)}, ${Math.round(item.y)}, ${Math.round(item.w)}x${Math.round(item.h)})`).join('\n')}\n\n## JSON\n\`\`\`json\n${JSON.stringify(board, null, 2)}\n\`\`\``;
  download('aesthetic-archive-collage-board.md', content, 'text/markdown');
}

function exportCollageDocument(format) {
  recordUsage('exports');
  const board = getCollageBoard();
  if (!board.items.length && !board.strokes.length) return toast('画板为空');
  if (format === 'md') return exportCollage();
  const imageItems = board.items.filter(item => item.type === 'image');
  const items = imageItems.length ? imageItems : [{ titleZh: '画板总结', title: 'Collage Board', summary: board.summary || collageSummaryText(board.items), palette: [] }];
  if (format === 'html' || format === 'pdf') {
    const html = archiveDocumentHTML(items);
    if (format === 'html') return download('aesthetic-archive-collage-board.html', html, 'text/html');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return toast('浏览器阻止了 PDF 打印窗口，请允许弹出窗口后重试');
    printWindow.document.write(html.replace('</body>', '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))<\/script></body>'));
    printWindow.document.close();
    return;
  }
  exportArchiveImage(format, items);
}

function archiveDocumentHTML(items = getPrivateCases()) {
  const cards = items.map(item => {
    const colors = (item.palette || []).slice(0, 6).map(color => `<i style="background:${escapeHTML(typeof color === 'string' ? color : color.hex)}"></i>`).join('');
    const image = item.image ? `<img src="${escapeHTML(asset(item.image))}" alt="${escapeHTML(item.titleZh || item.title)}">` : '<div class="no-image">暂无图片</div>';
    return `<article>${image}<div class="content"><small>${escapeHTML(item.category || '私人卡片')} · ${escapeHTML(publishLabel(item))}</small><h2>${escapeHTML(item.titleZh || item.title)}</h2><h3>${escapeHTML(item.title || '')}</h3><p>${escapeHTML(item.summary || '')}</p><div class="palette">${colors}</div><dl><dt>文化背景</dt><dd>${escapeHTML(item.historicalOrigin || item.culturalBackground || '')}</dd><dt>设计要素</dt><dd>${escapeHTML(item.designElements || item.designLogic || '')}</dd><dt>构图方式</dt><dd>${escapeHTML(item.composition || '')}</dd><dt>使用场景</dt><dd>${escapeHTML(item.useCases || '')}</dd><dt>中文提示词</dt><dd>${escapeHTML(item.promptZh || '')}</dd><dt>英文提示词</dt><dd>${escapeHTML(item.promptEn || '')}</dd></dl></div></article>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aesthetic Archive · 私人审美库</title><style>*{box-sizing:border-box}body{margin:0;padding:40px;color:#171717;background:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}header{display:flex;justify-content:space-between;align-items:end;padding-bottom:18px;border-bottom:1px solid #ddd}h1{margin:0;font-size:28px}header p{margin:0;color:#777;font-size:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:24px}article{break-inside:avoid;border:1px solid #ddd;border-radius:8px;overflow:hidden}article>img,.no-image{width:100%;aspect-ratio:16/9;object-fit:cover;background:#f2f2f2}.no-image{display:grid;place-items:center;color:#999}.content{padding:18px}.content>small{color:#777;font-size:10px}.content h2{margin:8px 0 2px;font-size:21px}.content h3{margin:0;color:#777;font-size:12px;font-weight:500}.content>p{color:#555;font-size:12px;line-height:1.6}.palette{display:flex;gap:4px;margin:12px 0}.palette i{width:30px;height:9px;border:1px solid #ddd}dl{margin:0}dt{margin-top:12px;font-size:10px;font-weight:700}dd{margin:4px 0 0;color:#555;font-size:11px;line-height:1.55;white-space:pre-wrap}@media print{body{padding:18px}.grid{gap:10px}article{border-radius:0}}@media(max-width:700px){body{padding:18px}.grid{grid-template-columns:1fr}}</style></head><body><header><div><h1>私人审美库</h1><p>Aesthetic Archive · ${new Date().toLocaleDateString('zh-CN')}</p></div><p>${items.length} 张卡片</p></header><main class="grid">${cards}</main></body></html>`;
}

function exportArchiveDocument(format) {
  recordUsage('exports');
  const privateCases = getPrivateCases();
  if (!privateCases.length) return toast('私人审美库为空');
  if (format === 'md') return download('aesthetic-archive-private-cases.md', privateCases.map(privateCaseMarkdown).join('\n\n---\n\n'), 'text/markdown');
  const html = archiveDocumentHTML(privateCases);
  if (format === 'html') return download('aesthetic-archive-private-cases.html', html, 'text/html');
  if (format === 'pdf') {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return toast('浏览器阻止了 PDF 打印窗口，请允许弹出窗口后重试');
    printWindow.document.write(html.replace('</body>', '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))<\/script></body>'));
    printWindow.document.close();
    return;
  }
  exportArchiveImage(format, privateCases);
}

async function loadExportImage(src) {
  if (!src) return null;
  return new Promise(resolve => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = asset(src); });
}

async function exportArchiveImage(format, items) {
  const width = 1800, gap = 28, padding = 56, columns = 2, cardWidth = (width - padding * 2 - gap) / columns, cardHeight = 620;
  const rows = Math.ceil(items.length / columns), height = padding * 2 + 100 + rows * cardHeight + Math.max(0, rows - 1) * gap;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#171717'; ctx.font = '700 38px Arial'; ctx.fillText('私人审美库', padding, 56); ctx.fillStyle = '#777'; ctx.font = '18px Arial'; ctx.fillText(`Aesthetic Archive · ${items.length} 张卡片`, padding, 88);
  for (let index = 0; index < items.length; index++) {
    const item = items[index], x = padding + (index % columns) * (cardWidth + gap), y = padding + 100 + Math.floor(index / columns) * (cardHeight + gap);
    ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2; ctx.strokeRect(x, y, cardWidth, cardHeight); ctx.fillStyle = '#f3f3f3'; ctx.fillRect(x + 1, y + 1, cardWidth - 2, 330);
    const image = await loadExportImage(item.image); if (image) { const scale = Math.max(cardWidth / image.width, 330 / image.height), sw = cardWidth / scale, sh = 330 / scale; ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, cardWidth, 330); }
    ctx.fillStyle = '#777'; ctx.font = '16px Arial'; ctx.fillText(`${item.category || '私人卡片'} · ${publishLabel(item)}`, x + 22, y + 365);
    ctx.fillStyle = '#171717'; ctx.font = '700 27px Arial'; ctx.fillText((item.titleZh || item.title || '未命名').slice(0, 28), x + 22, y + 404);
    ctx.fillStyle = '#777'; ctx.font = '17px Arial'; ctx.fillText((item.title || '').slice(0, 44), x + 22, y + 432);
    ctx.fillStyle = '#444'; ctx.font = '18px Arial'; const summary = (item.summary || '').slice(0, 72); ctx.fillText(summary.slice(0, 36), x + 22, y + 475); ctx.fillText(summary.slice(36), x + 22, y + 503);
    (item.palette || []).slice(0, 6).forEach((color, colorIndex) => { ctx.fillStyle = typeof color === 'string' ? color : color.hex; ctx.fillRect(x + 22 + colorIndex * 48, y + 540, 40, 13); });
    const score = item.promptEngineering?.review?.score; if (score != null) { ctx.fillStyle = '#777'; ctx.font = '15px Arial'; ctx.fillText(`提示词质量 ${score}/100`, x + 22, y + 588); }
  }
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'; const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, format === 'jpg' ? .92 : undefined)); if (!blob) return toast('图片导出失败');
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `aesthetic-archive-private-cases.${format}`; link.click(); URL.revokeObjectURL(url); toast(`${format.toUpperCase()} 已导出`);
}

function clearArchive() {
  if (!getPrivateCases().length) return toast('私人审美库为空');
  if (!saveJSON(STORAGE.privateCases, [])) return;
  setSaved(getSaved().filter(item => item.source !== 'private'));
  if (state.selectedCase?.source === 'private') closeDetail();
  syncCases();
  renderCards();
  renderArchive();
  updateSavedUI();
  setArchiveStatus('Ready · 私人审美库已清空，可以创建新的审美卡片。', 'ready');
  toast('已清空私人审美库');
}

function canvasPoint(event) {
  const rect = els.collageCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function bindBoardDrag(event) {
  const resize = event.target.closest('[data-board-resize]');
  const node = event.target.closest('[data-board-node]');
  if (!node || !els.collageCanvas) return;
  const handle = event.target.closest('[data-board-drag]');
  if (node.isContentEditable && !resize && !handle) return;
  event.preventDefault();
  const nodeId = node.dataset.boardNode || resize?.dataset.boardResize || handle?.dataset.boardDrag;
  const board = getCollageBoard();
  const item = board.items.find(entry => entry.nodeId === nodeId);
  if (!item) return;
  board.selectedId = nodeId;
  saveCollageBoard(board);
  const start = canvasPoint(event);
  const origin = { x: item.x, y: item.y, w: item.w, h: item.h };
  const mode = resize ? 'resize' : 'move';
  let latest = { ...origin };
  function move(pointerEvent) {
    const point = canvasPoint(pointerEvent);
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    latest = mode === 'resize'
      ? { ...origin, w: Math.max(60, origin.w + dx), h: Math.max(44, origin.h + dy) }
      : { ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) };
    node.style.left = `${latest.x}px`;
    node.style.top = `${latest.y}px`;
    node.style.width = `${latest.w}px`;
    node.style.height = `${latest.h}px`;
  }
  pushBoardHistory();
  function up() {
    updateBoardNode(nodeId, latest);
    renderCollage();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

function bindBoardPen(event) {
  const board = getCollageBoard();
  if (board.tool !== 'pen') return false;
  event.preventDefault();
  const points = [canvasPoint(event)];
  const strokeStyle = { color: board.penColor || '#111111', size: Number(board.penSize) || 3 };
  function move(pointerEvent) { points.push(canvasPoint(pointerEvent)); renderLiveStroke(points, strokeStyle); }
  function up() {
    const next = getCollageBoard();
    pushBoardHistory();
    next.strokes = [...(next.strokes || []), { points, ...strokeStyle }];
    saveCollageBoard(next);
    renderCollage();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  return true;
}

function renderLiveStroke(points, strokeStyle = {}) {
  const svg = els.collageCanvas?.querySelector('.board-stroke');
  if (!svg) return;
  const savedCount = getCollageBoard().strokes?.length || 0;
  const existing = [...svg.querySelectorAll('path')].slice(0, savedCount).map(path => path.outerHTML).join('');
  const d = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  svg.innerHTML = `${existing}<path d="${d}" stroke="${escapeHTML(strokeStyle.color || '#111111')}" stroke-width="${Number(strokeStyle.size) || 3}"></path>`;
}

function saveTextNode(event) {
  const node = event.target.closest('[data-board-node]');
  if (!node || !node.isContentEditable) return;
  const clone = node.cloneNode(true);
  clone.querySelector('.board-resize')?.remove();
  clone.querySelector('.board-drag-handle')?.remove();
  updateBoardNode(node.dataset.boardNode, { text: clone.textContent.trim() }, true);
}

function providerFormData(existingId = '') {
  const imageModels = splitList(document.getElementById('provider-image-models').value);
  const textModels = splitList(document.getElementById('provider-text-models').value);
  const now = new Date().toISOString();
  return {
    id: existingId || `provider-${Date.now()}`,
    name: document.getElementById('provider-name').value.trim() || document.getElementById('provider-type').value,
    type: document.getElementById('provider-type').value,
    secret: document.getElementById('provider-key').value.trim(),
    baseUrl: document.getElementById('provider-base-url').value.trim(),
    imageCapable: document.getElementById('provider-image-capable').checked,
    imageModels,
    textModels,
    imageApi: document.getElementById('provider-image-api').value,
    imageApiUrl: document.getElementById('provider-image-api-url').value.trim(),
    defaultImageModel: imageModels[0] || '',
    defaultTextModel: textModels[0] || '',
    isDefault: !getProviders().length,
    createdAt: now,
    updatedAt: now,
    storage: 'server'
  };
}

async function saveProvider(event) {
  event.preventDefault();
  const editingId = els.providerForm.dataset.editingProvider || '';
  const nextProvider = providerFormData(editingId);
  if (!editingId && !nextProvider.secret) { setProviderStatus('请填写 API Key。', 'warning'); return toast('请填写 API Key'); }
  if (nextProvider.imageCapable && !nextProvider.imageModels.length) { setProviderStatus('请至少填写一个支持图片分析的模型。', 'warning'); return toast('请至少填写一个 image-capable 模型'); }
  if (!nextProvider.imageModels.length && !nextProvider.textModels.length) { setProviderStatus('请至少填写一个模型。', 'warning'); return toast('请至少填写一个模型'); }
  if (providerSyncState !== 'server') { setProviderStatus('请确认已登录，然后刷新页面以连接 Provider Vault。', 'warning'); return toast('Provider Vault 尚未连接'); }
  const payload = { ...nextProvider, secret: nextProvider.secret || undefined };
  delete payload.id;
  delete payload.createdAt;
  delete payload.updatedAt;
  delete payload.storage;
  try {
    setProviderStatus(editingId ? '正在更新 Provider…' : '正在加密并保存 Provider…');
    const submitButton = els.providerForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const response = await fetch(editingId ? `/api/providers?id=${encodeURIComponent(editingId)}` : '/api/providers', {
      method: editingId ? 'PATCH' : 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${result.error?.message || `Provider API HTTP ${response.status}`}${result.requestId ? `（请求 ID：${result.requestId}）` : ''}`);
    await syncProvidersFromServer();
    resetProviderForm();
    setProviderStatus(editingId ? 'Provider 已更新并安全保存。' : 'Provider 已加密保存，可以在个人审美库中选择。', 'success');
    toast(editingId ? 'AI Provider 已更新并安全保存' : 'AI Provider 已安全保存');
    setArchiveStatus('Ready · Provider 已通过服务端保存，浏览器不会持有 API Key。', 'success');
  } catch (error) {
    setProviderStatus(`Provider 保存失败：${error.message}`, 'warning');
    toast(`Provider 保存失败：${error.message}`);
  } finally {
    const submitButton = els.providerForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = false;
  }
}

function resetProviderForm() {
  els.providerForm.dataset.editingProvider = '';
  document.getElementById('provider-name').value = '';
  document.getElementById('provider-type').value = 'OpenAI';
  document.getElementById('provider-key').value = '';
  document.getElementById('provider-base-url').value = '';
  document.getElementById('provider-image-models').value = '';
  document.getElementById('provider-text-models').value = '';
  document.getElementById('provider-image-api').value = 'none';
  document.getElementById('provider-image-api-url').value = '';
  document.getElementById('provider-image-capable').checked = true;
}

function editProvider(id) {
  const provider = getProviders().find(item => item.id === id);
  if (!provider) return;
  els.providerForm.dataset.editingProvider = provider.id;
  document.getElementById('provider-name').value = provider.name || '';
  document.getElementById('provider-type').value = provider.type || 'OpenAI';
  document.getElementById('provider-key').value = '';
  document.getElementById('provider-base-url').value = provider.baseUrl || '';
  document.getElementById('provider-image-models').value = (provider.imageModels || []).join('\n');
  document.getElementById('provider-text-models').value = (provider.textModels || []).join('\n');
  document.getElementById('provider-image-api').value = provider.imageApi || 'none';
  document.getElementById('provider-image-api-url').value = provider.imageApiUrl || '';
  document.getElementById('provider-image-capable').checked = provider.imageCapable !== false;
}

function deleteProvider(id) {
  if (providerSyncState !== 'server') return toast('请先登录后再删除 Provider');
  fetch(`/api/providers?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
    .then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || '删除失败');
      await syncProvidersFromServer();
      toast('Provider 已删除');
    })
    .catch(error => toast(`Provider 删除失败：${error.message}`));
}

function setDefaultProvider(id) {
  if (providerSyncState !== 'server') return toast('请先登录后再设置默认 Provider');
  fetch(`/api/providers?id=${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isDefault: true }) })
    .then(async response => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error?.message || '更新失败'); await syncProvidersFromServer(); toast('默认 Provider 已更新'); })
    .catch(error => toast(`默认 Provider 更新失败：${error.message}`));
}

function renderProviders() {
  if (!els.providerList) return;
  const providers = getProviders();
  const en = document.documentElement.lang === 'en';
  const count = document.getElementById('provider-count'); if (count) count.textContent = `${providers.length} ${en ? (providers.length === 1 ? 'provider' : 'providers') : '个'}`;
  if (!providers.length) {
    els.providerList.innerHTML = `<div class="empty-state">${en ? 'No providers yet. Add a vision-capable model to use it in My Archive.' : '暂无 Provider。添加一个支持图片分析的模型后，可在私人审美库生成时选择。'}</div>`;
    return;
  }
  els.providerList.innerHTML = providers.map(provider => `
    <article class="provider-card ${provider.isDefault ? 'is-default' : ''}">
      <div class="provider-card-top"><div><h4>${escapeHTML(provider.name || provider.type)}</h4><p>${escapeHTML(provider.type)} · ${provider.hasSecret ? (en ? 'API key stored securely' : 'API Key 已安全保存') : (en ? 'API key required' : '等待 API Key')}</p></div>${provider.isDefault ? `<span class="provider-status">${en ? 'Default' : '默认'}</span>` : ''}</div>
      <div class="provider-capabilities"><span>${provider.imageCapable ? (en ? 'Image analysis' : '图片分析') : (en ? 'Text only' : '仅文本')}</span><span>${(provider.imageModels || []).length} ${en ? 'vision models' : '个图片模型'}</span><span>${(provider.textModels || []).length} ${en ? 'text models' : '个文本模型'}</span></div>
      <div class="provider-card-actions">
        <button class="icon-action" type="button" data-provider-edit="${escapeHTML(provider.id)}">${en ? 'Edit' : '编辑'}</button>
        <button class="icon-action" type="button" data-provider-default="${escapeHTML(provider.id)}">${en ? 'Default' : '设为默认'}</button>
        <button class="icon-action" type="button" data-provider-delete="${escapeHTML(provider.id)}">${en ? 'Delete' : '删除'}</button>
      </div>
    </article>
  `).join('');
}

function renderProviderSelectors(useDefault = false) {
  if (!els.archiveProviderSelect || !els.archiveModelSelect) return;
  const providers = getProviders().filter(provider => provider.hasSecret && provider.imageCapable && (provider.imageModels || []).length);
  const currentProvider = els.archiveProviderSelect.value;
  els.archiveProviderSelect.innerHTML = '<option value="">Local fallback</option>' + providers.map(provider => `<option value="${escapeHTML(provider.id)}">${escapeHTML(provider.name || provider.type)}</option>`).join('');
  const fallbackId = useDefault ? (providers.find(provider => provider.isDefault)?.id || providers[0]?.id || '') : '';
  const nextProviderId = providers.some(provider => provider.id === currentProvider) ? currentProvider : fallbackId;
  els.archiveProviderSelect.value = nextProviderId;
  const provider = providers.find(item => item.id === nextProviderId);
  els.archiveModelSelect.innerHTML = '<option value="">Auto / image-capable</option>' + (provider?.imageModels || []).map(model => `<option value="${escapeHTML(model)}">${escapeHTML(model)}</option>`).join('');
  if (provider?.defaultImageModel) els.archiveModelSelect.value = provider.defaultImageModel;
}

function loadProvider() {
  providerCache = [];
  renderProviders();
  renderProviderSelectors(true);
  syncProvidersFromServer().then(() => {
    renderProviders();
    renderProviderSelectors(true);
  });
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2200);
}

function reorderDetailPrompts() {
  const content = document.getElementById('detail-content');
  if (!content) return;
  const firstDetailBlock = content.querySelector('.detail-block');
  const promptBlocks = {
    zh: content.querySelector('.prompt-block.is-primary'),
    en: content.querySelector('.prompt-block.is-secondary')
  };
  const order = isEnglish() ? ['en', 'zh'] : ['zh', 'en'];
  [...order].reverse().forEach(language => {
    const block = promptBlocks[language];
    if (block) content.insertBefore(block, firstDetailBlock || null);
  });
}

function bindEvents() {
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  document.querySelectorAll('[data-login-open]').forEach(button => button.addEventListener('click', openLogin));
  els.loginForm?.addEventListener('submit', loginWithIdentity);
  els.loginGoogle?.addEventListener('click', loginWithGoogle);
  els.logout.addEventListener('click', logout);
  document.querySelectorAll('[data-language-toggle]').forEach(button => button.addEventListener('click', toggleLanguageMenu));
  document.querySelectorAll('[data-language-option]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.languageOption));
  });
  els.search.addEventListener('input', () => {
    state.query = els.search.value;
    document.querySelectorAll('[data-query]').forEach(button => button.classList.remove('is-active'));
    renderCards();
  });
  document.querySelectorAll('[data-filter-group="category"]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeCategory = button.dataset.filter;
      document.querySelectorAll('[data-filter-group="category"]').forEach(item => item.classList.toggle('is-active', item === button));
      renderCards();
    });
  });
  document.querySelectorAll('[data-query]').forEach(button => {
    button.addEventListener('click', () => {
      els.search.value = button.dataset.query;
      state.query = button.dataset.query;
      document.querySelectorAll('[data-query]').forEach(item => item.classList.toggle('is-active', item === button));
      renderCards();
    });
  });
  document.addEventListener('click', event => {
    const loginButton = event.target.closest('[data-login-open]');
    if (loginButton) {
      event.preventDefault();
      openLogin();
      return;
    }
    if (!event.target.closest('[data-language-menu]')) {
      document.querySelectorAll('[data-language-menu]').forEach(menu => {
        menu.classList.remove('is-open');
        menu.querySelector('[data-language-toggle]')?.setAttribute('aria-expanded', 'false');
      });
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      event.stopPropagation();
      const item = findCase(actionButton.dataset.caseId);
      if (actionButton.dataset.action === 'save') saveCase(item);
      if (actionButton.dataset.action === 'like') toggleLike(item);
      if (actionButton.dataset.action === 'copy-private') copyPublicCaseToArchive(item);
      if (actionButton.dataset.action === 'edit-private') {
        fillArchiveForm(item);
        switchTab('archive');
        els.archiveForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (actionButton.dataset.action === 'collage') openCollagePicker(item);
      if (actionButton.dataset.action === 'resubmit-public') updatePublishStatus(actionButton.dataset.caseId, 'pending');
      if (actionButton.dataset.action === 'remove') removeSaved(actionButton.dataset.caseId);
      if (actionButton.dataset.action === 'delete-private') deletePrivateCase(actionButton.dataset.caseId);
      return;
    }
    const card = event.target.closest('[data-case-id]');
    if (card) openDetail(findCase(card.dataset.caseId));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && els.overlay.classList.contains('is-open')) closeDetail();
    if (event.key === 'Escape' && els.loginPopover.classList.contains('is-open')) closeLogin();
    if (event.key === 'Escape') document.querySelectorAll('[data-language-menu]').forEach(menu => menu.classList.remove('is-open'));
    if (event.key === 'Escape' && state.activeTab === 'collage' && !event.target.closest('input, textarea, [contenteditable="true"]')) clearBoardSelection();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redoCollage();
      else undoCollage();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redoCollage();
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.activeTab === 'collage' && !event.target.closest('input, textarea, [contenteditable="true"]')) {
      const selected = getCollageBoard().selectedId;
      if (selected) {
        event.preventDefault();
        removeFromCollage(selected);
      }
    }
    if (event.key === 'Enter') {
      const card = event.target.closest?.('[data-case-id]');
      if (card) openDetail(findCase(card.dataset.caseId));
    }
  });
  els.closeDetail.addEventListener('click', closeDetail);
  els.overlay.addEventListener('click', event => { if (event.target === els.overlay) closeDetail(); });
  els.loginClose.addEventListener('click', closeLogin);
  els.loginPopover.addEventListener('click', event => { if (event.target === els.loginPopover) closeLogin(); });
  els.thumbs.addEventListener('click', event => {
    const thumb = event.target.closest('[data-thumb-index]');
    if (thumb) renderGallery(Number(thumb.dataset.thumbIndex));
  });
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', () => {
      const item = state.selectedCase;
      if (!item) return;
      copyText(button.dataset.copy === 'zh' ? item.promptZh : item.promptEn);
    });
  });
  document.getElementById('detail-save').addEventListener('click', () => saveCase(state.selectedCase));
  document.getElementById('detail-like').addEventListener('click', () => toggleLike(state.selectedCase));
  document.getElementById('detail-copy-edit').addEventListener('click', () => {
    if (!state.selectedCase) return;
    if (state.selectedCase.source === 'private') {
      fillArchiveForm(state.selectedCase);
      switchTab('archive');
      closeDetail();
      els.archiveForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    copyPublicCaseToArchive(state.selectedCase);
    closeDetail();
  });
  document.getElementById('detail-add-collage').addEventListener('click', () => openCollagePicker(state.selectedCase));
  document.getElementById('detail-add-gallery').addEventListener('click', () => openCollagePicker(state.selectedCase));
  els.collagePicker?.addEventListener('click', event => {
    if (event.target.closest('[data-collage-picker-close]')) { els.collagePicker.hidden = true; return; }
    const item = findCase(els.collagePicker.dataset.caseId);
    if (!item) return;
    if (event.target.closest('[data-collage-all]')) { els.collagePicker._images.forEach(image => addToCollage(item, image)); els.collagePicker.hidden = true; return; }
    const option = event.target.closest('[data-collage-image-index]');
    if (option) { addToCollage(item, els.collagePicker._images[Number(option.dataset.collageImageIndex)]); els.collagePicker.hidden = true; }
  });
  document.getElementById('detail-export').addEventListener('click', () => {
    if (!state.selectedCase) return;
    download(`${state.selectedCase.id}-aesthetic-style.md`, caseMarkdown(state.selectedCase), 'text/markdown');
  });

  document.getElementById('plaza-clear-btn').addEventListener('click', clearPlazaFilters);
  document.getElementById('export-md-btn').addEventListener('click', () => exportSaved('md'));
  document.getElementById('export-json-btn').addEventListener('click', () => exportSaved('json'));
  document.getElementById('clear-saved-btn').addEventListener('click', () => {
    setSaved([]);
    renderCards();
    renderArchive();
    toast('已清空收藏');
  });
  document.querySelectorAll('[data-archive-export]').forEach(button => button.addEventListener('click', () => {
    exportArchiveDocument(button.dataset.archiveExport);
    document.getElementById('archive-export-menu')?.removeAttribute('open');
  }));
  document.getElementById('clear-archive-btn').addEventListener('click', clearArchive);
  els.archiveFile?.addEventListener('change', event => {
    const files = [...(event.target.files || [])].filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    text('#archive-file-label', isEnglish() ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : `已选择 ${files.length} 个文件`);
    Promise.all(files.map(file => compressImageFile(file))).then(images => {
      images = images.filter(Boolean);
      els.archiveImage.value = images.join('\n');
      updateArchiveImagePreview(images);
      if (els.archiveAiStatus) els.archiveAiStatus.textContent = providerReady()
        ? `${images.length} 张图片已保存在本地表单中。可以点击 AI Analyze Image 生成结构化草稿。`
        : `${images.length} 张图片已保存在本地表单中。未配置 Provider 时会使用模拟 AI 生成。`;
    });
  });
  els.archiveImage?.addEventListener('input', () => updateArchiveImagePreview(els.archiveImage.value.trim()));
  els.archiveAiBtn?.addEventListener('click', analyzeArchiveImage);
  els.settingsForm?.addEventListener('submit', saveWorkspacePreferences);
  els.settingsProfileForm?.addEventListener('submit', saveProfile);
  els.settingsPrivacySave?.addEventListener('click', savePrivacySettings);
  document.querySelectorAll('[data-feedback-open]').forEach(button => button.addEventListener('click', () => {
    if (els.feedbackModal) { els.feedbackModal.hidden = false; els.feedbackMessage?.focus(); }
  }));
  document.querySelectorAll('[data-feedback-close]').forEach(button => button.addEventListener('click', () => { if (els.feedbackModal) els.feedbackModal.hidden = true; }));
  els.feedbackForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const message = els.feedbackMessage?.value.trim();
    if (!message) return toast('请输入反馈内容');
    const submit = els.feedbackForm.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = isEnglish() ? 'Sending…' : '提交中…'; }
    try {
      await fetch('/api/feedback', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'feedback', message }) }).then(async response => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error?.message || `Feedback API ${response.status}`); return payload; });
      els.feedbackForm.reset();
      if (els.feedbackModal) els.feedbackModal.hidden = true;
      toast(isEnglish() ? 'Thanks for your feedback' : '感谢你的反馈');
    } catch (error) { toast(`反馈提交失败：${error.message}`); }
    finally { if (submit) { submit.disabled = false; submit.textContent = isEnglish() ? 'Send feedback' : '提交反馈'; } }
  });
  els.settingsExport?.addEventListener('click', exportWorkspaceBackup);
  els.settingsImport?.addEventListener('change', event => {
    importWorkspaceBackup(event);
    if (event.target.files?.length) text('#settings-import-file-label', isEnglish() ? 'Backup selected' : '已选择备份文件');
  });
  els.settingsClear?.addEventListener('click', clearWorkspace);
  els.avatarFile?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return toast(isEnglish() ? 'Choose an image file' : '请选择图片文件');
    text('#setting-avatar-file-label', isEnglish() ? 'Image selected' : '已选择图片');
    compressImageFile(file, 640, 0.68).then(value => { els.avatar.value = value; renderAvatarPicker(value); });
  });
  els.avatarPresets?.addEventListener('click', event => { const preset = event.target.closest('[data-avatar-preset]'); if (!preset) return; els.avatar.value = preset.dataset.avatarPreset; renderAvatarPicker(els.avatar.value); });
  els.avatar?.addEventListener('input', () => renderAvatarPicker(els.avatar.value.trim()));
  els.folderButton?.addEventListener('click', async () => {
    if (!window.showDirectoryPicker) return toast('当前浏览器不支持本地文件夹选择，请使用 Chromium 浏览器');
    try { exportDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); if (els.folderStatus) els.folderStatus.textContent = '已选择导出文件夹。导出按日期自动归档。'; } catch (error) { if (error.name !== 'AbortError') toast(`文件夹选择失败：${error.message}`); }
  });
  document.querySelectorAll('[data-modal-close], [data-modal-cancel]').forEach(button => button.addEventListener('click', () => { if (els.modal) els.modal.hidden = true; }));
  document.getElementById('settings-clear-private-btn')?.addEventListener('click', () => clearSettingData('private'));
  document.getElementById('settings-clear-saved-btn')?.addEventListener('click', () => clearSettingData('saved'));
  document.getElementById('settings-clear-board-btn')?.addEventListener('click', () => clearSettingData('board'));
  els.settingsTemplateSelect?.addEventListener('change', renderTemplateSettings);
  document.getElementById('setting-template-folders')?.addEventListener('click', event => { const folder = event.target.closest('[data-template-folder]'); if (!folder || !els.settingsTemplateSelect) return; els.settingsTemplateSelect.value = folder.dataset.templateFolder; renderTemplateSettings(); });
  els.settingsTemplateNew?.addEventListener('click', newTemplateSettings);
  els.settingsTemplateSave?.addEventListener('click', saveTemplateSettings);
  els.settingsTemplateCopy?.addEventListener('click', copyTemplateSettings);
  els.settingsTemplateReset?.addEventListener('click', resetTemplateSettings);
  els.settingsTemplateTest?.addEventListener('click', testTemplateSettings);
  els.archiveCategory?.addEventListener('change', syncCategoryOther);
  els.promptMaxLength?.addEventListener('input', updatePromptLengthStatus);
  ['archive-prompt-zh','archive-prompt-en','archive-negative'].forEach(id => document.getElementById(id)?.addEventListener('input', updatePromptLengthStatus));
  els.archiveNewCard?.addEventListener('click', () => resetArchiveForm('Ready · 已开始一张新的审美卡片。'));
  els.archiveClearImage?.addEventListener('click', () => {
    els.archiveImage.value = '';
    if (els.archiveFile) els.archiveFile.value = '';
    updateArchiveImagePreview('');
    if (els.archiveAiStatus) els.archiveAiStatus.textContent = '图片已清除，可重新上传一张或多张参考图。';
  });
  document.getElementById('collage-undo-btn').addEventListener('click', undoCollage);
  document.getElementById('collage-redo-btn').addEventListener('click', redoCollage);
  document.getElementById('collage-clear-stroke-btn').addEventListener('click', clearLastStroke);
  document.getElementById('collage-summary-btn').addEventListener('click', generateBoardAISummary);
  document.querySelectorAll('[data-collage-tool]').forEach(button => button.addEventListener('click', () => setCollageTool(button.dataset.collageTool)));
  document.querySelectorAll('[data-collage-export]').forEach(button => button.addEventListener('click', () => {
    exportCollageDocument(button.dataset.collageExport);
    document.getElementById('collage-export-menu')?.removeAttribute('open');
  }));
  document.getElementById('clear-collage-btn').addEventListener('click', clearCollage);
  els.reviewRefresh?.addEventListener('click', loadReviewQueue);
  els.reviewGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-review-action]');
    if (button) reviewCard(button.dataset.reviewId, button.dataset.reviewAction);
  });
  els.collageCanvas?.addEventListener('pointerdown', event => {
    if (bindBoardPen(event)) return;
    bindBoardDrag(event);
  });
  els.collageCanvas?.addEventListener('click', event => {
    const node = event.target.closest('[data-board-node]');
    if (!node || node.isContentEditable) return;
    selectBoardNode(node.dataset.boardNode);
  });
  els.collageCanvas?.addEventListener('input', event => {
    const node = event.target.closest('[data-board-node]');
    if (!node || !node.isContentEditable) return;
    const clone = node.cloneNode(true);
    clone.querySelector('.board-resize')?.remove();
    clone.querySelector('.board-drag-handle')?.remove();
    updateBoardNode(node.dataset.boardNode, { text: clone.textContent.trim() });
  });
  els.collageCanvas?.addEventListener('blur', saveTextNode, true);
  els.collageList?.addEventListener('click', event => {
    const remove = event.target.closest('[data-collage-remove]');
    const select = event.target.closest('[data-board-select]');
    const duplicate = event.target.closest('[data-board-duplicate]');
    const front = event.target.closest('[data-board-front]');
    if (remove) removeFromCollage(remove.dataset.collageRemove);
    if (select) selectBoardNode(select.dataset.boardSelect);
    if (duplicate) duplicateBoardNode(duplicate.dataset.boardDuplicate);
    if (front) bringBoardNodeForward(front.dataset.boardFront);
  });
  document.getElementById('collage-inspector')?.addEventListener('click', event => {
    const remove = event.target.closest('[data-collage-remove]');
    const duplicate = event.target.closest('[data-board-duplicate]');
    const front = event.target.closest('[data-board-front]');
    const back = event.target.closest('[data-board-back]');
    const removeBg = event.target.closest('[data-image-remove-bg]');
    const palette = event.target.closest('[data-image-palette]');
    const swatch = event.target.closest('[data-board-style-value]');
    if (remove) removeFromCollage(remove.dataset.collageRemove);
    if (duplicate) duplicateBoardNode(duplicate.dataset.boardDuplicate);
    if (front) bringBoardNodeForward(front.dataset.boardFront);
    if (back) sendBoardNodeBack(back.dataset.boardBack);
    if (removeBg) removeBackgroundFromNode(removeBg.dataset.imageRemoveBg);
    if (palette) extractPaletteFromNode(palette.dataset.imagePalette);
    if (swatch) updateBoardStyle(swatch.dataset.boardStyleId, swatch.dataset.boardStyle, swatch.dataset.boardStyleValue);
  });
  document.getElementById('collage-inspector')?.addEventListener('input', event => {
    const styleInput = event.target.closest('[data-board-style]');
    const penInput = event.target.closest('[data-pen-style]');
    const imageInput = event.target.closest('[data-image-replace]');
    if (styleInput) updateBoardStyle(styleInput.dataset.boardStyleId, styleInput.dataset.boardStyle, styleInput.value);
    if (penInput) updatePenStyle(penInput.dataset.penStyle, penInput.value);
    if (imageInput) replaceBoardImage(imageInput.dataset.imageReplace, imageInput.value);
  });
  document.getElementById('collage-inspector')?.addEventListener('change', event => {
    const styleInput = event.target.closest('[data-board-style]');
    const penInput = event.target.closest('[data-pen-style]');
    const imageInput = event.target.closest('[data-image-replace]');
    if (styleInput) updateBoardStyle(styleInput.dataset.boardStyleId, styleInput.dataset.boardStyle, styleInput.value);
    if (penInput) updatePenStyle(penInput.dataset.penStyle, penInput.value);
    if (imageInput) replaceBoardImage(imageInput.dataset.imageReplace, imageInput.value);
  });
  document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => toast(button.dataset.toast)));
  els.archiveForm.addEventListener('reset', event => {
    event.preventDefault();
    resetArchiveForm();
  });
  els.archiveForm.addEventListener('submit', createPrivateCase);
  els.archiveProviderSelect?.addEventListener('change', () => renderProviderSelectors(false));
  els.archiveTemplateSelect?.addEventListener('change', () => {
    const prefs = getPreferences(); prefs.promptTemplateId = els.archiveTemplateSelect.value; saveJSON(STORAGE.preferences, prefs); renderTemplateSettings();
  });
  els.providerForm.addEventListener('submit', saveProvider);
  document.getElementById('provider-new-btn')?.addEventListener('click', resetProviderForm);
  els.providerList?.addEventListener('click', event => {
    const edit = event.target.closest('[data-provider-edit]');
    const remove = event.target.closest('[data-provider-delete]');
    const makeDefault = event.target.closest('[data-provider-default]');
    if (edit) editProvider(edit.dataset.providerEdit);
    if (remove) deleteProvider(remove.dataset.providerDelete);
    if (makeDefault) setDefaultProvider(makeDefault.dataset.providerDefault);
  });
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');
  const requestedTab = params.get('tab');
  syncCases();
  renderCards();
  renderArchive();
  renderCollage();
  updateSavedUI();
  loadProvider();
  bindEvents();
  syncCloudWorkspace().then(() => {
    const requestedCard = params.get('card');
    if (requestedCard) openDetail(findCase(requestedCard));
    fetch('/api/profile', { credentials: 'same-origin' }).then(response => response.ok ? response.json() : null).then(payload => {
        const profile = payload?.data;
        if (!profile) {
          document.querySelectorAll('.reviewer-only').forEach(node => { node.hidden = false; });
          return;
        }
        const localProfile = getProfile();
        const serverName = profile.display_name?.trim() || '';
        const localName = localProfile.name?.trim() || '';
        const localLooksLikeEmail = localName.includes('@') && localName === localProfile.email;
        const serverNameIsEmail = profile.email && serverName.toLowerCase() === profile.email.toLowerCase();
        const profileName = serverName && !serverNameIsEmail ? serverName : (localLooksLikeEmail ? '' : localName);
        const mergedProfile = { ...localProfile, name: profileName, avatar: profile.avatar_url || localProfile.avatar || '', email: profile.email || localProfile.email || '', bio: profile.bio || '', specialty: profile.design_focus || localProfile.specialty || '' };
        saveJSON(STORAGE.profile, mergedProfile);
        setUser({ id: profile.id, provider: 'supabase', identity: profile.email || profile.id, name: profileName || profile.email?.split('@')[0] || 'Account', avatar: mergedProfile.avatar, role: profile.role || 'user', signedInAt: profile.created_at || new Date().toISOString() });
        document.querySelectorAll('.reviewer-only').forEach(node => { node.hidden = false; });
        populateSettings();
        if (['admin', 'reviewer'].includes(profile.role || '')) loadReviewQueue();
      }).catch(() => { document.querySelectorAll('.reviewer-only').forEach(node => { node.hidden = false; }); loadReviewQueue(); });
  });
  const preferences = getPreferences();
  applyDensity(preferences.density);
  renderArchiveTemplateSelect();
  const storedLanguage = localStorage.getItem(STORAGE.language);
  const systemLanguage = /^en/i.test(navigator.language || '') ? 'en' : 'zh-CN';
  setLanguage(storedLanguage || systemLanguage, false);
  const validTabs = new Set(Array.from(document.querySelectorAll('[data-panel]'), panel => panel.dataset.panel));
  const initialTab = requestedTab && validTabs.has(requestedTab)
    ? requestedTab
    : (validTabs.has(preferences.defaultTab) ? preferences.defaultTab : 'plaza');
  switchTab(initialTab);
  renderAuthState();
  populateSettings();
  if (params.get('login') === '1') openLogin();
  window.addEventListener('focus', syncUnreadCount);
}

init();
