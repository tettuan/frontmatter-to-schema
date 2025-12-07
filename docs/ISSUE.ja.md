# 課題ログ

## 1. ~~APIがスキーマ相対パスの `x-template` を無視する~~ [解決済み]

- **場所**: `src/api.ts:290-311`, `src/api.ts:440-462`
- **問題**: ライブラリAPI（`transformFiles` および
  `Transformer.transformFiles`）は、スキーマから生の `x-template`
  文字列をそのまま `PipelineConfig`
  にコピーする。CLI（`src/presentation/cli/index.ts:154-265`
  でスキーマディレクトリを基準にテンプレートを解決する）とは異なり、APIはテンプレートパスが既に絶対パスであると想定している。スキーマに一般的な
  `"x-template": "./template.json"`
  が含まれている場合、異なる作業ディレクトリから
  `transformFiles({ schema: "/path/to/schema.json", ... })`
  を呼び出すと、`./template.json`
  がパイプラインに送られ、テンプレートの読み込みに失敗する。
- **影響**:
  プログラムからの利用者は、スキーマとテンプレートファイルを同じ場所に保持するという文書化された慣例に依存できない。JSRでのライブラリ公開（README.md:21-27）などの機能は、呼び出し側が手動でパスを解決しない限り動作せず、ファイルシステムロジックをAPIの背後にカプセル化する目的が失われる。
- **解決**: `transformFiles` と `Transformer.transformFiles`
  の両方で、`@std/path` を使用して相対テンプレートパスを
  `dirname(options.schema)`
  を基準に解決するように修正。CLIの動作と一致させた。ユニットテストを
  `tests/unit/api_test.ts` に追加。

## 2. ~~ディレクトリ入力がトップレベルの `.md` ファイルのみをスキャンする~~ [解決済み]

- **場所**: `src/application/services/pipeline-orchestrator.ts:326-344`
- **問題**: `inputPath`
  がディレクトリの場合、オーケストレーターは直下のエントリのみをリストし、`/\.md(own)?$/`
  でフィルタリングする。これにより、(a) globハンドリングでは含まれる `.markdown`
  ファイルが無視され、(b) サブディレクトリへの再帰が行われない。README.md:25
  では「単一ファイル、ディレクトリ、またはglobパターンを処理」と宣伝しているが、ディレクトリサポートは実質的に「1階層の
  `.md` ファイルのみ」となっている。
- **影響**: `docs/**/*.md` のような一般的なレイアウトや `.markdown`
  拡張子は、ユーザーがディレクトリパスを渡した場合（例：`transformFiles({ input: "./docs" })`）に黙って無視される。CLIは
  `resolveInputToFiles`
  を呼び出すため動作するが、この動作の不一致は混乱を招き、診断が困難。
- **解決**: PipelineOrchestratorに `walkDirectoryForMarkdown()`
  プライベートメソッドを追加。FileSystemPortを通じて再帰的にディレクトリを走査し、`.md`、`.mdown`、`.markdown`
  拡張子をサポート。カスタムアダプター向けのポート抽象化を維持。ユニットテストを
  `tests/unit/application/services/pipeline-orchestrator_test.ts` に追加。

## 3. ~~`x-derived-from` が型と順序の両方を書き換える~~ [解決済み]

- **場所**: `src/domain/schema/services/schema-directive-processor.ts:247-264`
- **問題**: `DataPathResolver` で値を収集した後、実装は各アイテムを `String(v)`
  に変換し、派生プロパティを設定する前に結果の配列をアルファベット順にソートしていた。仕様では派生値は「抽出順序を保持する」（docs/schema-extensions.md:102）と明示されており、文字列への制限はない。
- **影響**:
  ネストされたfrontmatterからの非文字列データ（数値、オブジェクト、ブーリアン）は文字列に変換され並べ替えられるため、下流のテンプレートは元の型や時系列順序（例：変更履歴の日付、優先度の数値、boolフラグ）に依存できなかった。`x-derived-unique`
  も文字列化後に一意性が適用されるため信頼性が低下していた。
- **解決**: 文字列への変換 (`.map((v) => String(v))`) と無条件の `.sort()`
  を削除。値は元の型と抽出順序を保持するようになった。`x-derived-unique`
  をJSON.stringify
  による深い等価性比較に更新し、オブジェクト/配列を適切に処理。ユニットテストを
  `tests/unit/domain/schema/services/schema-directive-processor_test.ts`
  に追加（順序保持、数値/ブーリアン/オブジェクト型保持、混合型の一意性をカバー）。

## 4. ~~`x-template-format` / YAMLテンプレートが不可能~~ [解決済み]

- **場所**: `src/domain/shared/value-objects/template-path.ts:34-45`,
  `src/application/services/template-schema-coordinator.ts:224-339`
- **問題**: `TemplatePath.create` は `.json`
  で終わらないすべてのパスを拒否し、`TemplateSchemaCoordinator.loadTemplate`
  は常にファイルをJSONとして解析していた（`format: "json"`）。しかしドキュメントでは
  `x-template-format`
  を説明し、`"x-template-format": "yaml"`（docs/schema-extensions.md:658-680）を示していた。結果として、`.yaml`
  テンプレートやスキーマレベルのフォーマットヒントを提供すると、即座に
  `INVALID_TEMPLATE_PATH`/`TEMPLATE_PARSE_ERROR` が発生していた。
