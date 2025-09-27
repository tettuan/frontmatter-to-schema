まず、Schema構造を読み取る。引数のSchema指定を使う。 ↓　３つへ分解
1.フロントマター解析の構造 2.テンプレート指定の把握 3.解析結果データの処理指示

上記がSchemaドメイン境界線である。
この成果は3つそれぞれが独立している。あとで統合される。

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
