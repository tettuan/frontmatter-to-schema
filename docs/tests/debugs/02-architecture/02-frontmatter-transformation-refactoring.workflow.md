---
workflow:
  id: "frontmatter-transformation-refactoring"
  type: "refactor"
  scope: "architecture"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-refactor-transformation-{timestamp}.log"
  - evidence: "tmp/evidence-transformation-complexity.json"
---

# FrontmatterTransformationService責任分離リファクタリング

## 目的

114個の分岐を持つFrontmatterTransformationServiceをDDD原則に従い、責任分離を行う（Issue
#1059）

## 前提条件

- [ ] Denoランタイムがインストールされている
- [ ] プロジェクトルートからコマンドを実行できる
- [ ] 全テスト（405件）が成功している状態

## 入力

- **対象**: FrontmatterTransformationService
- **症状**: 114分岐、20+依存関係、単一責任原則違反
- **コンテキスト**: DDD境界の混在、高結合

## ワークフロー手順

### ステップ1: 現状分析

{xml:step id="step1" type="verification"}

1. 分岐数の確認:
   ```bash
   grep -c "if\|switch\|case" src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```

2. 依存関係の確認:
   ```bash
   grep "^import" src/domain/frontmatter/services/frontmatter-transformation-service.ts | wc -l
   ```

3. 責任領域の特定:
   ```bash
   grep -o "class.*Service\|interface.*Service" src/domain/frontmatter/services/*.ts | sort | uniq
   ```

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   ```bash
   export LOG_KEY=transformation-refactor LOG_LEVEL=debug LOG_LENGTH=L
   ```

2. テスト実行前の状態保存:
   ```bash
   deno test --allow-all > tmp/test-before-refactor.log 2>&1
   ```

{/xml:step}

### ステップ3: 責任分離の実施

{xml:step id="step3" type="investigation"}

1. 責任の識別:
   - FrontmatterExtraction: 抽出責任
   - SchemaValidation: 検証責任
   - AggregationProcessing: 集約責任
   - TransformationCoordination: 調整責任

2. インターフェース定義:
   ```typescript
   interface FrontmatterExtractionResponsibility {
     extract(document: MarkdownDocument): Result<FrontmatterData, DomainError>;
   }
   ```

3. 責任クラスの作成:
   - 各責任を独立したクラスへ分離
   - 30分岐以下を目標

{/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. 循環依存の検出:
   ```bash
   deno run --allow-read scripts/detect-circular-deps.ts src/domain/frontmatter/
   ```

2. 結合度の測定:
   ```bash
   inspector-debug analyze coupling-metric frontmatter-transformation
   ```

3. テストカバレッジ確認:
   ```bash
   deno test --coverage=tmp/coverage src/domain/frontmatter/
   ```

{/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. リファクタリング後のテスト:
   ```bash
   deno test --allow-all > tmp/test-after-refactor.log 2>&1
   ```

2. 分岐数の再確認:
   ```bash
   for file in src/domain/frontmatter/services/*Responsibility.ts; do
     echo "$file: $(grep -c "if\|switch\|case" $file)"
   done
   ```

3. 統合テスト確認:
   ```bash
   deno test tests/integration/ --allow-all
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-refactor-transformation-*.log`
- **証跡データ**: `tmp/evidence-transformation-complexity.json`
- **解決策**: 4つの責任クラスへの分離

## 成功基準

- [ ] 各責任クラスの分岐が30個以下
- [ ] 全405テストが継続して成功
- [ ] 循環依存が存在しない
- [ ] ドメイン境界が明確に定義されている

## 関連ワークフロー

- [Totality検証](./01-totality-verification.workflow.md)
- [ドメイン境界検証](../03-features/domain-boundary-check.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: テスト失敗

- **症状**: リファクタリング後にテストが失敗
- **原因**: インターフェース変更による互換性破壊
- **解決策**: アダプターパターンでの互換性維持

#### 問題2: 循環依存

- **症状**: コンパイルエラーまたは実行時エラー
- **原因**: 責任分離が不完全
- **解決策**: 依存性逆転の原則適用
