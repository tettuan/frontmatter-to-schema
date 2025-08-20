# DDD & Totality リファクタリング - 理解と分析

## 1. 核心概念の理解

### 1.1 Totality (全域性原則)
- **目的**: 部分関数を全域関数に変換し、型システムで「ありえない状態」を排除
- **主要パターン**:
  - Discriminated Union（タグ付きユニオン）
  - Smart Constructor（制約付き値型）
  - Result型によるエラー値化
  - `switch`文による網羅的分岐

### 1.2 Domain-Driven Design
- **Schema可変性**: 実行時にSchemaを注入・切り替え可能
- **境界設計**:
  - Schema非依存コア（不変領域）
  - Schema注入層（実行時決定）
  - 動的Schema管理層
  - 実行時構成層

### 1.3 AI複雑化制御
- **エントロピー制御**: 複雑性の自然増大を抑制
- **重力制御**: 関連機能の適切な凝集
- **収束制御**: 既存パターンへの収束

## 2. 現在のアーキテクチャ理解

### 2.1 層構成
```
Application Layer (CLI Handler, Config Loader, Error Logger)
    ↓
Domain Services (Registry Builder, Analysis Pipeline, Schema Mapper)
    ↓
Domain Entities (File System, Frontmatter Analysis, Command Mapping)
    ↓
Infrastructure Layer (Deno File Reader, Claude API, JSON Writer)
```

### 2.2 主要ドメインエンティティ
- **PromptFile**: パスとコンテンツ、コマンド構造を持つ
- **FrontmatterData**: Markdownのフロントマター情報
- **CommandStructure**: c1(domain), c2(directive), c3(layer)の階層構造
- **RegistryEntry**: コマンドレジストリのエントリ

## 3. リファクタリング方針

### 3.1 Totality適用箇所
1. **オプショナルプロパティの排除**
   - 現状: `{ a?: X; b?: Y }` のような不明確な状態
   - 改善: Discriminated Unionによる明確な状態表現

2. **エラーハンドリングの改善**
   - 現状: `null`/`undefined`を返す部分関数
   - 改善: Result型による明示的なエラー値化

3. **Smart Constructorの導入**
   - 現状: 無制限な値を許可する型
   - 改善: 制約付き値型による不正状態の排除

### 3.2 DDD境界の明確化
1. **Schema非依存コアの分離**
   - FrontMatter抽出
   - ファイル発見
   - 純粋な処理エンジン

2. **Schema注入層の確立**
   - 実行時Schema注入ポイント
   - Schema適用エンジン
   - Template適用エンジン

3. **動的Schema管理**
   - Schemaローダー
   - Schema切り替えマネージャー
   - アクティブSchema管理

## 4. 実装計画

### 4.1 優先順位
1. **Phase 1**: 型安全性の強化（Totality）
   - Result型の導入
   - Smart Constructorの実装
   - Discriminated Unionへの変換

2. **Phase 2**: ドメイン境界の整理（DDD）
   - Schema非依存コアの抽出
   - 注入層の実装
   - 動的管理層の構築

3. **Phase 3**: テストとCI
   - 単体テストの更新
   - 統合テストの修正
   - CI/CDパイプラインの検証

### 4.2 リスク管理
- **既存機能の保持**: 段階的リファクタリングで機能を維持
- **テスト駆動**: 各変更前後でテストを実行
- **複雑性監視**: エントロピー計算による複雑性制御

## 5. 次のステップ
1. 現在の実装ファイルを調査
2. リファクタリング対象ファイルのリスト作成
3. 各ファイルの修正実施
4. テストの更新と実行