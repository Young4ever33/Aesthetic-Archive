import {
  CARD_STATUSES,
  RIGHTS_STATUSES,
  type AestheticCard,
  type CardContent,
  type CardStatus,
  type GeneratePromptRequest,
  type AnalyzeImageRequest,
  type BoardSummaryRequest,
  type WorkspaceBackupV2,
} from './contracts';

export class ContractValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('Contract validation failed');
    this.name = 'ContractValidationError';
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const oneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === 'string' && values.includes(value);

const addRequired = (issues: string[], value: unknown, path: string) => {
  if (!nonEmptyString(value)) issues.push(`${path} must be a non-empty string`);
};

export const MAX_JSON_BODY_BYTES = 2_000_000;
export const MAX_PROMPT_CHARS = 40_000;
export const MAX_BASE64_IMAGE_CHARS = 14_000_000;

function maxString(issues: string[], value: unknown, path: string, max: number) {
  if (typeof value === 'string' && value.length > max) issues.push(`${path} exceeds ${max} characters`);
}

export function assertRequestBodySize(request: Request, max = MAX_JSON_BODY_BYTES): void {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > max) throw new ContractValidationError([`request body exceeds ${max} bytes`]);
}

export function validateCardContent(input: unknown): CardContent {
  if (!isRecord(input)) throw new ContractValidationError(['card must be an object']);

  const issues: string[] = [];
  const requiredStrings = [
    ['category', input.category],
    ['title', input.title],
    ['titleZh', input.titleZh],
    ['summary', input.summary],
    ['composition', input.composition],
    ['promptZh', input.promptZh],
    ['promptEn', input.promptEn],
    ['negativePrompt', input.negativePrompt],
    ['source', input.source],
  ] as const;

  requiredStrings.forEach(([path, value]) => addRequired(issues, value, path));

  [
    'visibleFacts',
    'culturalContext',
    'inferences',
    'materials',
    'lighting',
    'geometry',
    'typography',
    'palette',
    'useCases',
    'reviewNotes',
  ].forEach((path) => {
    if (!stringArray(input[path])) issues.push(`${path} must be an array of strings`);
  });

  if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
    issues.push('confidence must be a number between 0 and 1');
  }
  if (!oneOf(input.rightsStatus, RIGHTS_STATUSES)) issues.push('rightsStatus is invalid');

  if (issues.length) throw new ContractValidationError(issues);

  return {
    category: input.category as string,
    title: input.title as string,
    titleZh: input.titleZh as string,
    summary: input.summary as string,
    visibleFacts: input.visibleFacts as string[],
    culturalContext: input.culturalContext as string[],
    inferences: input.inferences as string[],
    materials: input.materials as string[],
    lighting: input.lighting as string[],
    geometry: input.geometry as string[],
    typography: input.typography as string[],
    palette: input.palette as string[],
    composition: input.composition as string,
    useCases: input.useCases as string[],
    promptZh: input.promptZh as string,
    promptEn: input.promptEn as string,
    negativePrompt: input.negativePrompt as string,
    confidence: input.confidence as number,
    reviewNotes: input.reviewNotes as string[],
    source: input.source as string,
    rightsStatus: input.rightsStatus as CardContent['rightsStatus'],
  };
}

export function validateAnalyzeImageRequest(input: unknown): AnalyzeImageRequest {
  if (!isRecord(input)) throw new ContractValidationError(['request must be an object']);
  const issues: string[] = [];
  addRequired(issues, input.providerId, 'providerId');
  if (!isRecord(input.image)) issues.push('image must be an object');
  else {
    if (!oneOf(input.image.mimeType, ['image/jpeg', 'image/png', 'image/webp'] as const)) {
      issues.push('image.mimeType is unsupported');
    }
    addRequired(issues, input.image.data, 'image.data');
    maxString(issues, input.image.data, 'image.data', MAX_BASE64_IMAGE_CHARS);
  }
  if (input.model !== undefined) addRequired(issues, input.model, 'model');
  maxString(issues, input.topic, 'topic', 2_000);
  maxString(issues, input.projectContext, 'projectContext', 5_000);
  if (input.templateVersion !== undefined && (typeof input.templateVersion !== 'number' || !Number.isInteger(input.templateVersion) || input.templateVersion < 1)) {
    issues.push('templateVersion must be a positive integer');
  }
  if (issues.length) throw new ContractValidationError(issues);
  return input as unknown as AnalyzeImageRequest;
}

