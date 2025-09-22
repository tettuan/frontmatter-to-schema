---
# XML変換メタデータ
workflow:
  id: "schema-structure-detector-debug"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-schema-structure-detector-{timestamp}.log"
  - evidence: "tmp/evidence-schema-structure-detector.json"
---

# Schema Structure Detector Debug Workflow

## 目的

SchemaStructureDetectorのハードコーディング問題（Issue
#936）を特定し、Schema-drivenな構造検出の実装状況を検証する。

## 前提条件

- [ ] 条件1: プロジェクトルートディレクトリで実行
- [ ] 条件2: Deno環境が利用可能
- [ ] 条件3: BreakdownLogger統合済み環境
- [ ] 条件4: `src/domain/schema/services/schema-structure-detector.ts` が存在

## 入力

- **対象**: SchemaStructureDetector.detectStructureType()
- **症状**: ハードコーディングされたtools.commands構造検出
- **コンテキスト**: Issue #936で特定された柔軟性要求違反

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. SchemaStructureDetectorファイルの存在確認
2. 実行コマンド:
   `ls -la src/domain/schema/services/schema-structure-detector.ts`
3. 期待される結果: ファイルが存在する {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   `export LOG_KEY=workflow-debug-schema-structure-detector LOG_LEVEL=debug`
2. BreakdownLogger有効化確認: `echo $LOG_KEY`
3. 出力先ディレクトリ確認: `mkdir -p tmp/` {/xml:step}

### ステップ3: ハードコーディング箇所の特定

{xml:step id="step3" type="investigation"}

1. ハードコーディングパターン検索
   - 実行コマンド:
     `rg "tools.*commands" src/domain/schema/services/schema-structure-detector.ts -A 3 -B 3`
   - 確認ポイント: Line 133-139の固定パス検出
2. hasNestedProperty利用箇所確認
   - 実行コマンド:
     `rg "hasNestedProperty" src/domain/schema/services/schema-structure-detector.ts -n`
   - 確認ポイント: 固定パス配列の使用状況
3. SchemaFieldPatterns統合状況確認
   - 実行コマンド:
     `rg "SchemaFieldPatterns" src/domain/schema/services/schema-structure-detector.ts -C 5`
   - 確認ポイント: 設定可能パターンの活用度 {/xml:step}

### ステップ4: テスト実行による動作確認

{xml:step id="step4" type="diagnosis"}

1. 関連テスト実行:
   `deno test tests/unit/domain/schema/services/schema-structure-detector_test.ts --allow-all`
2. テストカバレッジ確認: ハードコーディング部分のテスト状況
3. Registry/Collection/Custom各パターンの検証結果確認 {/xml:step}

### ステップ5: 柔軟性要求との比較

{xml:step id="step5" type="resolution"}

1. 要求仕様確認:
   `cat docs/requirements.ja.md | grep "特定のパターンのみでハードコーディング" -A 3 -B 3`
2. 現状実装の問題点特定: tools.commands固定検出の影響範囲
3. x-frontmatter-part優先実装の検証: フォールバック動作の適切性確認 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-schema-structure-detector-{timestamp}.log`
- **証跡データ**: `tmp/evidence-schema-structure-detector.json`
- **解決策**: ハードコーディング除去とSchemaFieldPatterns完全活用

## 成功基準

- [ ] ハードコーディング箇所が正確に特定されている
- [ ] 設定可能パターンの実装状況が把握されている
- [ ] 要求仕様との乖離が明確化されている
- [ ] 具体的な改善方法が提示されている

## 関連ワークフロー

- [Schema Field Patterns Debug](./schema-field-patterns.workflow.md)
- [Structure Type Factory Debug](./structure-type-factory.workflow.md)
- [Issue #936 Resolution](../integration/issue-936-resolution.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: BreakdownLoggerの出力が確認できない

- **症状**: LOG_KEYが設定されているが、デバッグログが出力されない
- **原因**: LOG_LEVELが適切に設定されていない
- **解決策**: `export LOG_LEVEL=debug LOG_LENGTH=L` を実行

#### 問題2: SchemaFieldPatternsの設定が反映されない

- **症状**: 設定可能パターンが期待通りに動作しない
- **原因**: デフォルト設定の上書きが不完全
- **解決策**: createWithDefaults()の実装を確認し、設定注入ポイントを検証

#### 問題3: テスト実行でtotality違反エラー

- **症状**: テスト実行時にthrow new Errorが発生
- **原因**: Issue #937のtotality原則違反が関連
- **解決策**: Result<T,E>パターンの適用状況を先に確認