- **影響**:
  ディレクティブが存在し、値オブジェクトが実装され、CLIのヘルプテキストで宣伝されているにもかかわらず、ユーザーはYAMLファーストのテンプレートや
  `x-template-format` を使用できなかった。
- **解決**: 共有ドメインの `TemplatePath` を `.json`、`.yml`、`.yaml`
  拡張子を受け入れるように更新。`TemplateSchemaCoordinator.loadTemplate`
  をファイル拡張子からフォーマットを検出するように修正（`x-template-format`
  オーバーライドが優先）し、`@std/yaml`
  経由でYAMLテンプレートを解析。解析されたフォーマットはTemplateエンティティに渡される。ユニットテストを
  `tests/unit/domain/shared/value-objects/template-path-shared_test.ts`
  に追加（YAML拡張子検証）。

## 5. ~~フェーズ1の `x-flatten-arrays` がスカラー/nullを無視する~~ [解決済み]

- **場所**:
  `src/domain/directives/services/phase1-directive-processor.ts:133-188`,
  `docs/requirements.ja.md:253`
- **問題**:
  フェーズ1は集約_前に_各ドキュメントを正規化し、後続のステップが一貫した配列形状を前提にできるようにすることが目的である（要件フローチャート参照:
  docs/requirements.ja.md:232-274）。しかし現在の実装は `Array.isArray(value)`
  が真の場合のみ実行される。プレーンな文字列（`traceability: "REQ-004"`）、数値、さらには
  `null`
  のような値は、仕様がこれらのケースを明示的に挙げているにもかかわらず、また値オブジェクト（`src/domain/schema/value-objects/flatten-arrays-directive.ts`）が既に「スカラーをラップ」と「null
  →
  []」をサポートしているにもかかわらず、そのまま残される。言い換えれば、ディレクティブのロジックを複製したが、その複製はルールの厳密なサブセットのみを実装している。
- **影響**: すべての下流コンポーネントはフェーズ1が配列を生成したと想定する:
  `SchemaTemplateResolver`
  はネストされたプロパティ名を記録し、コーディネーターは
  `TemplateRenderer.renderWithItems` 経由でそれを抽出し、`ItemsProcessor`
  はそれをイテレートしようとする。ファイルがスカラー値を含む場合、フェーズ1はそれをそのまま残すため、`TemplateRenderer`
  は `typeof value === "string"` を見て、実際の配列のみを `flatMap`
  するため黙ってそれを削除する。症状として、正規の配列形状を持たないドキュメントは、スキーマが正規化を約束しているにもかかわらず、警告なく
  `{@items}`
  から消える。さらに悪いことに、フェーズ1（部分的なフラット化）とフェーズ2（`FlattenArraysDirective`
  による完全なフラット化）で動作が分岐するため、同じディレクティブが実行場所によって2つの異なる意味を持つ。
- **解決**: フェーズ1のカスタムフラット化コードを
  `FlattenArraysDirective.create(...).apply(...)`
  に置き換え、フェーズ間で一貫したセマンティクスを確保: null/undefined →
  空配列、スカラー →
  `[value]`、ネストされた配列は再帰的にフラット化。6つのユニットテストを
  `tests/unit/domain/directives/services/phase1-directive-processor_test.ts`
  に追加（スカラーラッピング、null処理、undefined処理、数値スカラー、docs/requirements.ja.md:253
  の仕様例 `["A", ["B"]]`、`"D"` をカバー）。

## 6. ~~カスタム `FileSystemPort` アダプターがディレクトリ/globを処理できない~~ [解決済み]

- **場所**: `src/api.ts:105-129`,
  `src/application/services/pipeline-orchestrator.ts:319-382`,
  `src/infrastructure/utils/input-resolver.ts:1-193`
- **問題**:
  公開APIはプラガブルなファイルシステム（`TransformerOptions.fileSystem`）を宣伝しており、利用者が代替ランタイム（仮想FS、リモートストレージ、テスト）内で実行できるようにしていた。しかし、入力がディレクトリやglobパターンの場合、オーケストレーターはアダプターを無視して
  `resolveInputToFiles` を呼び出し、`Deno.cwd()`、`Deno.stat`、`expandGlob`
  を直接使用していた。つまり、パイプラインの半分はアダプターを使用し、残り半分は実OSを使用していた。
- **影響**:
  インメモリファイルシステム（テスト）、リモートファイルシステム、サンドボックスアダプターを渡す利用者は、単一ファイルは正常に読み取れるが、`input: "./docs"`
  や `"docs/**/*.md"`
  を試すと失敗していた。コードが公開していないホストAPIに突然アクセスするため、何も処理されなかった。
- **解決**: `FileSystemPort` インターフェースにオプションの
  `expandGlob(pattern, root)` と `cwd()` メソッドを追加。`DenoFileSystemAdapter`
  にこれらを実装。ポートのメソッドを使用してglob展開を行う
  `resolveInputToFilesWithPort()` 関数を作成（`expandGlob` が利用できない場合は
  `readDir`
  によるディレクトリ走査にフォールバック）。`PipelineOrchestrator.execute()`
  を更新し、globパターンを最初に検出してポート対応リゾルバーにルーティング。存在しないパスは黙ってスルーする代わりに
  `INPUT_NOT_FOUND`
  エラーを返すように変更。`tests/unit/application/services/pipeline-orchestrator_test.ts`
  に3つのユニットテストを追加（globパターン処理、マッチなしエラー、カスタムアダプターcwd使用をカバー）。

---

最終更新: レビュー中に発見された高影響度の課題のリストを維持。
