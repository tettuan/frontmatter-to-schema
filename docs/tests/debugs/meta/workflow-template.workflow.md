---
# XML変換メタデータ
workflow:
  id: "workflow-template"
  type: "template"
  scope: "meta"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-{workflow-id}-{timestamp}.log"
  - evidence: "tmp/evidence-{workflow-id}.json"
---

# ワークフローテンプレート

## 目的

新規デバッグワークフローを作成するための標準テンプレートを提供する。

## 前提条件

- [ ] 条件1: デバッグ対象のコンポーネントが特定されている
- [ ] 条件2: BreakdownLoggerが統合済み
- [ ] 条件3: `tmp/` ディレクトリが存在する

## 入力

- **対象**: {デバッグ対象の特定}
- **症状**: {問題の現象}
- **コンテキスト**: {発生状況}

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. 対象コンポーネントの存在確認
2. テスト実行状況の確認: `deno test --allow-all tests/{target-scope}/`
3. 期待される結果: テスト成功/失敗の状況把握

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定: `export LOG_KEY={component-key} LOG_LEVEL=debug`
2. BreakdownLogger有効化確認
3. 出力先ディレクトリ確認: `mkdir -p tmp/`

{/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. 第1段階の調査項目
   - 実行コマンド: `{command}`
   - 確認ポイント: {check-points}
2. 第2段階の調査項目
   - 実行コマンド: `{command}`
   - 確認ポイント: {check-points}

{/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. ログ分析: `{log-analysis-method}`
2. 症状パターン確認: {pattern-matching}
3. 根本原因仮説: {hypothesis}

{/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. 仮説検証: {verification-method}
2. 解決策適用: {solution-implementation}
3. 結果確認: {result-verification}

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-{workflow-id}-{timestamp}.log`
- **証跡データ**: `tmp/evidence-{workflow-id}.json`
- **解決策**: {solution-summary}

## 成功基準

- [ ] 問題の根本原因が特定されている
- [ ] 解決策が実装され、検証されている
- [ ] デバッグプロセスが完全に記録されている
- [ ] 再現手順が他者によって実行可能

## 関連ワークフロー

- [前処理ワークフロー](./prerequisite.workflow.md)
- [エラーハンドリング](./error-handling.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: ログ出力が表示されない

- **症状**: デバッグ情報が出力されない
- **原因**: 環境変数が設定されていない
- **解決策**: `export LOG_LEVEL=debug` を実行

#### 問題2: テスト失敗の原因が特定できない

- **症状**: テストが失敗するが詳細が不明
- **原因**: 適切なログキーが設定されていない
- **解決策**: `export LOG_KEY={specific-component}` で範囲を限定