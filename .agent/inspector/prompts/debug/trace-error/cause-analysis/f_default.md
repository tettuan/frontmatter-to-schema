---
c1: "debug"
c2: "trace-error"
c3: "cause-analysis"
title: "エラー実装へのデバッグ出力追加と要因分析"
description: "エラー実装にデバッグ出力を追加し、出力情報を元に根本要因を分析するための体系的手順書。DDD/TDD/Totality原則に基づくエラー処理実装の分析・改善作業"
usage: "inspector-debug trace-error cause-analysis"
options:
  input:
    - "error-log"
    - "json"
    - "text"
  adaptation:
    - "default"
    - "comprehensive"
    - "quick-analysis"
  input_file: true
  stdin: true
  destination: true
variables:
  - uv-error-component: 対象のエラー処理コンポーネント名
  - uv-analysis-scope: 分析対象とするエラーの範囲または条件
  - input_text_file: 分析対象のエラーログファイルパス
  - destination_path: 分析結果の出力先パス
version: "2.0"
date: "2025-09-25"
created_by: "climpt-docs generate-robust instruction-doc"
---

# エラー実装へのデバッグ出力追加と要因分析手順書

## 背景と意図

### なぜこの指示書が必要か

エラー発生時の根本原因特定には、適切なデバッグ情報の収集と体系的な分析が不可欠。本指示書は、DDD/TDD/Totality原則に基づく本プロジェクトのエラー処理実装に対し、効果的なデバッグ出力を追加し、収集した情報から迅速に原因を特定するための標準手順を定義する。

### デバッグ戦略との連携

本指示書は以下のデバッグ戦略ドキュメントと連携して使用する：

- **[BreakdownLogger統合ガイド](docs/tests/breakdownlogger-integration.md)**:
  テスト専用デバッグツール
- **[テストデバッグ戦略](docs/tests/test-debugging-strategy.md)**:
  環境変数制御とログレベル設定
- **[比較テスト戦略](docs/tests/test-debugging.md)**:
  問題特定のための比較分析手法

**重要な制約**:
BreakdownLoggerはテストコード（`*_test.ts`ファイル）でのみ使用可能。本番コードでは動作しないため、エラー分析は必ずテストファイルを作成して実施する。

### 適用範囲

- ✅ ドメインエラー（DomainError）の原因分析
- ✅ バリデーションエラーの詳細追跡
- ✅ Result<T,E>パターンでのエラー伝播分析
- ❌ インフラレベルの運用監視（スコープ外）

---

## 核心原則（守るべき不変条件）

1. **型安全性保持**: デバッグ出力追加で既存の型システムを破壊しない
2. **構造化必須**: 全デバッグ情報をJSON形式で構造化出力
3. **性能維持**: ログレベル制御で性能劣化を5%以内に抑制
4. **機密保護**: パスワード・トークン等をログから完全排除
5. **Result<T,E>一貫性**: エラーパターンとの整合性維持

## 前提条件と制約

### 必要な知識

- TypeScript/Deno環境の基本理解
- DomainErrorとResult<T,E>パターンの理解
- テストファイル（`*_test.ts`）の作成能力
- [BreakdownLogger統合](docs/tests/breakdownlogger-integration.md)の制約理解

### 禁止事項

- ❌ 本番コードでのBreakdownLogger使用（テストコード専用、本番では動作しない）
- ❌ console.log等の直接出力
- ❌ 既存エラー型の破壊的変更
- ❌ 機密情報のログ出力

## システム構造の概要

### エラー処理アーキテクチャ

```
DomainError (基底型)
├── ValidationError
├── SchemaError
├── FrontmatterError
└── TemplateError

作成関数:
- createError()
- createContextualError()
- createEnhancedError()
```

### ログシステム構成

詳細は[テストデバッグ戦略](docs/tests/test-debugging-strategy.md)を参照。

- **ログレベル**: `LOG_LEVEL=error|warn|info|debug`
- **環境変数制御**: `LOG_KEY`, `LOG_LENGTH`による絞り込み

---

## 実装手順

### Phase 1: エラー箇所の特定

#### 1.1 対象エラーの探索

```bash
# エラー実装箇所を特定
grep -r "{uv-error-component}" src/ --include="*.ts"
grep -r "createError.*{uv-error-component}" src/

# エラー型定義の確認
grep -r "kind.*Error" src/domain/shared/types/errors.ts
```

#### 1.2 現状分析

