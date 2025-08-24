# Phase 2実装計画書

## 重複処理の発見と分析

### 1. JSON/YAML解析処理の重複

**発見箇所**:

1. `src/infrastructure/adapters/simple-template-mapper.ts`
   - `parseJSONTemplate()`: line 87-93
   - `parseYAMLTemplate()`: line 95-136
2. `src/domain/template/strategies.ts`
   - `processJsonTemplate()`: line 172-201
   - `convertToYaml()`: line 317-327

### 2. プレースホルダー置換処理の重複

**発見箇所**:

1. `src/infrastructure/adapters/simple-template-mapper.ts`
   - `replacePlaceholders()`: line 203-235
2. `src/domain/template/strategies.ts`
   - `applyDataToTemplate()`: line 225-268

### 3. テンプレート読み込み処理

**発見箇所**:

1. `src/infrastructure/template/file-template-repository.ts`
   - 複数フォーマット対応: line 26-32, 62-79
   - フォーマット判定ロジック

## AI実装複雑化防止フレームワーク適用

### エントロピー計算

**現在のシステム**:

- クラス数: ~15（テンプレート関連）
- インターフェース数: ~5
- 抽象化層: 3層（Domain/Infrastructure/Application）
- 循環複雑度: ~8（平均）
- 依存深度: 4

**エントロピー**: log₂(15 × 5 × 9 × 8 × 4) ≈ 12.2

**統合後予測**:

- クラス数: ~12（共通化により-3）
- インターフェース数: ~6（新インターフェース+1）
- 抽象化層: 3層（変更なし）
- 循環複雑度: ~6（統合により単純化）
- 依存深度: 3（結合削減）

**エントロピー**: log₂(12 × 6 × 9 × 6 × 3) ≈ 10.7 **→ 改善**

### 重力制御分析

**強引力機能**（統合対象）:

- JSON解析処理（同一ドメイン・同時変更・直結データフロー）
- YAML解析処理（同一ドメイン・同時変更・直結データフロー）
- プレースホルダー処理（同一ドメイン・同時変更・直結データフロー）

**弱引力機能**（分離維持）:

- AITemplateStrategy（異なるドメイン・異なるライフサイクル）

## Phase 2実装対象ファイル

### 新規作成ファイル

1. `src/domain/template/format-handlers.ts` - 共通フォーマットハンドラ
2. `src/domain/template/placeholder-processor.ts` - プレースホルダー処理
3. `src/domain/template/processing-service.ts` - 統合処理サービス

### 修正対象ファイル

1. `src/infrastructure/adapters/simple-template-mapper.ts` - **削除予定**
2. `src/domain/template/strategies.ts` - 共通基盤使用に変更
3. `src/infrastructure/template/file-template-repository.ts` -
   解析処理を共通基盤に移行

### テスト対象ファイル

1. `tests/unit/domain/template/strategies.test.ts` - Strategy関連テスト
2. `tests/unit/infrastructure/adapters/simple-template-mapper.test.ts` -
   削除予定
3. **新規**: `tests/unit/domain/template/format-handlers.test.ts`
4. **新規**: `tests/unit/domain/template/placeholder-processor.test.ts`
5. **新規**: `tests/unit/domain/template/processing-service.test.ts`

## 実装順序（DDD+Totality原則適用）

### Step 1: 共通基盤構築

1. **TemplateFormatHandler** インターフェース作成
2. **JSONTemplateHandler**, **YAMLTemplateHandler** 実装
3. **PlaceholderProcessor** 実装
4. Smart Constructor + Result型適用

### Step 2: Strategy Pattern統合

1. **NativeTemplateStrategy** を共通基盤使用に変更
2. **SimpleTemplateMapper** 機能をStrategyに統合
3. テスト修正

### Step 3: Repository統合

1. **FileTemplateRepository** の解析処理を共通基盤に移行
2. フォーマット判定を**TemplateFormatHandler**に委譲

### Step 4: クリーンアップ

1. **SimpleTemplateMapper** 削除
2. 未使用コード削除
3. テストファイル整理

## Totality原則適用詳細

### Smart Constructor実装例

```typescript
class TemplateFormat {
  private constructor(readonly value: string) {}
  static create(format: string): Result<TemplateFormat, ValidationError> {
    if (["json", "yaml", "handlebars", "custom"].includes(format)) {
      return { ok: true, data: new TemplateFormat(format) };
    }
    return {
      ok: false,
      error: createError({
        kind: "PatternMismatch",
        value: format,
        pattern: "json|yaml|handlebars|custom",
      }),
    };
  }
}
```

### Result型による全域関数化

```typescript
interface TemplateFormatHandler {
  canHandle(format: string): boolean;
  parse(content: string): Result<unknown, ValidationError>;
  serialize(data: unknown): Result<string, ValidationError>;
}
```

### Discriminated Union適用

```typescript
type ProcessingResult =
  | { kind: "Success"; data: string; strategy: string }
  | { kind: "Failure"; error: ValidationError; strategy?: string };
```

## 完了条件

1. ✅ ドメイン駆動設計とTotality原則に基づいた改修完了
2. ✅ `deno task ci` エラー0件通過
3. ✅ エントロピー削減（12.2 → 10.7）
4. ✅ 重複処理3箇所の統合完了
5. ✅ テスト堅牢化（新規テスト追加、既存テスト修正）

## リスク分析

### 高リスク

- **AITemplateStrategy**: 既存機能への影響最小化が必要
- **既存テスト**: 大幅な修正が必要

### 中リスク

- **CompositeTemplateStrategy**: Fallback機能の保持が必要

### 低リスク

- **新規共通基盤**: 独立実装のため影響範囲限定
