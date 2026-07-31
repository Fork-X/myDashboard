import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';

const ALLOWED_ALIASES = new Set(['A公司', 'Y公司', 'H公司']);
const ALLOWED_TOPIC_DOMAINS = new Set(['investment', 'thought', 'career']);
const ALLOWED_GOAL_TOPICS = new Set(['year', 'month']);
const IMPORT_MAP_KEYS = new Set([
  'topicDomains',
  'goalTopics',
  'careerAliases',
  'redactions',
  'blockedTerms',
]);
const COMPENSATION_PATTERN =
  /薪资|薪酬|工资|年薪|月薪|总包|奖金|股权|salary|compensation|base pay|bonus|RSU|[¥￥]/i;
const SOURCE_REF_ERROR =
  'source reference must be a non-empty relative POSIX path';

function emptyImportMap() {
  return {
    topicDomains: {},
    goalTopics: {},
    careerAliases: {},
    redactions: {},
    blockedTerms: [],
  };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value, field) {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function validateImportMap(value) {
  if (!isRecord(value)) {
    throw new Error('import map must be a top-level object');
  }

  for (const key of Object.keys(value)) {
    if (!IMPORT_MAP_KEYS.has(key)) {
      throw new Error('import map contains an unknown top-level key');
    }
  }

  const result = emptyImportMap();

  if (Object.hasOwn(value, 'topicDomains')) {
    requireRecord(value.topicDomains, 'topicDomains');
    if (
      !Object.values(value.topicDomains).every((domain) =>
        ALLOWED_TOPIC_DOMAINS.has(domain),
      )
    ) {
      throw new Error(
        'topicDomains values must be investment, thought, or career',
      );
    }
    result.topicDomains = value.topicDomains;
  }

  if (Object.hasOwn(value, 'goalTopics')) {
    requireRecord(value.goalTopics, 'goalTopics');
    if (
      !Object.values(value.goalTopics).every((topic) =>
        ALLOWED_GOAL_TOPICS.has(topic),
      )
    ) {
      throw new Error('goalTopics values must be year or month');
    }
    result.goalTopics = value.goalTopics;
  }

  if (Object.hasOwn(value, 'careerAliases')) {
    requireRecord(value.careerAliases, 'careerAliases');
    if (
      !Object.values(value.careerAliases).every((alias) =>
        ALLOWED_ALIASES.has(alias),
      )
    ) {
      throw new Error(
        'careerAliases values must be A公司, Y公司, or H公司',
      );
    }
    result.careerAliases = value.careerAliases;
  }

  if (Object.hasOwn(value, 'redactions')) {
    requireRecord(value.redactions, 'redactions');
    if (
      !Object.values(value.redactions).every(
        (replacement) => typeof replacement === 'string',
      )
    ) {
      throw new Error('redactions values must be strings');
    }
    result.redactions = value.redactions;
  }

  if (Object.hasOwn(value, 'blockedTerms')) {
    if (
      !Array.isArray(value.blockedTerms) ||
      !value.blockedTerms.every((term) => typeof term === 'string')
    ) {
      throw new Error('blockedTerms must be an array of strings');
    }
    result.blockedTerms = value.blockedTerms;
  }

  return result;
}

export async function loadImportMap(filename) {
  if (filename === undefined) {
    return emptyImportMap();
  }

  const contents = await readFile(filename, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error('import map JSON is invalid', { cause: error });
  }

  return validateImportMap(parsed);
}

export function redactText(text, map = {}) {
  const careerAliases = map.careerAliases ?? {};
  const redactions = map.redactions ?? {};

  for (const alias of Object.values(careerAliases)) {
    if (!ALLOWED_ALIASES.has(alias)) {
      throw new Error('career alias target rule violated');
    }
  }

  const replacements = Object.entries({
    ...careerAliases,
    ...redactions,
  }).sort(([left], [right]) => right.length - left.length);
  let redacted = String(text ?? '');

  for (const [source, replacement] of replacements) {
    if (source.length > 0) {
      redacted = redacted.split(source).join(replacement);
    }
  }

  return redacted;
}

export function normalizeSourceRef(value) {
  if (typeof value !== 'string') {
    throw new Error(SOURCE_REF_ERROR);
  }

  const withForwardSlashes = value.replaceAll('\\', '/');
  const hasParentSegment = withForwardSlashes.split('/').includes('..');
  const hasDriveLetter = /^[A-Za-z]:($|\/)/.test(withForwardSlashes);
  const hasUrlScheme = /^[A-Za-z][A-Za-z\d+.-]*:/.test(withForwardSlashes);

  if (
    withForwardSlashes.trim().length === 0 ||
    posix.isAbsolute(withForwardSlashes) ||
    hasDriveLetter ||
    hasUrlScheme ||
    hasParentSegment
  ) {
    throw new Error(SOURCE_REF_ERROR);
  }

  return posix.normalize(withForwardSlashes);
}

export function validatePersistable(value, map = {}) {
  let serialized;

  try {
    serialized = JSON.stringify(value) ?? '';
  } catch (error) {
    throw new Error('privacy serialization rule violated', { cause: error });
  }

  if (COMPENSATION_PATTERN.test(serialized)) {
    throw new Error('privacy compensation rule violated');
  }

  for (const term of map.blockedTerms ?? []) {
    if (term.trim().length > 0 && serialized.includes(term)) {
      throw new Error('privacy blocked term rule violated');
    }
  }

  return value;
}
