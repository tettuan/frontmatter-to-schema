---
workflow:
  id: "parallel-processing-debug"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-parallel-processing-{timestamp}.log"
  - evidence: "tmp/evidence-parallel-processing.json"
---

# Parallel Processing Debug Workflow

## 目的

FrontmatterTransformationService
の並列処理判定ロジックのデバッグと、PerformanceSettings との統合不整合の調査。

## 前提条件

- [ ] 条件1: BreakdownLogger が利用可能
- [ ] 条件2: 環境変数 LOG_KEY, LOG_LEVEL が設定可能
- [ ] 条件3: tmp/ ディレクトリが存在

## 入力

- **対象**: FrontmatterTransformationService の並列処理判定
- **症状**: PerformanceSettings.getMinFilesForParallel() が使用されていない
- **コンテキスト**: Issue #963 で報告された設定無視とテスト欠落

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. 現在のハードコーディング確認:
   ```bash
   grep -n "parallelThreshold: 1" src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```
2. PerformanceSettings の実装確認:
   ```bash
   grep -n "getMinFilesForParallel" src/domain/configuration/value-objects/performance-settings.ts
   ```
3. 期待される結果: 両方の実装が存在することを確認 {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   ```bash
   export LOG_KEY=parallel-processing-debug LOG_LEVEL=debug LOG_LENGTH=L
   ```
2. BreakdownLogger有効化確認
3. 出力先ディレクトリ確認:
   ```bash
   mkdir -p tmp/
   ```

{/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. 並列処理の実行パス調査:
   - 実行コマンド:
     `deno run --allow-all src/presentation/cli.ts examples/0.basic -t examples/0.basic/template.json -s examples/0.basic/schema.json`
   - 確認ポイント: 並列処理が実行されるか、閾値は何か

2. PerformanceSettings の値確認:
   - 実行コマンド: デバッグログで getMinFilesForParallel() の返り値を確認
   - 確認ポイント: 設定値が正しく取得されているか {/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. ログ分析:
   `grep "parallelThreshold\|minFilesForParallel" tmp/debug-parallel-processing-*.log`
2. 症状パターン確認:
   - ハードコーディング値 (1) が使用されている
   - PerformanceSettings の値が無視されている
3. 根本原因仮説: FrontmatterTransformationService 内で
   performanceSettings.getMinFilesForParallel() が呼ばれていない {/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. 仮説検証:
   ```bash
   grep "getMinFilesForParallel" src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```
   結果: 呼び出しが存在しない

2. 解決策適用: parallelThreshold を performanceSettings.getMinFilesForParallel()
   から取得するよう修正
3. 結果確認: 修正後、設定値に基づいて並列処理が判定されることを確認 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-parallel-processing-{timestamp}.log`
- **証跡データ**: `tmp/evidence-parallel-processing.json`
- **解決策**: performanceSettings.getMinFilesForParallel() を使用するよう修正

## 成功基準

- [ ] 問題の根本原因が特定されている（ハードコーディング）
- [ ] 解決策が実装され、検証されている
- [ ] デバッグプロセスが完全に記録されている
- [ ] 再現手順が他者によって実行可能

## 関連ワークフロー

- [パフォーマンス設定デバッグ](./performance-settings.workflow.md)
- [複雑性分析](./complexity-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 並列処理が常に実行されない

- **症状**: ファイル数に関わらず逐次処理のみ
- **原因**: parallelThreshold が 1 にハードコーディング
- **解決策**: performanceSettings.getMinFilesForParallel() を使用

#### 問題2: テストがない

- **症状**: 並列処理のテストカバレッジが 0%
- **原因**: テストが実装されていない
- **解決策**: 並列/逐次の両パスをテストするユニットテストを追加
