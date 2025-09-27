---
# XML変換メタデータ
workflow:
  id: "hardcoding-violation-analysis"
  type: "architecture-analysis"
  scope: "domain-services"
  version: "1.0"
  xml_convertible: true
dependencies:
  - inspector-debug: "@climpt/inspector-debug@^1.0.0"
  - environment_vars: ["DEBUG_LEVEL", "DEBUG_COMPONENTS"]
template_parameters:
  - service_name: "FrontmatterTransformationService"
  - violation_type: "file-extension-hardcoding"
  - affected_files: ["7 directive handlers", "transformation service"]
---

# ハードコーディング違反分析ワークフロー

## 概要

このワークフローは、Issue
#1081で特定されたハードコーディング違反（ファイル拡張子の直接記述）を分析し、
設計原則に基づく解決策を導出するためのデバッグプロセスを定義する。

## 違反概要

### 特定された違反パターン

#### パターン1: ファイル拡張子の直接チェック

```typescript
// 🚫 違反コード例
if (path.endsWith(".json")) { /* ... */ }
if (path.endsWith(".yml") || path.endsWith(".yaml")) { /* ... */ }
if (path.endsWith(".md")) { /* ... */ }
```

#### パターン2: extractConfig実装の重複

- 7つのディレクティブハンドラーで同一実装
- DRY原則違反
- 保守性の低下

## 分析対象ファイル

### 主要対象

1. **src/domain/frontmatter/services/frontmatter-transformation-service.ts**
   - 2333行、89 if文
   - 複雑性の主要因子

2. **ディレクティブハンドラー群**
   - 7ファイルでextractConfig重複実装
   - ファイル拡張子ハードコーディング

## デバッグワークフロー

### Phase 1: 違反箇所の完全特定

#### 1.1 ファイル拡張子ハードコーディング検索

```bash
# 全違反箇所の洗い出し
inspector-debug search-pattern file-extension-checks
rg '\.endsWith\("\.(json|yml|yaml|md)"\)' src/
rg 'path.*\.(json|yml|yaml|md)' src/
```

#### 1.2 extractConfig重複実装の特定

```bash
# extractConfig実装の重複調査
rg -A 10 -B 5 'extractConfig.*=' src/
rg 'function.*extractConfig' src/
```

#### 1.3 設計原則違反の分類

- **ハードコーディング違反**: 設定値の直接記述
- **DRY違反**: 同一ロジックの重複実装
- **SRP違反**: 単一責任原則の逸脱可能性

### Phase 2: 設計影響分析

#### 2.1 依存関係分析

```bash
# 影響範囲の特定
inspector-debug dependency-graph hardcoding-violations
mcp__serena__find_referencing_symbols extractConfig src/
```

#### 2.2 複雑性計測

```bash
# 複雑性メトリクス取得
inspector-debug complexity-metrics transformation-service
# if文カウント、循環複雑度、認知複雑度
```

#### 2.3 設計負債評価

- **技術負債**: 保守コスト増大
- **変更リスク**: 拡張性の制限
- **テスト負債**: カバレッジ困難性

### Phase 3: 解決策設計

#### 3.1 ファイル拡張子管理の抽象化

```typescript
// 💡 解決案: FileExtensionRegistry
interface FileExtensionRegistry {
  isJsonFile(path: string): boolean;
  isYamlFile(path: string): boolean;
  isMarkdownFile(path: string): boolean;
  getSupportedExtensions(): string[];
}
```

#### 3.2 設定抽出の共通化

```typescript
// 💡 解決案: ConfigurationExtractor
interface ConfigurationExtractor {
  extractConfig<T>(
    source: unknown,
    extractor: ConfigExtractor<T>,
  ): Result<T, ConfigExtractionError>;
}
```

#### 3.3 複雑性分散戦略

- **Strategy Pattern**: 処理戦略の分離
- **Chain of Responsibility**: 段階的処理
- **Dependency Injection**: 依存性の外部化

### Phase 4: 実装リスク評価

#### 4.1 変更影響範囲

