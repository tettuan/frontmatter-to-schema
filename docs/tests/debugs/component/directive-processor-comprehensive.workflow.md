---
# XML変換メタデータ
workflow:
  id: "directive-processor-comprehensive-debug"
  type: "component-debug"
  scope: "directive-processor"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-directive-processor-{timestamp}.log"
  - evidence: "tmp/evidence-directive-processor.json"
  - analysis: "tmp/analysis-directive-processor.md"
target_directives:
  implemented:
    - x-frontmatter-part
    - x-derived-from
    - x-flatten-arrays
  planned:
    - x-derived-unique
    - x-template
    - x-template-items
    - x-template-format
---

# DirectiveProcessor Comprehensive Debugging Workflow

## 目的

DirectiveProcessor クラスの全ディレクティブ処理機能を包括的にデバッグし、実装状況、処理フロー、品質問題を体系的に特定・解決する。

## 対象範囲

### 実装ファイル
- **メイン**: `src/domain/schema/services/directive-processor.ts`
- **型定義**: `src/domain/schema/value-objects/directive-type.ts`
- **検証**: `src/domain/schema/validators/directive-validator.ts`

### テストファイル
- **ユニット**: `tests/unit/domain/schema/services/directive-processor_test.ts`
- **統合**: `tests/integration/x-flatten-arrays-directive-integration_test.ts`
- **E2E**: `tests/e2e/` (該当ファイル)

## 前提条件

- [ ] TypeScript型チェック成功確認
- [ ] BreakdownLogger依存関係確認
- [ ] 全テスト実行環境準備完了
- [ ] Issue #1010 の問題把握済み

## ワークフロー手順

### ステップ1: 全体アーキテクチャ確認

{xml:step id="step1" type="verification"}

1. DirectiveProcessor クラス構造分析
   ```bash
   # BreakdownLogger設定
   export LOG_KEY=directive-processor-architecture
   export LOG_LEVEL=debug
   export LOG_LENGTH=L
   ```

2. 主要メソッドの実装状況確認
   - `resolveProcessingOrder()` - 処理順序解決
   - `processDirectives()` - ディレクティブ処理実行
   - `discoverDirectives()` - ディレクティブ発見
   - `buildDependencyGraph()` - 依存関係グラフ構築
   - `topologicalSort()` - トポロジカルソート

3. 各ディレクティブ固有メソッドの実装状況
   - `processFlattenArraysDirective()` - ✅ 実装済み（バグあり）
   - `processFrontmatterPartDirective()` - ❌ 未実装（返り値 ok(data)）
   - `processDerivedFromDirective()` - ❌ 未実装（返り値 ok(data)）

{/xml:step}

### ステップ2: ディレクティブ発見メカニズムの検証

{xml:step id="step2" type="investigation"}

#### 2.1 スキーマ解析能力の確認

```bash
export LOG_KEY=directive-discovery
```

1. **x-frontmatter-part 発見**
   - `schema.findFrontmatterPartPath()` の動作確認
   - スキーマ内の extensions フィールド検索能力

2. **x-derived-from 発見**
   - `hasDerivationDirectives()` の実装確認
   - ValidationRules を通じた間接検出の妥当性

3. **x-flatten-arrays 発見**
   - `hasFlattenArraysDirectives()` の動作確認
   - `searchForFlattenArraysInObject()` の再帰検索精度

#### 2.2 依存関係グラフ構築の検証

1. DirectiveType の依存関係定義確認
   ```typescript
   // 各ディレクティブの getDependencies() 戻り値確認
   - frontmatter-part: []
   - derived-from: ["frontmatter-part"]
   - flatten-arrays: ["frontmatter-part"]
   ```

2. Missing dependency placeholder の適切な生成確認

{/xml:step}

### ステップ3: 処理順序解決の検証

{xml:step id="step3" type="investigation"}

```bash
export LOG_KEY=processing-order
```

#### 3.1 トポロジカルソートの正確性

1. Kahn's algorithm 実装の確認
   - InDegree 計算の正確性
   - Adjacency list 構築の正確性
   - Queue 処理の正確性

2. 循環依存検出の確認
   - 不完全なソート結果の検出
   - エラーメッセージの明確性

#### 3.2 フェーズグループ化の妥当性

1. Processing priority による適切なグループ化
   ```
   Priority 1: Data Structure Foundation (frontmatter-part)
   Priority 3: Array Flattening (flatten-arrays)
   Priority 5: Field Derivation (derived-from)
   ```

2. フェーズ実行順序の論理的妥当性

{/xml:step}

### ステップ4: 個別ディレクティブ処理の詳細分析

{xml:step id="step4" type="diagnosis"}

#### 4.1 x-flatten-arrays 処理の詳細デバッグ

```bash
export LOG_KEY=x-flatten-arrays-detailed
```

**問題症状**: Issue #1010 - 期待される配列フラット化が機能しない

**詳細調査項目**:
1. `processFlattenArraysDirective()` のデータフロー
   - 入力データ構造の確認
   - `applyFlattenArraysToData()` の実行結果
   - `FrontmatterDataFactory.fromParsedData()` の成功/失敗