[比較テスト戦略](docs/tests/test-debugging.md#comparison-tests)を参照し、エラー発生前後の状態を比較分析する。

```typescript
// Before: エラー発生前の状態
logger.debug("処理前", { data: inputData });

// After: エラー発生後の状態
logger.error("エラー発生", { error: error.kind, context });
```

### Phase 2: テスト経由のデバッグ実装

#### 2.1 エラー再現テストの作成

**重要**: BreakdownLoggerはテストコード（`*_test.ts`）専用のデバッグツール。
本番コードのエラーを分析する際は、必ず対応するテストファイルを作成し、
そこでBreakdownLoggerを使用してエラーコンテキストを取得する。

```typescript
// src/domain/errors/{uv-error-component}_debug_test.ts
import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { describe, it } from "jsr:@std/testing/bdd";

describe("エラーデバッグ分析", () => {
  const logger = new BreakdownLogger("{uv-error-component}-debug");

  it("should capture error context", () => {
    // エラーを再現する処理
    const result = targetFunction(problematicInput);

    if (!result.ok) {
      logger.error("エラー詳細", {
        kind: result.error.kind,
        context: result.error.context,
        input: problematicInput,
        stackTrace: new Error().stack,
      });
    }
  });
});
```

#### 2.2 本番コードのデバッグ情報埋め込み

本番コードにはBreakdownLoggerを使用できないため、
テストから取得可能なデバッグ情報を返却値に含める：

```typescript
// 本番コード側（BreakdownLoggerは使用不可）
const createDebuggableError = <T extends DomainError>(
  error: T,
  debugInfo: {
    stackTrace?: string[];
    inputData?: unknown;
    timestamp?: string;
  }
): T & { debugInfo: typeof debugInfo }

// テストコードからこのデバッグ情報を取得して分析
```

### Phase 3: エラーの収集と分析

#### 3.1 デバッグ実行

[テストデバッグ戦略](docs/tests/test-debugging-strategy.md#環境変数設定)に従って実行:

```bash
# テストファイルでのデバッグ実行（BreakdownLogger使用）
LOG_LEVEL=debug deno test --allow-all src/domain/errors/{uv-error-component}_debug_test.ts

# CLIでのデバッグ実行（環境変数制御）
LOG_LEVEL=debug LOG_KEY={uv-error-component} deno run --allow-all cli.ts

# JSON形式で保存
LOG_LEVEL=debug LOG_LENGTH=W deno run --allow-all cli.ts 2>error-debug.json
```

#### 3.2 要因分析

**比較分析パターン**（[比較テスト戦略](docs/tests/test-debugging.md#段階的比較)参照）:

1. **Before/After比較**: エラー発生前後の状態差分
2. **成功/失敗比較**: 正常系と異常系の処理フロー差分
3. **段階的分析**: 処理ステップごとのデータ変化追跡

### Phase 4: 根本原因の特定

#### 4.1 5W1H分析

- **When**: タイミング（初期化/処理中/終了時）
- **Where**: 発生箇所（ドメイン層/アプリケーション層）
- **What**: エラー種別（ValidationError/SchemaError等）
- **Why**: 直接原因（入力不正/型不整合/null参照）
- **How**: 発生経路（呼び出しスタックトレース）

#### 4.2 改善提案

1. **即時対応**: エラーハンドリングの修正
2. **予防策**: バリデーション強化
3. **監視強化**: ログレベル調整

## 成果物

### 分析レポート形式

```json
{
  "metadata": {
    "component": "{uv-error-component}",
    "scope": "{uv-analysis-scope}",
    "timestamp": "ISO8601"
  },
  "errorSummary": {
    "totalErrors": 0,
    "errorTypes": [],
    "criticalErrors": 0
  },
  "rootCause": {
    "primary": "特定された根本原因",
    "factors": ["要因1", "要因2"]
  },
  "recommendations": {
    "immediate": ["即時対応"],
    "preventive": ["予防策"]
  }
}
```

結果を`{destination_path}`へ出力する。

## チェックリスト

### 実装確認

- [ ] エラー再現テストファイル（`*_test.ts`）の作成
- [ ] BreakdownLoggerのテストコード内での実装
- [ ] デバッグ可能エラー関数の実装
- [ ] 構造化ログ出力の確認
- [ ] 環境変数制御の動作確認

### 品質保証

- [ ] 型安全性の維持（破壊的変更なし）
- [ ] パフォーマンス劣化5%以内
- [ ] 機密情報マスキング確認
- [ ] テストコードでのBreakdownLogger動作確認

## 参照資料

### プロジェクト内

- エラー型: `src/domain/shared/types/errors.ts`
- ログシステム: `src/infrastructure/logging/`

### デバッグ戦略ドキュメント

- [BreakdownLogger統合](docs/tests/breakdownlogger-integration.md)
- [テストデバッグ戦略](docs/tests/test-debugging-strategy.md)
- [比較テスト手法](docs/tests/test-debugging.md)

## DoD (Definition of Done)

✅ デバッグ出力機能が実装され、構造化ログがJSON形式で出力可能 ✅
ログレベル制御で性能影響を5%以内に抑制 ✅ 分析レポートが指定形式で出力 ✅
既存テストが全て成功
