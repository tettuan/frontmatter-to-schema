---
workflow:
  id: "service-decomposition-2292-lines"
  type: "refactoring"
  scope: "architecture"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-service-decomposition-{timestamp}.log"
  - evidence: "tmp/evidence-service-decomposition.json"
---

# FrontmatterTransformationService分解ワークフロー

## 目的

2292行のモノリシックサービスを5つの責任別サービスに分解し、DDD原則準拠とif文削減（94→20）を達成する。

## 前提条件

- [ ] 条件1: 最新のfeature/issue-1080-ddd-tdd-comprehensive-refactorブランチ
- [ ] 条件2: 環境変数設定（LOG_KEY=service-decomposition）
- [ ] 条件3: バックアップ作成済み

## 入力

- **対象**: FrontmatterTransformationService（2292行、94個のif文）
- **症状**: 単一責任原則違反、高複雑度
- **コンテキスト**: Issue #1093による緊急リファクタリング

## ワークフロー手順

### ステップ1: 現状分析

{xml:step id="step1" type="verification"}

1. 行数と責任の確認
   ```bash
   wc -l src/domain/frontmatter/services/frontmatter-transformation-service.ts
   grep -n "async\|public\|private" src/domain/frontmatter/services/frontmatter-transformation-service.ts | wc -l
   ```

2. if文の分布確認
   ```bash
   grep -n "if (" src/domain/frontmatter/services/frontmatter-transformation-service.ts | wc -l
   ```

3. 期待される結果: 2292行、94個のif文の確認 {/xml:step}

### ステップ2: 責任分離設計

{xml:step id="step2" type="investigation"}

1. 5つの責任に分離
   - FileProcessingService: ファイル読み込み・リスト処理（~400行）
   - ValidationService: スキーマ検証・ルール調整（~400行）
   - AggregationService: データ集約・派生フィールド（~500行）
   - TemplateProcessingService: テンプレート処理・変数置換（~500行）
   - ErrorHandlingService: エラー処理・リカバリ（~492行）

2. インターフェース定義
   ```typescript
   interface ServiceDecomposition {
     fileProcessing: FileProcessingService;
     validation: ValidationService;
     aggregation: AggregationService;
     templateProcessing: TemplateProcessingService;
     errorHandling: ErrorHandlingService;
   }
   ```

{/xml:step}

### ステップ3: 段階的抽出

{xml:step id="step3" type="implementation"}

1. FileProcessingService抽出
   ```bash
   # 対象メソッド: processFiles, processFilesInBatches, processFilesInParallel
   LOG_KEY=extract-file-processing LOG_LEVEL=debug deno test tests/unit/domain/frontmatter/services/
   ```

2. ValidationService抽出
   ```bash
   # 対象メソッド: adjustValidationRules, validateFrontmatter
   LOG_KEY=extract-validation LOG_LEVEL=debug deno test tests/unit/domain/frontmatter/services/
   ```

3. 各サービスで20行以下のif文制限を確認 {/xml:step}

### ステップ4: 統合テスト

{xml:step id="step4" type="diagnosis"}

1. 分解後の統合確認
   ```bash
   deno test --allow-all tests/integration/
   ```

2. パフォーマンス比較
   ```bash
   LOG_KEY=performance-comparison deno bench
   ```

3. if文削減の確認（94→20以下） {/xml:step}

### ステップ5: 完了確認

{xml:step id="step5" type="resolution"}

1. 各サービスが500行以下であることを確認
2. if文が各サービスで20個以下であることを確認
3. 全テストが通過することを確認 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-service-decomposition-{timestamp}.log`
- **証跡データ**: `tmp/evidence-service-decomposition.json`
- **解決策**: 5サービス分解によるDDD準拠アーキテクチャ

## 成功基準

- [ ] FrontmatterTransformationServiceが5サービスに分解されている
- [ ] 各サービスが500行以下
- [ ] 各サービスのif文が20個以下
- [ ] 全テストが通過

## 関連ワークフロー

- [未使用サービス統合](./06-unused-services-integration.workflow.md)
- [ハードコーディング違反分析](./05-hardcoding-violation-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 循環依存の発生

- **症状**: import時にCircular dependency detected
- **原因**: サービス間の相互参照
- **解決策**: インターフェース分離またはDependency Injection

#### 問題2: テスト失敗の増加

- **症状**: 分解後に既存テストが失敗
- **原因**: 責任分離による処理フローの変更
- **解決策**: モックの更新とテストの再構築
