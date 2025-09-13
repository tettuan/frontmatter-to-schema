# テンプレートドメインアーキテクチャ

## エグゼクティブサマリー

本文書は、テンプレート構築ドメインとテンプレート出力ドメインの権威あるアーキテクチャを定義し、他のすべてのシステムコンポーネントからの完全な疎結合を確立します。**すべての出力操作は例外なくこれらのドメインを経由しなければなりません。**

## 中核原則

**テンプレートゲートウェイルール**: すべてのデータ変換と出力は、テンプレート構築ドメインとテンプレート出力ドメインを通過しなければなりません。これらのドメインをバイパスする直接出力は厳格に禁止され、アーキテクチャ違反となります。

## ドメイン境界

### テンプレート構築ドメイン

**責務**: ソースデータとスキーマからのテンプレートの構築と合成

**境界定義**:
- 入力: テンプレートファイルパス（Schemaから）と値セット
- 出力: 出力準備が整ったコンパイル済みテンプレートインスタンス
- 依存関係: なし（純粋なドメインロジック）
- 利用者: テンプレート出力ドメインのみ

### テンプレート出力ドメイン

**責務**: コンパイル済みテンプレートの最終宛先へのレンダリングと配信

**境界定義**:
- 入力: テンプレート構築ドメインからのコンパイル済みテンプレートインスタンス
- 出力: 最終フォーマット済み出力（ファイル、ストリーム、レスポンス）
- 依存関係: テンプレート構築ドメインの出力契約
- 利用者: インフラストラクチャアダプターのみ

## アーキテクチャレイヤー

```
┌─────────────────────────────────────────────────────────┐
│                    外部システム                           │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│              インフラストラクチャアダプター                 │
│      （ファイルライター、APIクライアントなど）              │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ 出力への唯一のパス
                            │
┌─────────────────────────────────────────────────────────┐
│              テンプレート出力ドメイン                      │
│    ┌──────────────────────────────────────────────┐    │
│    │  OutputRenderer  │  OutputWriter  │          │    │
│    │  OutputValidator │  OutputRouter  │          │    │
│    └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ コンパイル済みテンプレートのみ
                            │
┌─────────────────────────────────────────────────────────┐
│            テンプレート構築ドメイン                        │
│    ┌──────────────────────────────────────────────┐    │
│    │  TemplateCompiler │  TemplateComposer │      │    │
│    │  TemplateValidator│  TemplateRegistry │      │    │
│    └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ テンプレートパス + 値セット
                            │
┌─────────────────────────────────────────────────────────┐
│         アプリケーションユースケース＆サービス              │
└─────────────────────────────────────────────────────────┘
```

## テンプレート構築ドメインコンポーネント

### 入力要件

テンプレート構築ドメインは正確に2つの情報を必要とします：

1. **テンプレートファイルパス**: Schemaから取得されたテンプレートファイルへのパス
2. **値セット**: テンプレートに適用される値のコレクション

### コアエンティティ

#### `TemplateSource`
```typescript
interface TemplateSource {
  templatePath: TemplateFilePath;  // Schemaからのパス
  valueSet: TemplateValueSet;       // 適用する値
}
```

#### `TemplateFilePath`
```typescript
// Schemaからのテンプレートファイルパスを表す値オブジェクト
class TemplateFilePath {
  constructor(private readonly path: string) {
    this.validate();
  }

  private validate(): void {
    if (!this.path || this.path.trim() === '') {
      throw new Error('テンプレートパスは空にできません');
    }
  }

  toString(): string {
    return this.path;
  }

  resolve(): string {
    // 必要に応じて相対パスを絶対パスに解決
    return this.path;
  }
}
```

#### `TemplateValueSet`
```typescript
// テンプレート用の値セットを表す値オブジェクト
interface TemplateValueSet {
  values: Record<string, unknown>;
  metadata?: {
    source: string;
    timestamp: Date;
    schemaVersion?: string;
  };
}
```

#### `CompiledTemplate`
```typescript
interface CompiledTemplate {
  templatePath: TemplateFilePath;
  appliedValues: TemplateValueSet;
  compiledContent: string | Buffer;
  compiledAt: Date;
  checksum: string;
  format: OutputFormat;
  validate(): Result<void, ValidationError>;
}
```

## 疎結合強制ルール

### 必須要件

1. **直接出力禁止**: すべての出力操作はテンプレート出力ドメインを経由しなければならない
2. **バイパス禁止**: 直接ファイル/API書き込みを試みるサービスはコードレビューで拒否される
3. **テンプレートコンパイル必須**: 生データは出力前にテンプレート構築ドメインでコンパイルされなければならない
4. **単一エントリポイント**: 各ドメインは外部との相互作用のために正確に1つのファサードインターフェースを公開する
5. **不変契約**: ドメインインターフェースは一度定義されたら不変
6. **Schema駆動テンプレート**: テンプレートパスはSchema定義から取得されなければならない

### 禁止パターン

❌ **直接ファイル書き込み**
```typescript
// 禁止 - テンプレートドメインをバイパス
fs.writeFileSync('output.json', JSON.stringify(data));
```

