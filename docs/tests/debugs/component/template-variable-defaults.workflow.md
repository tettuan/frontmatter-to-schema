---
workflow:
  id: "template-variable-defaults"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-template-defaults-{timestamp}.log"
  - evidence: "tmp/evidence-template-defaults.json"
---

# Template Variable Defaults Resolution Workflow

## 目的

テンプレート変数がスキーマのデフォルト値で置換されない問題（Issue
#1055）を調査・解決する

## 前提条件

- [ ] Denoランタイムがインストールされている
- [ ] プロジェクトルートからコマンドを実行できる
- [ ] `examples/0.basic/` ディレクトリが存在する
- [ ] `tmp/` ディレクトリが書き込み可能

## 入力

- **対象**: テンプレート変数解決処理
- **症状**: `{version}`, `{description}` が空文字列として出力される
- **コンテキスト**: スキーマにデフォルト値が定義されているが適用されない

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. テストデータの確認:
   ```bash
   ls -la examples/0.basic/*.json examples/0.basic/*.md
   ```

2. スキーマのデフォルト値確認:
   ```bash
   grep -A2 '"default":' examples/0.basic/registry_schema.json
   ```

3. テンプレート変数の確認:
   ```bash
   grep -o '{[^}]*}' examples/0.basic/registry_template.json
   ```

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   ```bash
   export LOG_KEY=template-defaults LOG_LEVEL=debug LOG_LENGTH=L
   ```

2. デバッグ出力ディレクトリ作成:
   ```bash
   mkdir -p tmp/
   ```

3. 既存出力のクリア:
   ```bash
   rm -f tmp/test-output.json tmp/debug-*.log
   ```

{/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. CLI実行とログ収集:
   ```bash
   ./cli.ts examples/0.basic/registry_schema.json "examples/0.basic/*.md" tmp/test-output.json --verbose 2>&1 | tee tmp/debug-cli-output.log
   ```

2. PrepareDataCommand の処理確認:
   ```bash
   grep -A5 -B5 "PrepareDataCommand\|data-preparing" tmp/debug-cli-output.log
   ```

3. テンプレート変数解決の確認:
   ```bash
   grep -A3 -B3 "variable-resolution\|replaceVariables\|template-render" tmp/debug-cli-output.log
   ```

4. FrontmatterData の内容確認:
   ```bash
   grep -A10 "mainDataKeys\|frontmatterDataKeys" tmp/debug-cli-output.log
   ```

{/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. 出力ファイルの確認:
   ```bash
   jq '.' tmp/test-output.json
   ```

2. 期待値との比較:
   ```bash
   diff -u <(jq '.' examples/0.basic/output.json) <(jq '.' tmp/test-output.json)
   ```

3. デフォルト値の適用有無確認:
   - PrepareDataCommand でスキーマのデフォルト値が FrontmatterData
     に含まれていない
   - TemplateVariableResolver で `data.get("version")` が失敗している
   - variable-replacer.ts:117-118 でプレースホルダーがそのまま返される

4. 根本原因仮説:
   - スキーマのデフォルト値がデータ準備段階で適用されていない
   - BasePropertyPopulator がデフォルト値を正しく設定していない {/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. 一時的な修正の適用（PrepareDataCommandでデフォルト値追加）:
   ```typescript
   // src/application/pipeline/commands/prepare-data-command.ts
   // Line 63-64の後に追加
   const defaultValues = this.extractDefaultValues(schema);
   const mergedData = this.mergeDefaults(mainData, defaultValues);
   ```

2. 修正後の再実行:
   ```bash
   ./cli.ts examples/0.basic/registry_schema.json "examples/0.basic/*.md" tmp/test-output-fixed.json --verbose
   ```

3. 結果確認:
   ```bash
   jq '.version, .description' tmp/test-output-fixed.json
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-cli-output.log`
- **証跡データ**: `tmp/test-output.json`
- **解決策**: PrepareDataCommand でスキーマデフォルト値を FrontmatterData に適用

## 成功基準

- [ ] 問題の根本原因（デフォルト値の未適用）が特定されている
- [ ] 修正後、`{version}` が "1.0.0" として出力される
- [ ] 修正後、`{description}` が適切な値として出力される
- [ ] デバッグプロセスが完全に記録されている
- [ ] 再現手順が他者によって実行可能

## 関連ワークフロー

- [Schema Validation Workflow](./schema-validation.workflow.md)
- [Template Rendering Workflow](./template-rendering.workflow.md)
- [Pipeline Orchestrator Workflow](../integration/pipeline-orchestrator.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: デバッグログが出力されない

- **症状**: LOG_KEY設定後もログが表示されない
- **原因**: BreakdownLoggerが有効化されていない
- **解決策**: 環境変数の確認と再設定

#### 問題2: テンプレート変数が {variable} のまま出力される

- **症状**: 変数がプレースホルダーのまま残る
- **原因**: FrontmatterData にキーが存在しない
- **解決策**: データ準備段階でのデフォルト値適用を確認
