---
workflow:
  id: "cli-command-interface-debug"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-cli-command-{timestamp}.log"
  - evidence: "tmp/evidence-cli-command.json"
---

# CLI Command Interface Debug Workflow

## 目的

CLI
コマンドインターフェースの不整合問題を特定し、要求仕様と実装のギャップを解決する。

## 前提条件

- [ ] Deno実行環境が利用可能
- [ ] プロジェクトルートで実行
- [ ] examples/0.basic/ ディレクトリが存在

## 入力

- **対象**: CLI command detection logic (src/presentation/cli/index.ts)
- **症状**: "Unknown command" エラーでexamplesが実行不可
- **コンテキスト**: Schema-firstパターンとCommand-firstパターンの不整合

## ワークフロー手順

### ステップ1: 現状確認

{xml:step id="step1" type="verification"}

1. エラーの再現:
   ```bash
   sh ./examples/0.basic/run.sh
   ```
2. 期待結果: `❌ Unknown command: examples/0.basic/registry_schema.json`
3. CLIヘルプ確認:
   ```bash
   ./cli.ts --help
   ```

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   ```bash
   export LOG_KEY=cli-command LOG_LEVEL=debug
   ```
2. デバッグ用ディレクトリ作成:
   ```bash
   mkdir -p tmp/
   ```
3. テストファイル作成準備 {/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. **コマンドパターン分析**:
   - 現在のCLI実装確認: `src/presentation/cli/index.ts` (lines 44-63)
   - 引数パース確認: parseProcessArgs() (lines 109-136)

2. **要求仕様確認**:
   - Schema x-template指定: `docs/requirements.ja.md`
   - テンプレート自動解決要求確認

3. **実行パターン比較**:
   ```bash
   # Pattern 1: Command-first (現在の実装)
   ./cli.ts process <schema> <template> <input> <output>

   # Pattern 2: Schema-first (exampleの期待)
   ./cli.ts <schema> <input> <output>
   ```

{/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. **ログ分析**:
   - コマンド検出ロジックの制約
   - ハードコーディングされたswitch文

2. **症状パターン確認**:
   - 全exampleスクリプトが同じパターンで失敗
   - テンプレート引数の欠落

3. **根本原因仮説**:
   - CLI実装がschema内x-template指定を無視
   - コマンドパターンの抽象化不足 {/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. **仮説検証**:
   - Schemaファイル内のx-template確認
   - PipelineOrchestratorのtemplate解決能力確認

2. **解決策適用**:
   - Auto-detect pattern実装
   - Schema-based template resolution追加

3. **結果確認**:
   ```bash
   # 修正後の実行確認
   sh ./examples/0.basic/run.sh
   # 期待: 正常実行完了
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-cli-command-{timestamp}.log`
- **証跡データ**: `tmp/evidence-cli-command.json`
- **解決策**: コマンドパターン抽象化とschema-based template resolution

## 成功基準

- [ ] examples/0.basic/run.sh が正常実行
- [ ] examples/3.docs/run.sh が正常実行
- [ ] Schema内x-templateが自動解決
- [ ] 両方のコマンドパターンがサポートされる

## 関連ワークフロー

- [Template Resolution](./template-variable-resolution.workflow.md)
- [Directive Processing](./directive-processor-comprehensive.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: Template path not found

- **症状**: テンプレートファイルが見つからない
- **原因**: x-template指定の相対パス解決失敗
- **解決策**: Schema相対パスでtemplate解決

#### 問題2: Backward compatibility

- **症状**: 既存スクリプトの動作不良
- **原因**: Command-firstパターンの破壊
- **解決策**: 両パターンのサポート維持
