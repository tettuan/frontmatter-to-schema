---
variables:
  - uv-test-scope: テスト範囲（unit/integration/e2e）を指定する変数
  - uv-debug-level: デバッグレベル（debug/info/warn/error）を指定する変数
  - uv-component-key: 対象コンポーネントのキー名を指定する変数
---

# BreakdownLoggerを用いたテストコードデバッグ戦略実装指示書

## 概要

本指示書は、Deno DDD プロジェクトにおいて `jsr:@tettuan/breakdownlogger`
を活用してテストコードのデバッグ出力を強化し、体系的なテストデバッグ戦略を確立するための実装手順を定義する。環境変数ベースの制御、構造化ログ、パフォーマンス分析を通じて、テスト失敗の迅速な特定と解決を実現する。

## 前提情報リスト

**プロジェクト構造**:

- Deno + TypeScript + JSR packages
- DDD, TDD, Totality, AI-complexity-control 原則
- 83/83 テスト通過、フルDDD実装済み
- `@tettuan/breakdownlogger` 依存関係導入済み

**既存テスト環境**:

- テスト分類: Unit/Integration/E2E
- カバレッジ: 80%以上を維持
- テスト実行: `deno test --allow-all`
- CI/CD: 完全自動化済み

**BreakdownLogger 機能**:

- 環境変数制御: LOG_KEY, LOG_LENGTH, LOG_LEVEL
- 構造化ログ出力: JSON フォーマット
- パフォーマンス追跡: Timer統合
- テスト専用実行: *_test.ts ファイル内のみ

## 仮定リスト

1. 既存テストファイルの修正が許可されている
2. CI/CD パイプラインでの環境変数設定が可能
3. `tmp/` ディレクトリへのデバッグ出力が許可されている
4. テスト実行時間の多少の増加が許容される

## 手順

### 1. 事前確認と準備

- 現在のテスト実行状況を確認: `deno test --allow-all`
- BreakdownLogger 依存関係の確認: `deno.json` の imports セクション
- テストディレクトリ構造の把握: `tests/unit/`, `tests/integration/`,
  `tests/e2e/`

### 2. コンポーネント別ログキー定義

以下の戦略的ログキーを `{uv-test-scope}` に応じて選択・適用:

**Unit Tests**:

- `schema-validation`: スキーマ検証ロジック
- `template-rendering`: テンプレート処理
- `frontmatter-parsing`: フロントマター抽出
- `aggregation-rules`: データ集約ロジック

**Integration Tests**:

- `base-property-population`: ベースプロパティ設定ロジック
- `base-property-override`: フロントマター上書き動作
- `pipeline-orchestrator`: 完全処理パイプライン

**E2E Tests**:

- `cli-basic`: 基本CLI機能
- `cli-validation`: CLI引数検証
- `end-to-end-flow`: 完全ワークフロー

### 3. テストコードへのBreakdownLogger統合

#### 3.1 基本Logger設定パターン

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";

const logger = new BreakdownLogger("{uv-component-key}");
```

#### 3.2 構造化デバッグパターン

**データ構造分析**:

```typescript
logger.debug("スキーマ構造分析", {
  schemaKeys: Object.keys(schemaObject),
  dataSize: JSON.stringify(schemaObject).length,
  processStep: "validation",
});
```

**フロー追跡**:

```typescript
logger.info("処理パイプライン実行", {
  schema: paths.schema,
  inputPattern: pattern,
  currentStep: "processing",
});
```

**エラーコンテキスト**:

```typescript
logger.error("操作失敗", {
  errorMessage: error.message,
  context: {
    component: "schema-validator",
    inputData: sanitizedInput,
    expectedType: "object",
  },
});
```

### 4. 環境変数ベース制御の実装

#### 4.1 デバッグレベル制御

```bash
# 全デバッグ出力
export LOG_LEVEL={uv-debug-level}

# コンポーネント絞り込み
export LOG_KEY={uv-component-key}

# 出力長制御
export LOG_LENGTH=S|L|W
```

#### 4.2 デバッグ手順作成

shで表現した例。shを量産することは好ましくない。あくまでも実行例として以下を示すものである。

`scripts/test-with-debug.sh`:

```bash
#!/bin/bash
COMPONENT_KEY=${1:-"all"}
LOG_LENGTH=${LOG_LENGTH:-"S"}
LOG_LEVEL=${LOG_LEVEL:-"info"}

LOG_KEY=$COMPONENT_KEY LOG_LENGTH=$LOG_LENGTH LOG_LEVEL=$LOG_LEVEL \
  deno test --allow-all tests/{uv-test-scope}/
```

### 5. CI/CD統合とパフォーマンス最適化

不要

#### 5.1 CI環境での制御

CIでは不要。

### 6. デバッグ戦略の運用

#### 6.1 問題特定プロセス

1. **失敗テスト特定**: `LOG_LEVEL=error` で失敗箇所確認
2. **コンポーネント絞り込み**: `LOG_KEY` で対象範囲限定
3. **詳細分析**: `LOG_LENGTH=W` で完全出力取得
4. **パフォーマンス確認**: Timer統合で実行時間測定

## 成果物定義

### 主成果物

1. **統合済みテストファイル**: BreakdownLogger導入済み全テストコード

### 付録

- **コンポーネントキー一覧**: 全ログキーとその用途
- **環境変数リファレンス**: 制御パラメータ詳細
- **トラブルシューティングガイド**: 一般的な問題と解決方法
- **パフォーマンス基準**: 許容実行時間とメモリ使用量

## 参照資料

### 必須参照（コード変更用）

- **全域性原則**: `docs/development/totality.md`
- **[AI複雑化防止（科学的制御）](docs/development/ai-complexity-control.md)**

### プロジェクト固有資料

- **[BreakdownLogger統合ガイド](docs/tests/breakdownlogger-integration.md)**:
  実装済み統合パターン
- **[テストデバッグ戦略](docs/tests/test-debugging-strategy.md)**:
  包括的デバッグアプローチ
- **[テストガイドライン](docs/tests/testing_guidelines.md)**: TDD実践と実装指針
- **[包括的テスト戦略](docs/testing.ja.md)**: 全体テストアプローチ

### 外部技術資料

- **[@tettuan/breakdownlogger](https://jsr.io/@tettuan/breakdownlogger)**:
  公式パッケージドキュメント
- **Deno テスト公式ガイド**: 基本テスト実行とベストプラクティス

## DoD (Definition of Done)

- [ ] 不変条件（再現性≥95%、曖昧語≤2%、用語統一100%、トレーサビリティ100%）を満たすこと
- [ ] 前提情報リストが網羅されていること
- [ ] 全テストコンポーネントへのBreakdownLogger統合完了
- [ ] 環境変数制御の動作確認済み
- [ ] CI/CDパイプライン統合完了
- [ ] 既存テスト通過率維持
- [ ] デバッグ出力の構造化と`tmp/`保存確認