- **直接影響**: 7ディレクティブハンドラー
- **間接影響**: テストスイート全体
- **副次影響**: パフォーマンス特性

#### 4.2 移行計画立案

1. **Phase 1**: FileExtensionRegistry導入
2. **Phase 2**: ConfigurationExtractor共通化
3. **Phase 3**: FrontmatterTransformationService分割
4. **Phase 4**: 統合テスト実行

#### 4.3 品質保証戦略

- **回帰テスト**: 434テスト維持
- **パフォーマンステスト**: 既存性能維持
- **段階的移行**: 機能別分離

## 検証チェックリスト

### 設計原則準拠性

- [ ] ハードコーディング完全排除
- [ ] DRY原則遵守（重複実装ゼロ）
- [ ] SRP遵守（単一責任の明確化）
- [ ] OCP遵守（拡張性確保）
- [ ] DIP遵守（依存性逆転）

### Totality原則準拠性

- [ ] 不正状態の型レベル排除
- [ ] Result<T,E>パターン完全適用
- [ ] 例外安全性確保
- [ ] 網羅性チェック完了

### パフォーマンス影響

- [ ] 実行時間回帰なし
- [ ] メモリ使用量増大なし
- [ ] I/O効率維持
- [ ] キャッシュ効果確認

### 保守性改善

- [ ] コード行数削減効果
- [ ] 循環複雑度改善
- [ ] 可読性向上確認
- [ ] テスタビリティ向上

## 関連Issue

### メインIssue

- **Issue #1081**: ハードコーディング違反とサービス複雑性
- **Issue #1074**: FrontmatterTransformationService複雑性（89 if文）

### 関連Issue

- **Issue #1080**: 設計負債とリファクタリング計画
- **Issue #1082**: パフォーマンス最適化方針

### 前提Issue

- **Issue #1084**: Console出力のドメイン層からの排除（完了）
- **Issue #1089**: パフォーマンステスト回帰（完了）

## 実行コマンド

### 初期調査

```bash
# 違反パターン全調査
inspector-debug analyze-deep hardcoding-violations

# 複雑性詳細分析
inspector-debug complexity-deep transformation-service
```

### 継続監視

```bash
# 週次品質チェック
inspector-debug quality-gate weekly-check

# 回帰防止監視
inspector-debug regression-watch hardcoding-patterns
```

## 期待成果

### 短期成果（1週間以内）

- ハードコーディング違反箇所の完全特定
- 解決策設計の完了
- 実装計画の策定

### 中期成果（1ヶ月以内）

- FileExtensionRegistry導入完了
- ConfigurationExtractor共通化完了
- 複雑性メトリクス改善確認

### 長期成果（3ヶ月以内）

- FrontmatterTransformationService分割完了
- if文数50%削減達成
- 保守性指標改善確認

## 成功基準

### 定量的指標

- **if文数**: 89 → 45以下（50%削減）
- **ファイル行数**: 2333 → 1500以下（35%削減）
- **循環複雑度**: 現状値の30%削減
- **重複コード**: ゼロ実現

### 定性的指標

- **可読性**: 新規開発者理解時間短縮
- **拡張性**: 新ディレクティブ追加容易性
- **テスタビリティ**: 単体テスト記述容易性
- **保守性**: 変更時影響範囲限定化

## 関連リソース

### 設計ドキュメント

- `docs/development/prohibit-hardcoding.ja.md` - ハードコーディング禁止規定
- `docs/development/totality.md` - Totality原則
- `docs/architecture/design-principles.md` - 設計原則

### 実装ファイル

- `src/domain/frontmatter/services/frontmatter-transformation-service.ts` -
  メイン対象
- `src/domain/schema/services/directive-processor.ts` - ディレクティブ処理
- `src/domain/shared/value-objects/` - 共通値オブジェクト

### テストファイル

- `tests/integration/frontmatter-transformation_test.ts` - 統合テスト
- `tests/unit/domain/frontmatter/services/` - ユニットテスト
- `tests/performance/performance-benchmark_test.ts` - パフォーマンステスト
