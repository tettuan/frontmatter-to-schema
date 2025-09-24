---
c1: "debug"
c2: "plan-logger"
c3: "debug-strategy"
title: "BreakdownLoggerを用いたテストコードデバッグ戦略実装"
description: "Deno DDDプロジェクトにjsr:@tettuan/breakdownloggerを活用してテストコードのデバッグ出力を強化し、体系的なテストデバッグ戦略を確立する実装手順"
usage: "inspector-debug plan-logger debug-strategy"
options:
  input:
    - "test-config"
    - "component-list"
    - "json"
  adaptation:
    - "default"
    - "comprehensive"
    - "minimal"
  input_file: true
  stdin: false
  destination: true
variables:
  - uv-test-scope: テスト範囲（unit/integration/e2e）を指定する変数
  - uv-debug-level: デバッグレベル（debug/info/warn/error）を指定する変数
  - uv-component-key: 対象コンポーネントのキー名を指定する変数
version: "1.1"
date: "2025-09-25"
created_by: "inspector-debug plan-logger debug-strategy"
---

# BreakdownLoggerを用いたテストコードデバッグ戦略実装指示書

## 概要

Deno
DDDプロジェクトで`jsr:@tettuan/breakdownlogger`を活用し、テストデバッグ戦略を確立する実装手順。環境変数制御、構造化ログ、パフォーマンス分析により問題の迅速な特定と解決を実現。

## 前提情報

BreakdownLoggerはテスト専用デバッグライブラリ（メイン実装での利用禁止）

- **環境**: Deno/TypeScript/JSR、DDD/TDD/Totality原則、83/83テスト通過
- **テスト**: Unit/Integration/E2E、カバレッジ80%以上、`deno test --allow-all`
- **機能**: LOG_KEY/LOG_LENGTH/LOG_LEVEL環境変数、JSON出力、*_test.tsのみ

## 手順

### 1. コンポーネント別ログキー定義

- **Unit**: `schema-validation`, `template-rendering`, `frontmatter-parsing`,
  `aggregation-rules`
- **Integration**: `base-property-population`, `base-property-override`,
  `pipeline-orchestrator`
- **E2E**: `cli-basic`, `cli-validation`, `end-to-end-flow`
- **Comparison**: `jmespath-filter-comparison`,
  `directive-processing-comparison`, `template-variable-comparison`,
  `data-flow-comparison`

### 2. BreakdownLogger統合パターン

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";
const logger = new BreakdownLogger("{uv-component-key}");

// データ構造分析
logger.debug("分析", { keys: Object.keys(data), size: data.length });

// フロー追跡
logger.info("実行", { step: "processing", input: pattern });

// エラー記録
logger.error("失敗", { error: error.message, context: "validation" });
```

### 3. 戦略的比較デバッグ

```typescript
// 処理前後の比較
logger.debug("前", { count: data.length, sample: data[0] });
const processed = applyProcessing(data);
logger.debug("後", {
  count: processed.length,
  ratio: `${data.length}→${processed.length}`,
});

// フィルタ有無の比較
const noFilter = processWithoutFilter(data);
const filtered = processWithFilter(data, expr);
logger.info("比較", {
  noFilter: noFilter.length,
  filtered: filtered.length,
  reduction: `${((1 - filtered.length / noFilter.length) * 100).toFixed(1)}%`,
});
```

### 4. 環境変数制御

```bash
LOG_LEVEL={uv-debug-level}  # debug/info/warn/error
LOG_KEY={uv-component-key}   # コンポーネント絞り込み
LOG_LENGTH=S|L|W             # 出力長: Short/Long/Whole

# 実行例
LOG_KEY=schema-validation LOG_LENGTH=W deno test tests/unit/
```

### 5. 問題特定プロセス

1. **失敗特定**: `LOG_LEVEL=error`
2. **比較実行**: `LOG_KEY=*-comparison LOG_LEVEL=debug deno test *comparison*`
3. **絞り込み**: `LOG_KEY={component}`で範囲限定
4. **詳細分析**: `LOG_LENGTH=W`で完全出力
5. **差分特定**: 比較結果から問題箇所を特定

### 6. 比較テスト戦略

**A/B比較**:

```typescript
const resultA = processA(data);
const resultB = processB(data);
logger.info("比較", {
  A: resultA.length,
  B: resultB.length,
  diff: findDiff(resultA, resultB),
});
```

**段階的比較**:

```typescript
const stages = [
  { name: "initial", data: original },
  { name: "processed", data: process(original) },
  { name: "final", data: finalize(processed) },
];
logger.info("段階分析", {
  flow: stages.map((s) => `${s.name}:${s.data.length}`).join("→"),
});
```

**実行例**:

```bash
# 比較テスト実行
LOG_KEY=jmespath-filter-comparison LOG_LENGTH=W deno test *comparison_test.ts
LOG_KEY=*-comparison deno test tests/integration/*comparison*
```

## 成果物

- **テストファイル**: BreakdownLogger統合済みコード
- **比較テストスイート**:
  `*-comparison_test.ts`群（処理段階比較、データフロー追跡）

## 参照資料

- [AI複雑化防止](docs/development/ai-complexity-control.md)、[全域性原則](docs/development/totality.md)
- [BreakdownLogger統合](docs/tests/breakdownlogger-integration.md)、[テストデバッグ戦略](docs/tests/test-debugging-strategy.md)
- [@tettuan/breakdownlogger公式](https://jsr.io/@tettuan/breakdownlogger)

## DoD

- [ ] 不変条件（再現性≥95%、曖昧語≤2%、用語統一100%）
- [ ] BreakdownLogger統合・環境変数制御の動作確認
- [ ] 比較テスト実装・問題特定50%高速化・データフロー可視化完全性
