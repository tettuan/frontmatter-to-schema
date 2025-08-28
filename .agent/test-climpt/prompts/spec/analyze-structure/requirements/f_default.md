---
c1: spec
c2: analyze-structure
c3: requirements
title: Requirements Structure Analysis
description: Break down and structure requirements through process decomposition and user flow analysis.
usage: climpt-spec analyze-structure requirements -f requirements.md -o structured_output/
options:
  input_file: [true]
  destination: [true]
---

# 指示: 要求をブレイクダウンし構造化する

「要求のファイル」をもとに、情報を整理して、構造化されたファイルを出力する。

構造化は、

1. プロセス分解
2. ユーザーフロー

に基づいて行い、記述は「誰が・何を・どのように」で記載する。

要求事項から要件として表せるように、
各プロ瀬セスやユーザーフローに対し、MosCow分析に基づいた必須か否かを記載する。概ね、要求は必須のことが多い。

機能定義は丁寧に行う。文脈を24回読み解いて、骨格を明らかにする。
その骨格からの距離を、考えた機能定義に対して計算する。
その結果、距離がもっとも中心骨格に近いものを、採用する。（計算プロセスを記載する必要はない）

# 要求のファイル

{input_text_file}

# 出力先

`{destination_path}requirements.md`