export function validateGeneratePromptRequest(input: unknown): GeneratePromptRequest {
  if (!isRecord(input)) throw new ContractValidationError(['request must be an object']);
  const issues: string[] = [];
  addRequired(issues, input.providerId, 'providerId');
  if (!isRecord(input.card)) issues.push('card must be an object');
  if (isRecord(input.card)) maxString(issues, JSON.stringify(input.card), 'card', MAX_PROMPT_CHARS);
  maxString(issues, input.model, 'model', 200);
  if (input.templateVersion !== undefined && (typeof input.templateVersion !== 'number' || !Number.isInteger(input.templateVersion) || input.templateVersion < 1)) {
    issues.push('templateVersion must be a positive integer');
  }
  if (issues.length) throw new ContractValidationError(issues);
  return input as unknown as GeneratePromptRequest;
}

export function validateBoardSummaryRequest(input: unknown): BoardSummaryRequest {
  if (!isRecord(input)) throw new ContractValidationError(['request must be an object']);
  const issues: string[] = [];
  addRequired(issues, input.providerId, 'providerId');
  if (!Array.isArray(input.cardIds) || input.cardIds.length === 0 || !input.cardIds.every(nonEmptyString)) {
    issues.push('cardIds must contain at least one card ID');
  }
  if (input.cardIds instanceof Array && input.cardIds.length > 50) issues.push('cardIds cannot contain more than 50 cards');
  maxString(issues, input.model, 'model', 200);
  maxString(issues, input.boardTitle, 'boardTitle', 200);
  maxString(issues, input.boardContext, 'boardContext', MAX_PROMPT_CHARS);
  if (issues.length) throw new ContractValidationError(issues);
  return input as unknown as BoardSummaryRequest;
}

const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  draft: ['ai_generated'],
  ai_generated: ['needs_review', 'draft'],
  needs_review: ['approved', 'rejected', 'draft'],
  approved: ['published', 'unpublished'],
  rejected: ['draft', 'needs_review'],
  published: ['unpublished'],
  unpublished: ['draft', 'needs_review'],
};

export function canTransitionCardStatus(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCardStatusTransition(from: CardStatus, to: CardStatus): void {
  if (!oneOf(from, CARD_STATUSES) || !oneOf(to, CARD_STATUSES) || !canTransitionCardStatus(from, to)) {
    throw new ContractValidationError([`invalid card status transition: ${from} -> ${to}`]);
  }
}

export function validateCard(input: unknown): AestheticCard {
  if (!isRecord(input)) throw new ContractValidationError(['card must be an object']);
  const content = validateCardContent(input);
  const issues: string[] = [];
  addRequired(issues, input.id, 'id');
  if (input.ownerId !== null && input.ownerId !== undefined) addRequired(issues, input.ownerId, 'ownerId');
  if (!oneOf(input.status, CARD_STATUSES)) issues.push('status is invalid');
  if (input.visibility !== 'private' && input.visibility !== 'public') issues.push('visibility is invalid');
  if (!Number.isInteger(input.version) || Number(input.version) < 1) issues.push('version must be a positive integer');
  addRequired(issues, input.createdAt, 'createdAt');
  addRequired(issues, input.updatedAt, 'updatedAt');
  if (issues.length) throw new ContractValidationError(issues);
  return { ...content, ...input } as AestheticCard;
}

export function validateWorkspaceBackup(input: unknown): WorkspaceBackupV2 {
  if (!isRecord(input)) throw new ContractValidationError(['backup must be an object']);
  const issues: string[] = [];
  if (input.version !== 2) issues.push('only backup version 2 is supported');
  addRequired(issues, input.exportedAt, 'exportedAt');
  ['privateCases', 'saved', 'providers', 'templates'].forEach((path) => {
    if (!Array.isArray(input[path])) issues.push(`${path} must be an array`);
  });
  ['preferences', 'profile', 'usageStats'].forEach((path) => {
    if (!isRecord(input[path])) issues.push(`${path} must be an object`);
  });
  if (issues.length) throw new ContractValidationError(issues);
  return input as unknown as WorkspaceBackupV2;
}

export function sanitizeImportedProviders(providers: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return providers.map((provider) => {
    const sanitized = { ...provider };
    delete sanitized.key;
    delete sanitized.apiKey;
    delete sanitized.api_key;
    delete sanitized.encryptedApiKey;
    delete sanitized.encrypted_api_key;
    return { ...sanitized, secretState: 'missing' };
  });
}
