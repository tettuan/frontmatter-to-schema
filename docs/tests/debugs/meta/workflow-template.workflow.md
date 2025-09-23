---
# XML変換メタデータ
workflow:
  id: "directive-debugging-template"
  type: "meta-template"
  scope: "all-directives"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
template_parameters:
  - directive_name: "{DIRECTIVE_NAME}"
  - component_scope: "{COMPONENT_SCOPE}"
  - test_files: "{TEST_FILES[]}"
  - implementation_files: "{IMPLEMENTATION_FILES[]}"
---

# Directive Debugging Workflow Template

## 概要

このテンプレートは、フロントマター処理システムにおけるすべてのディレクティブ（x-frontmatter-part, x-derived-from, x-flatten-arrays等）の統一的なデバッグワークフローを提供する。

## 対象ディレクティブ

### 実装済みディレクティブ
- **x-frontmatter-part**: フロントマター部分指定
- **x-derived-from**: 派生データ生成
- **x-flatten-arrays**: 配列フラット化

### 将来実装予定ディレクティブ
- **x-derived-unique**: 重複除去
- **x-template**: テンプレート処理
- **x-template-items**: アイテムテンプレート
- **x-template-format**: フォーマット指定

## ワークフロー適用手順

### 1. ディレクティブ固有パラメータ設定

```yaml
directive_parameters:
  name: "{DIRECTIVE_NAME}"           # e.g., "x-flatten-arrays"
  priority: "{PROCESSING_PRIORITY}"   # 1-9 (DirectiveType)
  dependencies: ["{DEP_LIST}"]       # e.g., ["frontmatter-part"]
  test_scope: "{TEST_SCOPE}"         # unit|integration|e2e
  implementation_status: "{STATUS}"   # implemented|planned|deprecated
```

### 2. BreakdownLogger設定

```bash
# ディレクティブ固有ログキー
export LOG_KEY="directive-{DIRECTIVE_NAME}-{SCOPE}"

# 例:
# export LOG_KEY="directive-x-flatten-arrays-integration"
# export LOG_KEY="directive-x-frontmatter-part-unit"
# export LOG_KEY="directive-x-derived-from-e2e"
```

### 3. 段階的デバッグプロセス

#### Phase 1: ディレクティブ発見と認識
- スキーマ内のディレクティブ検出確認
- `DirectiveProcessor.discoverDirectives()` の動作検証
- 依存関係グラフの構築確認

#### Phase 2: 処理順序解決
- `resolveProcessingOrder()` の結果確認
- トポロジカルソートの正確性検証
- 循環依存の検出確認

#### Phase 3: 個別ディレクティブ処理
- `processDirective()` の実装状況確認
- ディレクティブ固有ロジックの動作検証
- エラーハンドリングの適切性確認

#### Phase 4: 統合動作確認
- 複数ディレクティブの連携動作
- データフローの一貫性確認
- 期待結果との比較検証

## テンプレート使用例

### x-flatten-arrays ワークフロー生成

```bash
# パラメータ設定
DIRECTIVE_NAME="x-flatten-arrays"
COMPONENT_SCOPE="integration"
TEST_FILES=("tests/integration/x-flatten-arrays-directive-integration_test.ts")
IMPLEMENTATION_FILES=("src/domain/schema/services/directive-processor.ts")

# ワークフロー生成
./scripts/generate-directive-workflow.sh "$DIRECTIVE_NAME" "$COMPONENT_SCOPE"
```

### x-frontmatter-part ワークフロー生成

```bash
# パラメータ設定
DIRECTIVE_NAME="x-frontmatter-part"
COMPONENT_SCOPE="unit"
TEST_FILES=("tests/unit/domain/schema/services/directive-processor_test.ts")
IMPLEMENTATION_FILES=("src/domain/schema/services/directive-processor.ts")

# ワークフロー生成
./scripts/generate-directive-workflow.sh "$DIRECTIVE_NAME" "$COMPONENT_SCOPE"
```

## 共通デバッグパターン

### パターン1: ディレクティブ未検出

```yaml
symptoms:
  - ディレクティブが dependency graph に含まれない
  - isPresent フラグが false
investigation:
  - hasFlattenArraysDirectives() 等の検出メソッド確認
  - searchForFlattenArraysInObject() の再帰検索確認
  - スキーマ構造とディレクティブ配置の確認
```

### パターン2: 処理順序不正

```yaml
symptoms:
  - 依存関係無視した処理順序
  - 循環依存エラー
investigation:
  - DirectiveType.getDependencies() の戻り値確認
  - topologicalSort() のアルゴリズム確認
  - buildDependencyGraph() の完全性確認
```

### パターン3: 実装不備

```yaml
symptoms:
  - "FEATURE: ... not yet implemented" メッセージ
  - ok(data) による何もしない処理
investigation:
  - processDirective() switch文の実装状況
  - 個別処理メソッドの存在確認
  - エラーハンドリングの適切性
```

### パターン4: データ変換エラー

```yaml
symptoms:
  - 期待と異なる出力構造
  - FrontmatterData作成失敗
investigation:
  - データ変換ロジックの正確性
  - FrontmatterDataFactory.fromParsedData() の動作
  - 中間データ構造の確認
```

## 共通検証項目

### 機能検証
- [ ] ディレクティブ検出の正確性
- [ ] 処理順序の正当性
- [ ] 個別処理の実装完了度
- [ ] エラーハンドリングの完全性
- [ ] データ変換の正確性

### 品質検証
- [ ] テストカバレッジの十分性
- [ ] パフォーマンスの受容性
- [ ] メモリ使用量の適切性
- [ ] エラーメッセージの明確性
- [ ] ログ出力の有用性

### 統合検証
- [ ] 他ディレクティブとの連携
- [ ] 全体パイプラインでの動作
- [ ] 複雑なスキーマでの動作
- [ ] エッジケースの処理
- [ ] 回帰テストの通過

## 関連リソース

### 実装ファイル
- `src/domain/schema/services/directive-processor.ts` - メイン実装
- `src/domain/schema/value-objects/directive-type.ts` - ディレクティブ型定義
- `src/domain/schema/validators/directive-validator.ts` - 検証ロジック

### テストファイル
- `tests/unit/domain/schema/services/directive-processor_test.ts` - ユニットテスト
- `tests/integration/x-flatten-arrays-directive-integration_test.ts` - 統合テスト
- `tests/e2e/` - エンドツーエンドテスト

### ドキュメント
- `docs/architecture/schema-directives-specification.md` - ディレクティブ仕様
- `docs/domain/schema-domain.md` - スキーマドメイン設計
- `docs/tests/testing_guidelines.md` - テスト方針