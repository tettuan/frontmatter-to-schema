# ドメイン設計とTotality理解レポート

## Totality原則の理解

### 核心理念

**部分関数を全域関数に変換**し、型システムで「ありえない状態」を排除する。

### 基本パターン

1. **Discriminated Union**:
   オプショナルプロパティ（`{a?: X; b?: Y}`）をタグ付きユニオン（`{kind: "A"; data: X} | {kind: "B"; data: Y}`）に変換
2. **Smart Constructor**: 制約のある値型（ValidRate, LayerType等）をprivate
   constructorとstatic createで実装
3. **Result型**: `T | null`を`Result<T, E>`に変換してエラーも値化

### エラー処理パターン

```typescript
type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };
type ValidationError =
  | { kind: "OutOfRange"; value: unknown; min?: number; max?: number }
  | { kind: "InvalidRegex"; pattern: string }
  | { kind: "PatternMismatch"; value: string; pattern: string }
  | { kind: "ParseError"; input: string };
```

## AI実装複雑化防止フレームワーク

### 科学的制御原理

1. **エントロピー増大制御**:
   複雑性指標計算（クラス数×インターフェース数×抽象化層²×循環複雑度×依存深度）
2. **重力の法則**: 機能間引力による凝集制御
3. **統計的収束**: 既存パターン優先、発散の早期検出

### 制御メカニズム

- 新実装前の必須チェック: エントロピー測定、影響予測、閾値比較
- 強引力機能の統合、弱引力機能の分離
- 既存成功パターン優先使用

## ドメイン境界設計

### コアドメイン（重複処理統合対象）

#### CD4: テンプレート管理ドメイン

- **責務**: 解析テンプレートの管理と適用
- **集約ルート**: `TemplateRepository`
- **ライフサイクル**: 中期（設定変更まで）

### 重複処理箇所

1. **JSON/YAML解析処理** → TemplateFormatHandlerで統一化
2. **プレースホルダー置換処理** → PlaceholderProcessorで共通化
3. **テンプレート読み込み処理** → TemplateRepositoryに集約

## Phase 2 実装方針

### 統合戦略

Template Management Domain (CD4) を中心として：

1. **共通基盤構築**
   - `TemplateFormatHandler` インターフェース
   - `JSONTemplateHandler`, `YAMLTemplateHandler` 実装
   - `PlaceholderProcessor` 共通化

2. **Strategy Pattern活用**
   - 既存 `TemplateProcessingStrategy` を活用
   - `NativeTemplateStrategy` を共通基盤に移行
   - `AITemplateStrategy` 現状維持

3. **重複コード削除**
   - `SimpleTemplateMapper` 機能をStrategyに統合
   - `FileTemplateRepository` 解析処理を共通基盤に移行
   - 未使用コード削除

### Totality原則適用

- Smart Constructor パターンで制約値型作成
- Result型で全処理結果表現
- Discriminated Union で状態明確化
- エラーハンドリング統一化

### AI実装複雑化防止適用

- エントロピー計算: 現在システム測定 → 提案実装影響予測
- 重力制御: 強引力機能（同一ドメイン・同時変更）を統合
- 収束制御: 既存成功パターン優先、類似実装統一化
