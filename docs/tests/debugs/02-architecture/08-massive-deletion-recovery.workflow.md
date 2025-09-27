---
workflow:
  id: "massive-deletion-recovery-1096"
  type: "critical-recovery"
  scope: "architecture"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-deletion-recovery-{timestamp}.log"
  - evidence: "tmp/evidence-deletion-recovery.json"
---

# 大規模削除によるビルド破壊からの復旧ワークフロー

## 目的

Issue
#1096で報告された93ファイルの削除による197個の型エラーと完全なビルド失敗からシステムを復旧させる

## 前提条件

- [ ] Git履歴へのアクセス権限
- [ ] 削除されたファイルのバックアップまたは復元可能性
- [ ] 型定義の修正権限

## 入力

- **対象**: 93個の削除されたファイル、197個の型エラー
- **症状**: ビルド完全失敗、テスト実行不可
- **コンテキスト**: リファクタリング後の大規模削除

## ワークフロー手順

### ステップ1: 現状把握

{xml:step id="step1" type="verification"}

1. 削除ファイルリストの確認
   ```bash
   git status --short | grep "^ D" | wc -l
   git status --short | grep "^ D" > tmp/deleted-files.txt
   ```

2. 型エラーの全体把握
   ```bash
   deno check src/**/*.ts 2>&1 | grep -E "TS[0-9]+" | head -100 > tmp/type-errors.txt
   ```

3. 影響範囲の特定
   ```bash
   grep -r "RecoveryStrategyRegistry" src/ --include="*.ts" | wc -l
   grep -r "Aggregator.createWithDisabledCircuitBreaker" src/ tests/ --include="*.ts"
   ```

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定
   ```bash
   export LOG_KEY=deletion-recovery
   export LOG_LEVEL=debug
   export LOG_LENGTH=L
   ```

2. バックアップ作成
   ```bash
   git stash
   git branch backup-before-recovery
   ```

{/xml:step}

### ステップ3: 段階的復旧

{xml:step id="step3" type="investigation"}

1. 削除ファイルの分類
   - ドメイン層: aggregation/, recovery/, transformation/
   - アプリケーション層: strategies/
   - テスト: *_test.ts

2. 依存関係の分析
   ```bash
   # RecoveryStrategyRegistryの参照箇所
   grep -r "RecoveryStrategyRegistry" src/ --include="*.ts" -l

   # ProcessingOptionsの型定義確認
   grep -r "interface ProcessingOptions" src/ --include="*.ts"
   ```

3. 復旧優先順位の決定
   - Critical: RecoveryStrategyRegistry, ProcessingOptions
   - High: Aggregator, PipelineStrategyConfig
   - Medium: その他のドメインサービス {/xml:step}

### ステップ4: 問題解決

{xml:step id="step4" type="diagnosis"}

1. 削除ファイルの復元または代替実装
   ```bash
   # 削除前の状態を確認
   git show HEAD~10:src/domain/recovery/services/recovery-strategy-registry.ts
   ```

2. インターフェース修正
   - ProcessingOptionsに`kind`プロパティ追加
   - TemplateResolutionConfigの型定義修正

3. 参照の更新
   - import文の修正
   - メソッド呼び出しの更新 {/xml:step}

### ステップ5: 検証

{xml:step id="step5" type="resolution"}

1. 型チェック実行
   ```bash
   deno check src/**/*.ts
   ```

2. テスト実行
   ```bash
   deno task test
   ```

3. CI確認
   ```bash
   deno task ci
   ```

{/xml:step}

## 出力

- **復旧済みファイル数**: 目標93ファイル
- **解決済み型エラー数**: 目標197エラー
- **ビルド成功**: 完全復旧

## 成功基準

- [ ] すべての型エラーが解消されている
- [ ] テストが正常に実行できる
- [ ] CIパイプラインが成功する
- [ ] 削除されたファイルが復元または代替実装されている

## 関連ワークフロー

- [リファクタリング検証](./02-frontmatter-transformation-refactoring.workflow.md)
- [レイヤー依存分析](./03-layered-architecture-dependency-analysis.workflow.md)
- [サービス複雑度分析](./04-service-complexity-analysis.workflow.md)

## トラブルシューティング

### 問題1: 削除ファイルの復元不可

- **症状**: Gitから復元できない
- **原因**: コミット前に削除された
- **解決策**: 同等の機能を新規実装

### 問題2: 循環依存の発生

- **症状**: import循環エラー
- **原因**: 復元時の依存関係不整合
- **解決策**: インターフェース分離による依存関係整理
