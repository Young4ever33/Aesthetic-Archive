export const CARD_STATUSES = [
  'draft',
  'ai_generated',
  'needs_review',
  'approved',
  'rejected',
  'published',
  'unpublished',
] as const;

export type CardStatus = (typeof CARD_STATUSES)[number];

export const USER_ROLES = ['user', 'reviewer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RIGHTS_STATUSES = [
  'unknown',
  'user_owned',
  'licensed',
  'public_domain',
  'fair_use_review',
  'restricted',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export type CardSource = 'private' | 'seed' | 'user_upload' | 'import';

export interface CardContent {
  category: string;
  title: string;
  titleZh: string;
  summary: string;
  visibleFacts: string[];
  culturalContext: string[];
  inferences: string[];
  materials: string[];
  lighting: string[];
  geometry: string[];
  typography: string[];
  palette: string[];
  composition: string;
  useCases: string[];
  promptZh: string;
  promptEn: string;
  negativePrompt: string;
  confidence: number;
  reviewNotes: string[];
  source: string;
  rightsStatus: RightsStatus;
}

export interface GenerationMetadata {
  requestId: string;
  providerType: string;
  model: string;
  templateId: string;
  templateVersion: number;
  generatedAt: string;
}

export interface AestheticCard extends CardContent {
  id: string;
  ownerId: string | null;
  status: CardStatus;
  visibility: 'private' | 'public';
  version: number;
  generation?: GenerationMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeImageRequest {
  providerId: string;
  model?: string;
  templateId?: string;
  templateVersion?: number;
  image: {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    data: string;
  };
  topic?: string;
  projectContext?: string;
  language?: 'zh-CN' | 'en';
}

export interface BoardSummaryRequest {
  providerId: string;
  model?: string;
  cardIds: string[];
  boardTitle?: string;
  boardContext?: string;
}

export interface GeneratePromptRequest {
  providerId: string;
  model?: string;
  templateId?: string;
  templateVersion?: number;
  card: Partial<CardContent>;
  language?: 'zh-CN' | 'en';
}

export interface AiResponseMeta {
  providerType: string;
  model: string;
  templateId?: string;
  templateVersion?: number;
}

export interface AiSuccess<T> {
  requestId: string;
  data: T;
  meta: AiResponseMeta;
}

export type AiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_INVALID_RESPONSE'
  | 'INTERNAL_ERROR';

export interface AiFailure {
  requestId: string;
  error: {
    code: AiErrorCode;
    message: string;
    retryable: boolean;
  };
}

export interface WorkspaceBackupV2 {
  version: 2;
  exportedAt: string;
  privateCases: unknown[];
  saved: unknown[];
  collage: unknown;
  providers: Array<Record<string, unknown>>;
  preferences: Record<string, unknown>;
  profile: Record<string, unknown>;
  templates: unknown[];
  usageStats: Record<string, unknown>;
}

export type ReviewAction = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish';

export interface ReviewAuditEntry {
  cardId: string;
  actorId: string;
  actorRole: UserRole;
  action: ReviewAction;
  fromStatus: CardStatus;
  toStatus: CardStatus;
  reason?: string;
  createdAt: string;
}
