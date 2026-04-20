import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'csv-parse/sync';
import { normalizeCatalogRow, type RawCatalogCsvRow } from '../domains/workout/catalog';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CSV_PATH = 'docs/imports/exercise-catalog/reed_exercise_catalog_merged.csv';

type ImportArgs = {
  batchSize?: number;
  csvPath?: string;
  deployment?: string;
};

const args = parseArgs(process.argv.slice(2));
const csvPath = resolve(process.cwd(), args.csvPath ?? DEFAULT_CSV_PATH);
const deployment = args.deployment ?? 'dev';
const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;

const csvText = readFileSync(csvPath, 'utf8');
const rows = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
}) as RawCatalogCsvRow[];
const normalizedRows = rows.map(row => normalizeCatalogRow(row));

let imported = 0;

for (let index = 0; index < normalizedRows.length; index += batchSize) {
  const batch = normalizedRows.slice(index, index + batchSize);
  const result = spawnSync(
    'npx',
    [
      'convex',
      'run',
      '--codegen=disable',
      '--typecheck=disable',
      '--deployment',
      deployment,
      'exerciseCatalog:importCatalogBatch',
      JSON.stringify({ rows: batch }),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  imported += batch.length;
  process.stdout.write(`Imported ${imported}/${normalizedRows.length} exercises\n`);
}

process.stdout.write(`Catalog import complete for deployment "${deployment}".\n`);

function parseArgs(argv: string[]): ImportArgs {
  const parsed: ImportArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--deployment') {
      parsed.deployment = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--csv') {
      parsed.csvPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--batch-size') {
      parsed.batchSize = Number(argv[index + 1]);
      index += 1;
    }
  }

  return parsed;
}
