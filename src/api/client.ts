import type {
  CareerPayload,
  ProjectPayload,
  RecordDomain,
  RecordForDomain,
  RecordPayloadMap,
  RecordType,
} from './types';

const INVALID_DATA_MESSAGE = '本地服务返回无效数据';
const UNAVAILABLE_MESSAGE = '本地服务不可用';
const recordDomains: RecordDomain[] = ['investment', 'thought', 'career', 'project'];
const recordTypes: RecordType[] = ['knowledge', 'idea', 'decision', 'experience', 'project'];
const companyAliases: CareerPayload['companyAlias'][] = ['A公司', 'Y公司', 'H公司'];

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(UNAVAILABLE_MESSAGE);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.ok ? INVALID_DATA_MESSAGE : UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    throw new ApiError(errorMessageOf(payload) ?? UNAVAILABLE_MESSAGE);
  }
  if (
    !isObject(payload)
    || !Object.prototype.hasOwnProperty.call(payload, 'data')
    || payload.data == null
  ) {
    throw new ApiError(INVALID_DATA_MESSAGE);
  }
  return payload.data as T;
}

export function listRecords<TDomain extends RecordDomain>(
  domain: TDomain,
  type?: string,
): Promise<RecordForDomain<TDomain>[]> {
  const query = new URLSearchParams({ domain });
  if (type) query.set('type', type);
  return request<unknown>(`/api/records?${query}`)
    .then((data) => parseRecordList(data, domain));
}

function parseRecordList<TDomain extends RecordDomain>(
  value: unknown,
  domain: TDomain,
): RecordForDomain<TDomain>[] {
  if (!Array.isArray(value)) invalidData();
  return value.map((item) => parseRecord(item, domain));
}

function parseRecord<TDomain extends RecordDomain>(
  value: unknown,
  domain: TDomain,
): RecordForDomain<TDomain> {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || !recordDomains.includes(value.domain as RecordDomain)
    || value.domain !== domain
    || !recordTypes.includes(value.type as RecordType)
    || typeof value.title !== 'string'
    || typeof value.content !== 'string'
    || typeof value.status !== 'string'
    || !isNullableDate(value.occurredAt)
    || !isStringArray(value.tags)
    || !isObject(value.payload)
    || !isNullableString(value.sourceRef)
    || !isDateString(value.createdAt)
    || !isDateString(value.updatedAt)
  ) {
    invalidData();
  }

  const record = {
    id: value.id,
    domain,
    type: value.type,
    title: value.title,
    content: value.content,
    status: value.status,
    occurredAt: value.occurredAt,
    tags: [...value.tags],
    payload: parsePayload(domain, value.payload),
    sourceRef: value.sourceRef,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  return record as RecordForDomain<TDomain>;
}

function parsePayload<TDomain extends RecordDomain>(
  domain: TDomain,
  payload: Record<string, unknown>,
): RecordPayloadMap[TDomain] {
  let parsed: RecordPayloadMap[RecordDomain];
  if (domain === 'career') {
    parsed = parseCareerPayload(payload);
  } else if (domain === 'project') {
    parsed = parseProjectPayload(payload);
  } else {
    parsed = { ...payload };
  }
  return parsed as RecordPayloadMap[TDomain];
}

function parseCareerPayload(payload: Record<string, unknown>): CareerPayload {
  if (
    !companyAliases.includes(payload.companyAlias as CareerPayload['companyAlias'])
    || typeof payload.position !== 'string'
    || !isDateString(payload.startDate)
    || !isNullableDate(payload.endDate)
    || typeof payload.responsibilities !== 'string'
    || !isStringArray(payload.projects)
    || typeof payload.isCurrent !== 'boolean'
  ) {
    invalidData();
  }
  return {
    companyAlias: payload.companyAlias as CareerPayload['companyAlias'],
    position: payload.position,
    startDate: payload.startDate,
    endDate: payload.endDate,
    responsibilities: payload.responsibilities,
    projects: [...payload.projects],
    isCurrent: payload.isCurrent,
  };
}

function parseProjectPayload(payload: Record<string, unknown>): ProjectPayload {
  if (
    !isStringArray(payload.techStack)
    || !isSafeUrl(payload.repositoryUrl)
    || !isSafeUrl(payload.demoUrl)
    || typeof payload.currentFocus !== 'string'
  ) {
    invalidData();
  }
  return {
    techStack: [...payload.techStack],
    repositoryUrl: payload.repositoryUrl,
    demoUrl: payload.demoUrl,
    currentFocus: payload.currentFocus,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDateString(value);
}

function isSafeUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function errorMessageOf(payload: unknown) {
  if (!isObject(payload) || !isObject(payload.error)) return null;
  return typeof payload.error.message === 'string' && payload.error.message
    ? payload.error.message
    : null;
}

function invalidData(): never {
  throw new ApiError(INVALID_DATA_MESSAGE);
}

export { request };
