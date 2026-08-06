import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { insertThought, validateThoughtInput } from '../db/thoughts.mjs';

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseArgs(argv) {
  let input;
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--input') {
      if (input !== undefined) throw new Error('--input may only be provided once');
      input = readOptionValue(argv, index, option);
      index += 1;
    } else if (option === '--apply') {
      if (apply) throw new Error('--apply may only be provided once');
      apply = true;
    } else {
      throw new Error(`unknown option: ${option}`);
    }
  }

  if (input === undefined) throw new Error('--input is required');
  if (!isAbsolute(input)) throw new Error('--input must be an absolute path');
  return { input, apply };
}

async function readThought(filename) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('input must contain valid JSON');
    throw error;
  }
  return validateThoughtInput(parsed);
}

function applyThought(db, thought) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = insertThought(db, thought);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original transaction failure.
    }
    throw error;
  }
}

export async function run(argv, { stdout = console.log } = {}) {
  const options = parseArgs(argv);
  const thought = await readThought(options.input);

  if (!options.apply) {
    const output = { mode: 'preview', ...thought };
    stdout(JSON.stringify(output, null, 2));
    return output;
  }

  const db = openDatabase(resolve(process.env.DATA_DIR ?? 'data', 'dashboard.sqlite3'));
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    const result = applyThought(db, thought);
    const output = {
      mode: 'apply',
      title: result.thought.title,
      content: result.thought.content,
      tags: result.thought.tags,
      id: result.thought.id,
      createdAt: result.thought.createdAt,
      inserted: result.inserted,
    };
    stdout(JSON.stringify(output, null, 2));
    return output;
  } finally {
    db.close();
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : 'thought import failed');
  }
}