2. `collectFlattenDirectives()` の動作確認
   - スキーマから正しいディレクティブターゲット抽出
   - `{ target: string }` 構造の適切な生成

3. `getNestedProperty()` / `setNestedProperty()` の動作確認
   - ドット記法パス解決の正確性
   - 深いネスト構造での動作

4. `flattenArray()` 再帰アルゴリズムの検証
   - ネストした配列の完全フラット化
   - 非配列要素の適切な保持

#### 4.2 x-frontmatter-part 処理の実装ギャップ

```bash
export LOG_KEY=x-frontmatter-part-implementation
```

**現在の状況**: 未実装（返り値 `ok(data)`）

**実装要求分析**:
1. フロントマター部分指定の機能要件確認
2. 既存の `schema.findFrontmatterPartPath()` との連携方法
3. データ抽出・分離ロジックの設計必要性

#### 4.3 x-derived-from 処理の実装ギャップ

```bash
export LOG_KEY=x-derived-from-implementation
```

**現在の状況**: 未実装（返り値 `ok(data)`）

**実装要求分析**:
1. 派生データ生成の機能要件確認
2. ValidationRules との連携方法
3. 依存データからの計算ロジック設計必要性

{/xml:step}

### ステップ5: 統合テストとエンドツーエンド検証

{xml:step id="step5" type="integration"}

```bash
export LOG_KEY=directive-integration
```

#### 5.1 複数ディレクティブ連携テスト

1. frontmatter-part + flatten-arrays の連携
2. derived-from + flatten-arrays の連携
3. 全ディレクティブ同時使用時の動作

#### 5.2 実際のスキーマでの動作確認

1. 複雑なスキーマ構造での動作テスト
2. エッジケース（存在しないプロパティ、型不一致等）の処理
3. パフォーマンス測定（大量データでの処理時間）

{/xml:step}

### ステップ6: 修正実装と検証

{xml:step id="step6" type="resolution"}

#### 6.1 優先度付き修正計画

**Priority 1: x-flatten-arrays バグ修正**
- Issue #1010 の根本原因修正
- 3つの失敗テストの解決

**Priority 2: 未実装ディレクティブの段階的実装**
- x-frontmatter-part の基本実装
- x-derived-from の基本実装

**Priority 3: エラーハンドリング強化**
- より詳細なエラーメッセージ
- デバッグ情報の充実

#### 6.2 修正後の包括的検証

1. 全ディレクティブテストの実行
   ```bash
   deno test --allow-all tests/unit/domain/schema/services/directive-processor_test.ts
   deno test --allow-all tests/integration/x-flatten-arrays-directive-integration_test.ts
   ```

2. 回帰テスト実行
   ```bash
   deno test --allow-all
   ```

3. 型チェック確認
   ```bash
   deno check src/**/*.ts
   ```

{/xml:step}

## 出力成果物

### デバッグレポート
- **ログファイル**: `tmp/debug-directive-processor-{timestamp}.log`
- **証跡データ**: `tmp/evidence-directive-processor.json`
- **分析レポート**: `tmp/analysis-directive-processor.md`

### 修正計画
- **即座修正**: x-flatten-arrays バグ修正
- **短期実装**: 未実装ディレクティブの基本機能
- **中長期改善**: パフォーマンス最適化とエラーハンドリング強化

## 成功基準

### 機能的基準
- [ ] x-flatten-arrays の3つの失敗テストが成功
- [ ] 384の既存テストが継続成功
- [ ] 未実装ディレクティブの基本動作確認

### 品質基準
- [ ] TypeScript型チェック継続成功
- [ ] テストカバレッジ80%以上維持
- [ ] パフォーマンス劣化なし（±5%以内）

### ドキュメント基準
- [ ] デバッグプロセス完全記録
- [ ] 修正内容の明確な文書化
- [ ] 今後の実装ガイドライン整備

## 実行スクリプト

```bash
#!/bin/bash
# scripts/debug-directive-processor-comprehensive.sh

echo "=== DirectiveProcessor Comprehensive Debugging ==="

# Environment setup
mkdir -p tmp/
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "=== Phase 1: Architecture Analysis ==="
export LOG_KEY=directive-processor-architecture
export LOG_LEVEL=debug
export LOG_LENGTH=L

deno check src/domain/schema/services/directive-processor.ts

echo "=== Phase 2: Discovery Mechanism ==="
export LOG_KEY=directive-discovery
deno test --allow-all tests/unit/domain/schema/services/directive-processor_test.ts

echo "=== Phase 3: Processing Order ==="
export LOG_KEY=processing-order
# Add specific order testing

echo "=== Phase 4: Individual Directives ==="
export LOG_KEY=x-flatten-arrays-detailed
deno test --allow-all tests/integration/x-flatten-arrays-directive-integration_test.ts

echo "=== Phase 5: Integration Testing ==="
export LOG_KEY=directive-integration
deno test --allow-all

echo "=== Results ==="
echo "Debug logs: tmp/debug-directive-processor-${TIMESTAMP}.log"
echo "Analysis: tmp/analysis-directive-processor.md"
```