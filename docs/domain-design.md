# ドメイン設計書

## 1. ドメイン境界の定義

### 1.1 コアドメイン

**Registry Domain（レジストリドメイン）**

- 責任：C3Lコマンドレジストリの構築と管理
- 主要概念：
  - Registry: コマンドレジストリ全体
  - Command: 個別のC3Lコマンド定義
  - Schema: レジストリのスキーマ定義

### 1.2 サポートドメイン

**Prompt Domain（プロンプトドメイン）**

- 責任：プロンプトファイルの管理と探索
- 主要概念：
  - PromptFile: プロンプトファイル
  - PromptList: プロンプトファイルのコレクション

**FrontMatter Domain（フロントマタードメイン）**

- 責任：フロントマターの抽出と解析
- 主要概念：
  - FrontMatter: フロントマターデータ
  - Extractor: フロントマター抽出器

**Analysis Domain（解析ドメイン）**

- 責任：Claude APIを使用した情報解析
- 主要概念：
  - Analyzer: 解析エンジン
  - AnalysisResult: 解析結果

## 2. アーキテクチャ設計

### 2.1 レイヤー構造

```
Application Layer
├── CLI/Scripts
└── Use Cases

Domain Layer
├── Registry Domain
├── Prompt Domain
├── FrontMatter Domain
└── Analysis Domain

Infrastructure Layer
├── File System
├── Claude API Client
└── JSON Serializer
```

### 2.2 モジュール構成

```
src/
├── domain/
│   ├── registry/
│   │   ├── Registry.ts
│   │   ├── Command.ts
│   │   └── Schema.ts
│   ├── prompt/
│   │   ├── PromptFile.ts
│   │   └── PromptList.ts
│   ├── frontmatter/
│   │   ├── FrontMatter.ts
│   │   └── Extractor.ts
│   └── analysis/
│       ├── Analyzer.ts
│       └── AnalysisResult.ts
├── application/
│   ├── usecases/
│   │   ├── BuildRegistryUseCase.ts
│   │   ├── ExtractFrontMatterUseCase.ts
│   │   └── AnalyzePromptUseCase.ts
│   └── services/
│       └── RegistryBuilder.ts
├── infrastructure/
│   ├── filesystem/
│   │   ├── FileReader.ts
│   │   └── FileWriter.ts
│   ├── claude/
│   │   └── ClaudeApiClient.ts
│   └── serialization/
│       └── JsonSerializer.ts
└── interfaces/
    └── cli/
        └── main.ts
```

### 2.3 データフロー

1. PromptList生成（Prompt Domain）
2. FrontMatter抽出（FrontMatter Domain）
3. 情報解析（Analysis Domain + Claude API）
4. Registry構築（Registry Domain）
5. JSON出力（Infrastructure）

## 3. 設計原則

### 3.1 DDD原則

- 各ドメインは独立した境界を持つ
- ドメインロジックはドメイン層に集約
- インフラストラクチャへの依存を反転

### 3.2 SOLID原則

- 単一責任の原則：各クラスは単一の責任を持つ
- 開放閉鎖の原則：拡張に開かれ、修正に閉じる
- 依存性逆転の原則：抽象に依存し、具象に依存しない
