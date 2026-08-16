import type {
  CandleRow,
  DatasetQuality,
  NormalizeOptions,
  NormalizedCandle,
  NormalizationResult,
  VolumeType,
} from "./types";

const FIELD_ALIASES = {
  timestamp: ["timestamp", "time", "datetime", "date"],
  open: ["open", "o"],
  high: ["high", "h"],
  low: ["low", "l"],
  close: ["close", "c"],
  volume: ["volume", "vol", "v"],
  volumeType: ["volume_type", "volumeType"],
} as const;

function readField(row: CandleRow, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias];
    }
  }
  return undefined;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 100_000_000_000 ? value * 1_000 : value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric < 100_000_000_000 ? numeric * 1_000 : numeric;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function timeframeSeconds(timeframe: string): number | null {
  const match = /^(\d+)\s*([mhdw])$/i.exec(timeframe.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "m" ? 60 : unit === "h" ? 3_600 : unit === "d" ? 86_400 : 604_800;
  return amount * multiplier;
}

function createQuality(inputRecords: number): DatasetQuality {
  return {
    inputRecords,
    acceptedRecords: 0,
    rejectedRecords: 0,
    missingFieldCount: 0,
    invalidOhlcCount: 0,
    duplicateTimestampCount: 0,
    outOfOrderCount: 0,
    timeGaps: [],
    issues: [],
  };
}

export function normalizeCandles(
  rows: CandleRow[],
  options: NormalizeOptions,
): NormalizationResult {
  const quality = createQuality(rows.length);
  const parsed: Array<{ candle: NormalizedCandle; timestampMs: number; sourceRow: number }> = [];
  const seenTimestamps = new Set<number>();
  let previousSourceTimestamp: number | null = null;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawTimestamp = readField(row, FIELD_ALIASES.timestamp);
    const timestampMs = parseTimestamp(rawTimestamp);
    const requiredValues = ["open", "high", "low", "close"] as const;
    const values = Object.fromEntries(
      requiredValues.map((field) => [field, parseNumber(readField(row, FIELD_ALIASES[field]))]),
    ) as Record<(typeof requiredValues)[number], number | null>;
    let rejected = false;

    if (timestampMs === null) {
      quality.issues.push({
        code: "invalid_timestamp",
        row: rowNumber,
        field: "timestamp",
        message: "Timestamp must be an ISO date/time or Unix seconds/milliseconds value.",
      });
      rejected = true;
    }

    for (const field of requiredValues) {
      const rawValue = readField(row, FIELD_ALIASES[field]);
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        quality.missingFieldCount += 1;
        quality.issues.push({
          code: "missing_field",
          row: rowNumber,
          field,
          message: `${field} is required.`,
        });
        rejected = true;
      } else if (values[field] === null) {
        quality.issues.push({
          code: "invalid_number",
          row: rowNumber,
          field,
          message: `${field} must be a finite number.`,
        });
        rejected = true;
      }
    }

    if (timestampMs !== null) {
      if (previousSourceTimestamp !== null && timestampMs < previousSourceTimestamp) {
        quality.outOfOrderCount += 1;
      }
      previousSourceTimestamp = timestampMs;

      if (seenTimestamps.has(timestampMs)) {
        quality.duplicateTimestampCount += 1;
        quality.issues.push({
          code: "duplicate_timestamp",
          row: rowNumber,
          field: "timestamp",
          message: "Duplicate timestamps are rejected.",
        });
        rejected = true;
      }
      seenTimestamps.add(timestampMs);
    }

    const { open, high, low, close } = values;
    if (
      open !== null &&
      high !== null &&
      low !== null &&
      close !== null &&
      (high < Math.max(open, close) || low > Math.min(open, close) || high < low)
    ) {
      quality.invalidOhlcCount += 1;
      quality.issues.push({
        code: "invalid_ohlc",
        row: rowNumber,
        message: "OHLC relationships are invalid: high/low do not contain open and close.",
      });
      rejected = true;
    }

    if (rejected || timestampMs === null || open === null || high === null || low === null || close === null) {
      quality.rejectedRecords += 1;
      return;
    }

    const rawVolume = readField(row, FIELD_ALIASES.volume);
    const volume = rawVolume === undefined || rawVolume === null || rawVolume === "" ? null : parseNumber(rawVolume);
    if (rawVolume !== undefined && rawVolume !== null && rawVolume !== "" && volume === null) {
      quality.issues.push({
        code: "invalid_number",
        row: rowNumber,
        field: "volume",
        message: "Volume must be a finite number when provided.",
      });
    }

    const rawVolumeType = readField(row, FIELD_ALIASES.volumeType);
    const volumeType: VolumeType =
      rawVolumeType === "base" || rawVolumeType === "quote" ? rawVolumeType : "unknown";

    parsed.push({
      timestampMs,
      sourceRow: rowNumber,
      candle: {
        instrument: options.instrument,
        timeframe: options.timeframe,
        timestamp: new Date(timestampMs).toISOString(),
        open,
        high,
        low,
        close,
        volume,
        volumeType,
        source: options.source ?? "cli-input",
      },
    });
  });

  parsed.sort((a, b) => a.timestampMs - b.timestampMs);
  quality.acceptedRecords = parsed.length;

  const expectedSeconds = timeframeSeconds(options.timeframe);
  if (expectedSeconds !== null) {
    for (let index = 1; index < parsed.length; index += 1) {
      const previous = parsed[index - 1];
      const current = parsed[index];
      const actualSeconds = (current.timestampMs - previous.timestampMs) / 1_000;
      if (actualSeconds > expectedSeconds * 1.5) {
        quality.timeGaps.push({
          from: previous.candle.timestamp,
          to: current.candle.timestamp,
          expectedSeconds,
          actualSeconds,
        });
      }
    }
  }

  // Sorting creates a stable chronological view without hiding the original order issue.
  return {
    candles: parsed.map(({ candle }) => candle),
    quality,
  };
}