❌ **サービスからインフラストラクチャへの結合**
```typescript
// 禁止 - サービスが直接インフラストラクチャを使用
class SomeService {
  writeOutput(data: any) {
    // 直接インフラストラクチャアクセスは禁止
    return fileRepository.write(data);
  }
}
```

❌ **生データ出力**
```typescript
// 禁止 - 未処理データを出力
outputService.write(frontmatterData);
```

❌ **ハードコードされたテンプレートパス**
```typescript
// 禁止 - テンプレートパスはSchemaから取得しなければならない
const template = loadTemplate('./hardcoded/path.tmpl');
```

### 必須パターン

✅ **Schema駆動テンプレート処理**
```typescript
// 必須 - SchemaからテンプレートパスPATH、処理からの値
const templatePath = schema.getTemplatePath();
const valueSet = extractedData.toValueSet();
const template = templateBuilder.build(templatePath, valueSet);
const rendered = templateOutput.render(template, specification);
const result = templateOutput.write(rendered);
```

✅ **ドメインファサード使用**
```typescript
// 必須 - ドメインファサードを通じてのみ相互作用
class ApplicationService {
  constructor(
    private templateFacade: TemplateBuilderFacade,
    private outputFacade: TemplateOutputFacade
  ) {}

  async processDocument(
    schemaTemplatePath: string,
    values: Record<string, unknown>
  ): Promise<Result<void, Error>> {
    const templateSource = {
      templatePath: new TemplateFilePath(schemaTemplatePath),
      valueSet: { values }
    };
    const template = await this.templateFacade.buildTemplate(templateSource);
    return this.outputFacade.outputTemplate(template);
  }
}
```

## ドメインインターフェース

### テンプレートビルダーファサード

```typescript
interface TemplateBuilderFacade {
  buildTemplate(
    source: TemplateSource
  ): Promise<Result<CompiledTemplate, BuildError>>;

  composeTemplates(
    templates: CompiledTemplate[]
  ): Promise<Result<CompiledTemplate, CompositionError>>;

  validateTemplate(
    template: CompiledTemplate
  ): Result<void, ValidationError>;
}

interface TemplateSource {
  templatePath: TemplateFilePath;  // Schemaから
  valueSet: TemplateValueSet;       // データ処理から
}
```

## データフロー仕様

### 完全な処理フロー

```
1. Schemaロード
   └─→ テンプレートファイルパスの抽出

2. データ処理
   └─→ frontmatter/データから値セットの生成

3. テンプレート構築 [必須]
   ├─→ Schemaパスからテンプレートをロード
   ├─→ テンプレートに値セットを適用
   └─→ CompiledTemplateを生成

4. テンプレート出力 [必須]
   ├─→ CompiledTemplateをレンダリング
   ├─→ 出力を検証
   └─→ 宛先に書き込み

❌ いかなる直接出力パスも禁止
```

## 実装プロトコル

### クリティカルパス要件

- **テンプレート処理の整合性**: すべてのドキュメント処理は正規の`DocumentProcessor`パスを経由しなければならない
- **非推奨パスの隔離**: すべての非正規処理パスは無効化され、削除対象としてマークされなければならない
- **エンドツーエンド検証**: 統合テストは完全な処理ワークフローを検証しなければならない

### 統合標準

- **サービス境界の強制**: 単一ドメイン関心事を断片化するマイクロサービスの排除
- **設定の単一性**: ドメインごとに正確に1つの設定ロード実装を維持
- **テストパスの整合**: すべてのテストは正規処理パスのみを検証しなければならない

### ガバナンス統合

- **コードレビュー標準**: 新しいサービス作成は明示的なアーキテクチャ承認プロセスに従わなければならない
- **重複防止**: 自動アーキテクチャテストは競合する実装パターンを防がなければならない
- **文書メンテナンス**: サービス作成承認プロセスは文書化され、強制されなければならない

## コンプライアンス監視

### 自動チェック

1. **アーキテクチャテスト**: サービスからの直接インフラストラクチャアクセスを防ぐ
2. **依存関係分析**: 適切なレイヤー境界を確保
3. **出力パス検証**: すべての出力がテンプレートドメインを経由することを確認
4. **コードカバレッジ**: ドメインロジックの100%カバレッジを維持

### 手動レビュー

1. **コードレビューチェックリスト**: テンプレートドメイン使用を確認
2. **アーキテクチャレビュー**: 月次コンプライアンス監査
3. **パフォーマンスレビュー**: 四半期パフォーマンス分析
4. **セキュリティレビュー**: 半年ごとのセキュリティ評価

## 権限声明

**この文書は、すべてのテンプレート関連操作の必須アーキテクチャを確立します。** いかなる逸脱も以下を必要とします：

1. 書面によるアーキテクチャ正当化
2. 影響分析文書
3. コンプライアンスのための移行計画
4. テクニカルリードからの承認
5. この文書の更新

**このアーキテクチャの違反は以下の結果をもたらします：**
- 即座のコードレビュー拒否
- マージ前の必須リファクタリング
- アーキテクチャコンプライアンストレーニング要件

---

**作成日**: 2025年12月
**権限**: 正規アーキテクチャドキュメント
**強制**: 必須 - 例外は許可されません
**レビュースケジュール**: 四半期ごと