# テンプレート処理統合計画

## 重複処理の詳細分析

### 主要な重複箇所

1. **JSON/YAML解析処理**
   - `SimpleTemplateMapper.parseJSONTemplate()`
   - `SimpleTemplateMapper.parseYAMLTemplate()`
   - `NativeTemplateStrategy.processJsonTemplate()`
   - `NativeTemplateStrategy.convertToYaml()`

2. **プレースホルダー置換処理**
   - `SimpleTemplateMapper.replacePlaceholders()`
   - `NativeTemplateStrategy.applyDataToTemplate()`

3. **テンプレート読み込み処理**
   - `FileTemplateRepository.loadFromPath()`
   - 複数フォーマット対応が分散

## ドメイン境界に基づく統合戦略

### 統合先: Template Management Domain (CD4)

**理由**:

- ドメイン境界書のCD4が「テンプレート管理と適用」を担当
- 集約ルート `TemplateRepository` を中心とした統合が適切
- ライフサイクル管理（中期・設定変更まで）に適合

### 統合アプローチ

#### 1. Template Processing Service の新設

```typescript
// Domain層に配置
class TemplateProcessingService {
  // 統合されたテンプレート処理ロジック
  process(
    template: Template,
    context: TemplateApplicationContext,
  ): Result<string, ValidationError>;
}
```

#### 2. Template Format Handler の統一

```typescript
// 共通のフォーマット処理
interface TemplateFormatHandler {
  canHandle(format: string): boolean;
  parse(content: string): Result<unknown, ValidationError>;
  serialize(data: unknown): Result<string, ValidationError>;
}

class JSONTemplateHandler implements TemplateFormatHandler { ... }
class YAMLTemplateHandler implements TemplateFormatHandler { ... }
```

#### 3. Placeholder Processor の共通化

```typescript
// プレースホルダー処理の統一
class PlaceholderProcessor {
  process(template: unknown, data: unknown): Result<unknown, ValidationError>;
}
```

## Totality原則の適用

### 現在の問題点

1. エラーハンドリングが断片化
2. null/undefined チェックが一貫していない
3. Result型の使用が部分的

### 改善方針

1. **Smart Constructor**パターンで制約のある値型を作成
2. **Result型**で全ての処理結果を表現
3. **Discriminated Union**で状態を明確化

## 実装計画

### Phase 1: 共通基盤の構築

1. `TemplateFormatHandler` インターフェースの実装
2. `PlaceholderProcessor` の実装
3. 共通エラー型の定義

### Phase 2: Strategy Pattern の活用

1. 既存の `TemplateProcessingStrategy` を活用
2. `NativeTemplateStrategy` の内部実装を共通基盤に移行
3. `AITemplateStrategy` は現状維持

### Phase 3: 重複コードの削除

1. `SimpleTemplateMapper` の機能を Strategy に統合
2. `FileTemplateRepository` の解析処理を共通基盤に移行
3. 未使用コードの削除

## 期待される効果

1. **コード重複の解消**: 3つのJSON/YAML解析処理を1つに統合
2. **保守性の向上**: テンプレート処理ロジックの一元化
3. **型安全性の強化**: Totality原則による堅牢な実装
4. **テスタビリティ**: 共通基盤によるユニットテストの簡素化
