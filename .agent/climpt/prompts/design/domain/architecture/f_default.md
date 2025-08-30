---
c1: design
c2: domain
c3: architecture
title: ドメイン設計
description: ドメイン境界情報などを元に、ドメイン設計を行う。
usage: |
  ドメイン境界線情報ファイルを入力として、ドメイン設計を行います。
  まずは粗い型定義を行い、全域性の原則を踏まえて設計します。
options:
  input: ["default"]
  adaptation: ["default"]
  file: [true]
  stdin: [false]
  destination: [true]
---

# ドメイン設計

「ドメイン情報」をもとに、ドメイン設計を行う。 まずは粗い型定義を行う。

その際に、[全域性の原則](docs/development/totality.ja.md)を踏まえる。

# ドメイン情報

- 境界: `{input_text_file}`
- `docs/domain/*.md`

# 出力先

`{destination_path}` へ出力。 (`{destination_path}`
がPATH形式でなければ、代わりに `tmp/design_domain_architecture/*.md`へ出力)

設計が複数ファイルへ分かれてもよい。
