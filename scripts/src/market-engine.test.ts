import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeMarket,
  normalizeCandles,
  type CandleRow,
} from "@workspace/market-engine";

test("normalization preserves raw rows and dataset provenance", () => {
  const rows: CandleRow[] = [
    {
      timestamp: "2026-01-01T00:00:00Z",
      open: "100",
      high: "101",
      low: "99",
      close: "100.5",
      volume: "not-a-number",
    },
    {
      timestamp: "2026-01-01T02:00:00Z",
      open: "100.5",
      high: "103",
      low: "100",
      close: "102",
      volume: "20",
    },
    {
      timestamp: "2026-01-01T01:00:00Z",
      open: "102",
      high: "103",
      low: "101",
      close: "101.5",
      volume: "18",
    },
    {
      timestamp: "2026-01-01T02:00:00Z",
      open: "102",
      high: "104",
      low: "101",
      close: "103",
      volume: "22",
    },
  ];

  const result = normalizeCandles(rows, {
    datasetId: "xauusd-training",
    datasetVersion: "2026-01-01-v1",
    instrument: "XAUUSD",
    timeframe: "1h",
    source: "fixture",
    sourceFormat: "json",
    sourceRowOffset: 1,
  });

  assert.equal(result.metadata.datasetId, "xauusd-training");
  assert.equal(result.metadata.datasetVersion, "2026-01-01-v1");
  assert.equal(result.metadata.sourceFormat, "json");
  assert.equal(result.metadata.rawRecordCount, 4);
  assert.equal(result.rawRecords.length, 4);
  assert.deepEqual(result.rawRecords[0].payload, rows[0]);
  assert.equal(result.rawRecords[0].status, "accepted");
  assert.equal(result.rawRecords[3].status, "rejected");
  assert.equal(result.candles.length, 3);
  assert.deepEqual(
    result.candles.map((candle) => candle.sourceRow),
    [1, 3, 2],
  );
  assert.equal(result.quality.acceptedRecords, 3);
  assert.equal(result.quality.rejectedRecords, 1);
  assert.equal(result.quality.errorCount, 1);
  assert.equal(result.quality.warningCount, 2);
  assert.equal(result.quality.errors[0].code, "duplicate_timestamp");
  assert.deepEqual(
    result.quality.warnings.map((warning) => warning.code),
    ["invalid_volume", "out_of_order"],
  );

  const analysis = analyzeMarket(result.candles, result.quality, result.metadata);
  assert.equal(analysis.dataset.datasetId, "xauusd-training");
  assert.equal(analysis.dataset.datasetVersion, "2026-01-01-v1");
});

test("normalization rejects malformed OHLC records without losing their raw payload", () => {
  const rows: CandleRow[] = [
    {
      timestamp: "2026-01-01T00:00:00Z",
      open: 100,
      high: 101,
      low: 98,
    },
    {
      timestamp: "2026-01-01T01:00:00Z",
      open: 100,
      high: 99,
      low: 98,
      close: 100,
    },
  ];

  const result = normalizeCandles(rows, {
    instrument: "XAUUSD",
    timeframe: "1h",
    sourceFormat: "rows",
  });

  assert.equal(result.rawRecords[0].status, "rejected");
  assert.deepEqual(result.rawRecords[0].payload, rows[0]);
  assert.equal(result.rawRecords[1].status, "rejected");
  assert.deepEqual(result.rawRecords[1].payload, rows[1]);
  assert.equal(result.candles.length, 0);
  assert.equal(result.quality.rejectedRecords, 2);
  assert.equal(result.quality.errors.some((issue) => issue.code === "missing_field"), true);
  assert.equal(result.quality.errors.some((issue) => issue.code === "invalid_ohlc"), true);
});

test("analysis enforces a completed-candle visibility boundary", () => {
  const rows: CandleRow[] = Array.from({ length: 6 }, (_, index) => {
    const hour = String(index).padStart(2, "0");
    const open = 100 + index;
    return {
      timestamp: `2026-01-01T${hour}:00:00Z`,
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      volume: 10 + index,
    };
  });
  const normalized = normalizeCandles(rows, {
    datasetId: "replay-fixture",
    datasetVersion: "v1",
    instrument: "XAUUSD",
    timeframe: "1h",
    sourceFormat: "json",
    sourceRowOffset: 1,
  });

  const analysis = analyzeMarket(
    normalized.candles,
    normalized.quality,
    normalized.metadata,
    { visibleThrough: "2026-01-01T02:00:00Z" },
  );

  assert.equal(analysis.visibility.mode, "bounded");
  assert.equal(analysis.visibility.visibleThrough, "2026-01-01T02:00:00.000Z");
  assert.equal(analysis.visibility.visibleCandleCount, 3);
  assert.equal(analysis.visibility.excludedCandleCount, 3);
  assert.equal(analysis.input.candleCount, 3);
  assert.equal(analysis.input.lastCandle, "2026-01-01T02:00:00.000Z");
  assert.equal(analysis.causality.every((record) => record.futureValuesUsed === false), true);
  assert.equal(
    analysis.evidence.every(
      (item) => Date.parse(item.timestamp) <= Date.parse(analysis.visibility.visibleThrough),
    ),
    true,
  );
  assert.match(analysis.explanation, /3 later candle\(s\) were excluded/);

  assert.throws(
    () =>
      analyzeMarket(
        normalized.candles,
        normalized.quality,
        normalized.metadata,
        { visibleThrough: "not-a-date" },
      ),
    /visibleThrough must be an ISO date\/time value/,
  );
  assert.throws(
    () =>
      analyzeMarket(
        normalized.candles,
        normalized.quality,
        normalized.metadata,
        { visibleThrough: "2025-12-31T23:00:00Z" },
      ),
    /does not include any completed candles/,
  );
});