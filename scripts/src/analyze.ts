import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  analyzeMarket,
  normalizeCandles,
  type CandleRow,
  type DatasetSourceFormat,
} from "@workspace/market-engine";

interface CliOptions {
  file: string;
  instrument: string;
  timeframe: string;
  source: string;
  datasetId: string;
  datasetVersion: string;
}

function usage(): string {
  return [
    "Usage:",
    "  pnpm --filter @workspace/scripts run analyze -- --file <candles.csv|candles.json> --instrument <name> --timeframe <interval> [--dataset-id <id>] [--dataset-version <version>]",
    "",
    "Input columns:",
    "  timestamp,open,high,low,close,volume,volume_type",
    "",
    "Dataset metadata defaults:",
    "  dataset-id: adhoc-input",
    "  dataset-version: unversioned",
    "",
    "Example:",
    "  pnpm --filter @workspace/scripts run analyze -- --file data/xauusd.csv --instrument XAUUSD --timeframe 1h",
  ].join("\n");
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument "${arg}".\n\n${usage()}`);
    }
    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}.\n\n${usage()}`);
    }
    values.set(key, value);
    index += 1;
  }

  const file = values.get("file");
  const instrument = values.get("instrument");
  const timeframe = values.get("timeframe");
  if (!file || !instrument || !timeframe) {
    throw new Error(`--file, --instrument, and --timeframe are required.\n\n${usage()}`);
  }

  return {
    file,
    instrument,
    timeframe,
    source: values.get("source") ?? "cli-input",
    datasetId: values.get("dataset-id") ?? "adhoc-input",
    datasetVersion: values.get("dataset-version") ?? "unversioned",
  };
}

function parseCsv(text: string): CandleRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error("CSV input must contain a header row and at least one data row.");
  }

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        fields.push(field.trim());
        field = "";
      } else {
        field += character;
      }
    }
    if (quoted) throw new Error("CSV contains an unterminated quoted field.");
    fields.push(field.trim());
    return fields;
  };

  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  if (headers.some((header) => header.length === 0)) {
    throw new Error("CSV headers cannot be empty.");
  }
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseInput(text: string, file: string): CandleRow[] {
  if (file.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every((row) => row !== null && typeof row === "object")) {
      throw new Error("JSON input must be an array of candle objects.");
    }
    return parsed as CandleRow[];
  }
  return parseCsv(text);
}

function sourceFormatFor(file: string): DatasetSourceFormat {
  return file.toLowerCase().endsWith(".json") ? "json" : "csv";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const options = parseArgs(args);
  const filePath = resolve(options.file);
  const text = await readFile(filePath, "utf8");
  const rows = parseInput(text, filePath);
  const sourceFormat = sourceFormatFor(filePath);
  const normalized = normalizeCandles(rows, {
    instrument: options.instrument,
    timeframe: options.timeframe,
    source: options.source,
    datasetId: options.datasetId,
    datasetVersion: options.datasetVersion,
    sourceFormat,
    sourceRowOffset: sourceFormat === "csv" ? 2 : 1,
  });
  const analysis = analyzeMarket(normalized.candles, normalized.quality, normalized.metadata);
  process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`MLAI analysis failed: ${message}\n`);
  process.exitCode = 1;
});