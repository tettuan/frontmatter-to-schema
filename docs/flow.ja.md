まず、Schema構造を読み取る。引数のSchema指定を使う。 ↓　３つへ分解
1.フロントマター解析の構造 2.テンプレート指定の把握 3.解析結果データの処理指示

上記がSchemaドメイン境界線である。
この成果は3つそれぞれが独立している。あとで統合される。

## サブモジュールの役割分担

処理は以下の3つの独立したサブモジュールを使用して実現される：

### 1. yaml-schema-mapper: フロントマター変換

**適用タイミング**: 「1.フロントマター解析の構造」処理の直後

フロントマターから抽出された生データ（YAML parsed）をSchema定義に基づいて変換する。

**処理内容**:
- プロパティ名のマッピング（`file` → `input_file`、snake_case → camelCase など）
- 型変換（`[false]` → `false`、`"42"` → `42` など）
- Schema検証（required, enum, pattern など）

**入力**: 生フロントマターデータ `Record<string, unknown>`
**出力**: Schema準拠データ `Record<string, unknown>`

**重要**: この変換により、以降の処理ではSchema定義に沿ったデータ構造が保証される。

### 2. data-path-resolver: パス式解決

**適用タイミング**: 「3.解析結果データの処理指示」内の `x-derived-from` 処理

Schema内の `x-derived-from` ディレクティブで指定されたパス式を解析し、値を抽出する。

**処理内容**:
- ドット記法 (`id.full`)
- 配列展開構文 (`items[]`)
- プロパティ付き展開 (`items[].name`)
- 二重展開 (`articles[].tags[]`)

**入力**: パス式 (例: `"commands[].c1"`)
**出力**: 抽出された値（配列または単一値）

**使用例**:
```json
{
  "availableConfigs": {
    "x-derived-from": "commands[].c1"
  }
}
```

### 3. json-template: テンプレート変数置換

**適用タイミング**: テンプレート処理フェーズ（`x-template-items` 処理）

テンプレートファイル内の `{variable.path}` 形式の変数を実際の値で置換する。

**処理内容**:
- 変数解析と置換
- ドット記法によるデータアクセス
- 配列インデックス指定 (`{items[0].name}`)

**入力**: テンプレートファイルパス + データ
**出力**: 変数置換済みテンプレート

**重要**: `{@items}` 記法は親システム（フロントマター処理）が担当し、このモジュールは個別変数の置換のみを行う。

### モジュール間の独立性

各サブモジュールは完全に独立しており、相互依存関係は存在しない：

- **yaml-schema-mapper**: JSON Schema仕様に基づく汎用変換モジュール
- **data-path-resolver**: パス式解析の汎用ライブラリ
- **json-template**: テンプレート処理の汎用ライブラリ

すべてのモジュールは親プロジェクトから独立して動作可能である。

---

「1.フロントマター解析の構造」結果は、データ構造として把握される。どのようなデータがフロントマターから抽出できたのかを知っているのは、この「1.フロントマター解析の構造」処理だけである。
引数のMDファイル指定を使うのは、この境界内だけである。

Schemaのなかで、x-frontmatter-part
が指定された階層が、フロントマターの構造を示している。この階層以下はフロントマター解析にのみ使われる。
x-frontmatter-part
より上位のSchem階層は、Markdownのフロントマター解析以外の形式指定に使われる。

「2.テンプレート指定の把握」は、テンプレートファイルを知る。テンプレートのファイルを使うための
x-template , x-template-items,x-template-format がそれである。
テンプレートを求められたときに返す以上の役割はもたない。

「3.解析結果データの処理指示」は複雑に見えるが、シンプルである。
「1.フロントマター解析の構造」で得られたデータを操作するディレクティブである。
従って、データ操作は、このドメイン境界内で完結する。
入力値は「1.フロントマター解析の構造」結果であり、出力は持たず、要求されたデータセットを返す。要求されたデータセットはx-ディレクティブの指示によって処理される。
つまり、init(input_data_from_frontmatter). call_method(schema_entity) によって、
x-* ディレクティブ処理済みの値が取得できる、というわけだ。
call_methodはSchemaの階層を受け取り、その階層が持つx-*指示を処理する。
call_method('availableConfigs')で、以下の場合は x-derived-from と
x-derived-unique が処理される。

```
...,
"availableConfigs": {
    "type": "array",
    "items": {
    "type": "string"
    },
    "x-derived-from": "commands[].c1",
    "x-derived-unique": true,
    "description": "Tool names array - derived from commands[].c1",
...,
```

この加工処理に用いられるx-*が、
x-derived-from,x-derived-unique,x-flatten-arrays,x-jmespath-filterである。

上記の結果、「1.フロントマター解析の構造」が直接参照されることはなく、「3.解析結果データの処理指示」によって隠蔽されている。データの取得は「3.解析結果データの処理指示」を通して取得され、それは必ずx-*指示の処理済みデータである。
なおSchemaにおいて type:"array"の場合に items: があるのは `[]`
の各要素である、という意味なので、階層構造では`[]`部分に相当する。以下の場合に
`commands[].c1` とすべきであり
`commands.items[].c1`ではない。（itemsは省略される階層）

```
"commands": {
  "type": "array",
  "description": "Command registry",
  "x-frontmatter-part": true,
  "items": {
    "$ref": "registry_command_schema.json"
  }
```

ここまでがSchema処理である。この処理までがSchemaドメインであり、大きな境界線として存在している。

