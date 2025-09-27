---
# XML変換メタデータ
workflow:
  id: "interface-mismatch-recovery"
  type: "debug"
  scope: "architecture"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-interface-mismatch-{timestamp}.log"
  - evidence: "tmp/evidence-interface-mismatch.json"
---

# DocumentProcessingResult インターフェース不整合の回復ワークフロー

## 目的

93ファイル削除によるリファクタリング後に発生したDocumentProcessingResultインターフェースの不整合を修復し、ビルドエラーを解消する。

## 前提条件

- [ ] 条件1: TypeScript環境の準備完了
- [ ] 条件2: GitHub Issue #1096の詳細確認済み
- [ ] 条件3: 型エラーの現状把握完了

## 入力

- **対象**: DocumentProcessingResultインターフェースの不整合
- **症状**: mainData/itemsDataプロパティが存在しないエラー（27箇所）
- **コンテキスト**: 大規模リファクタリング後の型システム破綻

## ワークフロー手順

### ステップ1: 現状確認と分析

{xml:step id="step1" type="verification"}

1. 型エラーの詳細確認
   ```bash
   deno check 2>&1 | grep -E "mainData|itemsData" | head -20
   ```
2. インターフェース定義の調査
   ```bash
   grep -r "interface DocumentProcessingResult" src/ --include="*.ts"
   ```
3. 参照箇所の特定
   ```bash
   grep -r "\.mainData\|\.itemsData" src/ --include="*.ts" -n
   ```

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定: `export LOG_KEY=interface-debug LOG_LEVEL=debug`
2. 出力先ディレクトリ確認: `mkdir -p tmp/`
3. バックアップ作成: `cp -r src/ tmp/src-backup-$(date +%Y%m%d)`

{/xml:step}

### ステップ3: インターフェース不整合の詳細調査

{xml:step id="step3" type="investigation"}

1. 各インターフェース定義の比較
   - 実行コマンド: `diff <file1> <file2> <file3>`
   - 確認ポイント: プロパティの差分、型の互換性
2. PipelineOrchestratorでの期待値調査
   - 実行コマンド:
     `grep -A 5 -B 5 "mainData\|itemsData" src/application/services/pipeline-orchestrator.ts`
   - 確認ポイント: どのような値を期待しているか
3. 実際の返却値の調査
   - 実行コマンド: `grep -A 10 "return.*DocumentProcessingResult" src/domain/`
   - 確認ポイント: 実際に返されているデータ構造

{/xml:step}

### ステップ4: 修復戦略の決定

{xml:step id="step4" type="diagnosis"}

1. 修復戦略の比較
   - Option A: インターフェースに互換プロパティ追加
   - Option B: 参照箇所をprocessedDataに変更
   - Option C: ハイブリッドアプローチ
2. 影響範囲の評価
   - 修正必要箇所: 27箇所（mainData）+ 1箇所（itemsData）
   - テストへの影響: 要確認
3. 根本原因の確定
   - 仮説: リファクタリング時の古い設計と新しい設計の混在

{/xml:step}

### ステップ5: 修復実装と検証

{xml:step id="step5" type="resolution"}

1. 推奨修復案の実装
   - DocumentProcessingResultインターフェースの統一
   - 互換性プロパティの追加
   - 型安全性の確保
2. ビルド確認
   ```bash
   deno check
   ```
3. テスト実行
   ```bash
   deno test --allow-all
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-interface-mismatch-{timestamp}.log`
- **証跡データ**: `tmp/evidence-interface-mismatch.json`
- **解決策**: DocumentProcessingResultインターフェースの統一済み

## 成功基準

- [ ] 型エラーがゼロになっている
- [ ] ビルドが成功している
- [ ] 既存テストが通過している
- [ ] インターフェースの一貫性が確保されている

## 関連ワークフロー

- [大規模削除回復](./08-massive-deletion-recovery.workflow.md)
- [型システム整合性確認](./10-type-system-consistency.workflow.md)
- [リファクタリング品質保証](./11-refactoring-quality-assurance.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 互換性プロパティ追加後もエラーが残る

- **症状**: mainData追加後も型エラーが継続
- **原因**: 型定義の不完全性または循環参照
- **解決策**: 型の明示的定義とoptionalプロパティの適切な使用

#### 問題2: テストが失敗する

- **症状**: インターフェース変更後にテストが失敗
- **原因**: テストが古いインターフェースに依存
- **解決策**: テスト側の期待値を新しいインターフェースに合わせて更新

## 修復実装詳細

### Option A: インターフェース統一案（推奨）

```typescript
// src/domain/shared/interfaces/document-processing-result.ts
export interface DocumentProcessingResult {
  // 新しい標準プロパティ
  readonly processedData: FrontmatterData[];
  readonly documents?: MarkdownDocument[];
  readonly successCount: number;
  readonly errorCount: number;
  readonly processingStrategy: "sequential" | "parallel";

  // 互換性のためのプロパティ（段階的移行用）
  readonly mainData?: unknown[];
  readonly itemsData?: unknown[];
  readonly processedCount?: number;
  readonly failedCount?: number;
  readonly duration?: number;
}
```

### 段階的移行計画

1. **Phase 1**: 統一インターフェースの定義
2. **Phase 2**: 全実装の新インターフェースへの移行
3. **Phase 3**: 互換性プロパティの段階的削除
4. **Phase 4**: 完全な新インターフェースへの移行完了
