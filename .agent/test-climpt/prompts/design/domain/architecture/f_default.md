---
c1: design
c2: domain
c3: architecture
title: Domain Architecture Design
description: Performs domain design based on domain boundary information and related materials.
usage: climpt-design domain architecture -f boundary_info.md -o design_output/
options:
  file: [true]
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