続いてテンプレート境界線に入る。
テンプレート処理は、テンプレートファイルの要求から開始する。
最初に処理するテンプレートを要求し、Schemaドメイン「2.テンプレート指定の把握」で得られた結果の
x-template を受け取る。
テンプレートを受け取った後は単純である。テンプレートJSONをテキストとして扱い、変数{variables}を解析していく。
そのなかで`{@items}`は、特別な要求となる。`{@items}`はフロントマターデータとx-template-itemsの2つを要求する。また繰り返し処理であるためフロントマターデータのフロントマターから得られた配列の数だけx-template-itemsを繰り返す。
変数処理は単純である。{id.full}のように指定された階層構造情報を用いて、Schemaドメインの「3.解析結果データの処理指示」結果をえるようリクエストするだけである。{id.full}ならば
id.full
をリクエストする。「3.解析結果データの処理指示」側はデータの存在を確認して返す。デバッグ上は階層の有無やデータの有無を出力して明示的なエラーか意図しない階層エラーかを区別できるようにすべきだろう。
データ要求時の起点は、x-templateで呼ばれているのか、x-template-itemsで呼ばれているのかで異なる。x-template-itemsはフロントマターごとの構造データ定義がrootになる。つまりx-frontmatter-partが起点である。
x-templateはSchemaのrootが起点となる。
以下の場合はcommandsが起点なので、x-template-itemsの中で{id.full}と指定されたということは、`commands[].id.full`
と同義になる。x-template

```
...,
"commands": {
  "type": "array",
  "description": "Command registry",
  "x-frontmatter-part": true,
  "items": {
    "$ref": "registry_command_schema.json"
  },
...,
```

テンプレート変数の処理を最後まで置換し終えたら、全体のテキストデータをJSONとして構造化したデータに保持する。その後、出力形式をx-template-formatの指定で変換をかけて出力する。

## フロントマター変換における sub_modules/yaml-schema-mapper の役割

フロントマター抽出直後、Schema処理の前に、`sub_modules/yaml-schema-mapper`モジュールを使用してデータ変換を行う。

### yaml-schema-mapperモジュールの機能と制約

**提供機能:**

- プロパティ名マッピング（exact match → case-insensitive → heuristic）
- `x-map-from` ディレクティブサポート（string | string[] fallback）
- 型変換（array ↔ single value, string → number/boolean など）
- Schema検証（required, enum, pattern, min/max など）
- Union type サポート
- 詳細な警告システム（13種類のwarning codes）

**処理タイミング:**

フロントマター抽出（YAML parsing）の直後、x-* ディレクティブ処理の前に実行される。

### フロントマターシステムとの統合方針

`FrontmatterData.create()` 内で以下の責任分離を行う:

1. **YAML解析**: `@std/front-matter` でフロントマター部分を抽出
2. **Schema変換**: `yaml-schema-mapper` で生データをSchema準拠データへ変換
3. **ディレクティブ処理**: x-flatten-arrays, x-derived-from などの処理

### 具体的な処理フロー

```
Raw YAML frontmatter
↓
@std/front-matter による抽出
↓ (Record<string, unknown>)
yaml-schema-mapper による変換 ← ★ 新規統合
  - file → input_file (property mapping)
  - [false] → false (type coercion)
  - Schema validation
↓ (Schema-compliant Record<string, unknown>)
FrontmatterData インスタンス生成
↓
x-* ディレクティブ処理
```

### 変換例

```typescript
// Input (extracted YAML)
{
  file: [false],
  stdin: [true],
  count: "42"
}

// Schema
{
  properties: {
    input_file: { type: "boolean", "x-map-from": "file" },
    stdin: { type: "boolean" },
    count: { type: "number" }
  }
}

// Output (after yaml-schema-mapper)
{
  input_file: false,
  stdin: true,
  count: 42
}
```

この設計により、フロントマターの多様な記法を吸収し、後続処理では一貫したSchema準拠データを扱うことができる。

## テンプレート処理における sub_modules/json-template の役割

`x-template-items`の処理には、`sub_modules/json-template`モジュールを使用する。このモジュールは、テンプレートファイルの変数置換処理を担当する専用モジュールである。

### json-templateモジュールの機能と制約

**提供機能:**

- `{variable.path}` 形式の変数置換
- ドット記法による階層アクセス (`{user.profile.name}`)
- 配列アクセス (`{items[0]}`, `{users[1].name}`)
- テンプレートファイル読み込みと変数解析
- 包括的なエラーハンドリング

**重要な制約:**

- **`{@items}`記法は非サポート**: 配列展開機能は含まれない
- **ファイルベースのテンプレート**: メモリ上の文字列テンプレートは未対応
- **JSON出力限定**: テンプレート結果は有効なJSON形式である必要

### フロントマターシステムとの統合方針

`x-template-items`処理では、以下の責任分離を行う:

1. **配列展開処理 (`{@items}`)**: フロントマターシステム側で実装
   - `x-frontmatter-part: true`で指定された配列データの統合
   - 各配列要素に対するテンプレート適用の繰り返し制御

2. **変数置換処理**: `sub_modules/json-template`モジュールを使用
   - 個別アイテムテンプレートの`{variable.path}`変数を実際の値で置換
   - `x-template-items`で指定されたテンプレートファイルの処理

### 具体的な処理フロー

```
フロントマター統合データ: [{item1}, {item2}, {item3}, ...]
↓
各要素に対してx-template-items適用:
  for each item in 統合データ:
    1. json-template.createTemplateProcessor()でプロセッサー作成
    2. processor.process(item, x-template-itemsファイル)で変数置換
    3. 置換結果を配列に追加
↓
全アイテム処理結果を{@items}位置に統合挿入
```

この設計により、汎用的な変数置換機能を再利用しつつ、フロントマター固有の配列展開機能を分離して実装できる。
