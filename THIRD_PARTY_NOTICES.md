# rigo の出典・第三者ライセンス

自作コードの MIT License は [LICENSE](LICENSE) を参照してください。第三者のコード、フォント、データには、それぞれ以下の条件が適用されます。

この文書とライセンス原文は、リポジトリを複製・再配布するときも保持してください。JSON に含まれるデータを抜粋する場合は、抜粋した部分の出典と条件を確認してください。

## 字形：KanjiVG

- Copyright (C) 2009/2010/2011 Ulrich Apel.
- 出典：[KanjiVG](https://kanjivg.tagaini.net/) / [ソース](https://github.com/KanjiVG/kanjivg)
- ライセンス：[CC BY-SA 3.0 Unported](licenses/CC-BY-SA-3.0.txt)
- 対象：`kvg_all.json` の `tree`・`index`。
- 加工：SVG の筆画を点列に変換し、座標を整数化。部品の木、境界、筆画の対応表を JSON にまとめた。元の SVG そのものではない。
`data/t0.json`・`t1.json`・`t2.json` と `data/meta.json` の `synth` は字形を段階的に読み込むための派生物。筆画座標を整数の差分に変換し、字の範囲ごとに分割している。

元の字形と、その加工により生じた派生字形の権利は、CC BY-SA の条件に従います。著作者が本作品を推奨・承認していることを意味しません。

## 読み・意味・学年・並び順：KANJIDIC2 / kanji-data

- Copyright: James William BREEN and the Electronic Dictionary Research and Development Group (EDRDG).
- 出典：[KANJIDIC Project](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)
- ライセンス：[CC BY-SA 4.0 International](licenses/CC-BY-SA-4.0.txt)。[EDRDG の利用条件](licenses/EDRDG-LICENCE.txt)と[データの説明](licenses/KANJIDIC-Documentation.txt)も参照してください。
- JSON 変換元：[David Gouveia の kanji-data](https://github.com/davidluzgouveia/kanji-data)。Copyright (c) 2019 David Gouveia。[同プロジェクトの MIT License](licenses/kanji-data-MIT.txt)も保持しています。
- 対象：`kvg_all.json` の `info`・`grade`・`order` と `data/meta.json` の `info`・`grade`・`order`。
- 加工：読み・意味・画数・学年を抽出し、利用するキーに変換。学年と画数から字の並び順を作った。WaniKani の `wk_*` と JLPT のフィールドは取り込んでいない。

This project uses data derived from KANJIDIC2, copyright James William Breen and EDRDG, under CC BY-SA 4.0. The data has been filtered and converted to JSON through kanji-data.

## 旧版の構造情報：CJKVI-IDS / CHISE

- Copyright (c) 2014-2017 CJKVI Database. Based on CHISE IDS Database.
- 出典：[CJKVI-IDS](https://github.com/cjkvi/cjkvi-ids) / [CHISE](https://www.chise.org/ids/)
- 対象：過去の版の `kvg_all.json` に含まれる `op`。現在の JSON からは削除済みで、画面が読む `data/` にも含まれない。
- CJKVI-IDS の `ids.txt` は CHISE の条件を引き継ぐ。[CJKVI の説明](third-party/cjkvi-ids/README.md)と[CHISE の説明・免責](third-party/chise/README.md)を同梱。
- 本配布では従来どおり GPLv2 の条件を適用する。[GPLv2 原文](licenses/GPL-2.0.txt)を同梱。
- 加工：削除前の `op` は各字の最上位の構造演算子を抽出した表。
- 対応する入力：[third-party/cjkvi-ids/ids.txt](third-party/cjkvi-ids/ids.txt)。元の著作権表示を保持した入力を、GPLv2 で再配布する。
- 加工方法：Git の過去の版の `src/build_kvg_all.py`。現在の生成スクリプトには IDS からの抽出処理を含まない。

2026-11-26 に、公開済みの加工済み JSON と入力データを照合し、上記の加工内容を文書化した。データ全体は再生成していない。同日の追加対応で、未使用の `op` だけを `kvg_all.json` から削除し、生成スクリプトからも該当処理を削除した。元の加工日は配布物に記録されていない。

この表は出典ごとの範囲を示すものです。複数の出典を持つ JSON ファイル全体を MIT として再利用することはできません。

## フォント：JetBrains Mono

- Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
- 対象：`mono.woff2` / `mono-bold.woff2`。フォント内部のバージョンは 2.211。
- ライセンス：[SIL Open Font License 1.1](licenses/JetBrains-Mono-OFL.txt)
- 配布時のファイル名は `mono`。フォント内部の名称は JetBrains Mono のまま。これ以前の変換・サブセット処理の履歴は元配布物に記録されていない。

## 動画ライブラリ

| 対象 | 著作権表示 | 原文 |
|---|---|---|
| `mp4-muxer.js` | Copyright (c) 2023 Vanilagy | [MIT License](licenses/mp4-muxer-MIT.txt) |
| `webm-muxer.js` | Copyright (c) 2022 Vanilagy | [MIT License](licenses/webm-muxer-MIT.txt) |

ライブラリ本体は変更していません。元のリリース番号は配布物に記録されていないため、未特定です。

## 照合した入力と確認日

確認日：2026-11-26。この日付はライセンス文書の整備・照合日です。

| 入力 | 照合した版 | 確認結果 |
|---|---|---|
| CJKVI-IDS `ids.txt` | [`86b4d16159f0079437870408f0ca186e529015db`](https://github.com/cjkvi/cjkvi-ids/blob/86b4d16159f0079437870408f0ca186e529015db/ids.txt) | 削除前の `op` と全件一致。入力とライセンスは旧版の出典資料として同梱 |
| kanji-data `kanji.json` | [`00fd7079c3890f430759536f91aa5e854ec0ca4f`](https://github.com/davidluzgouveia/kanji-data/blob/00fd7079c3890f430759536f91aa5e854ec0ca4f/kanji.json) | `info` の抽出結果が既存 JSON と全件一致 |

照合結果は、当初その版から生成したという履歴の証明とは区別します。今回取得したライセンス文書の URL と SHA-256 は [licenses/sources.json](licenses/sources.json) に記録しています。

## 出力作品を公開・配布するとき

- KanjiVG の字形を使った作品には、KanjiVG・Ulrich Apel・CC BY-SA 3.0 の表示とリンク、字形を加工した旨を添えてください。派生字形を共有するときは、CC BY-SA 3.0 または同ライセンスが認める条件に従ってください。
- 読み・意味も掲載するときは KANJIDIC2・EDRDG・CC BY-SA 4.0 を表示してください。
- クレジットは作品の説明欄、展示キャプション、配布物に同梱する文書など、作品を受け取る人が確認できる場所に置いてください。
- フォントファイルを含む SVG などを再配布するときは、[JetBrains Mono の著作権表示と OFL 原文](licenses/JetBrains-Mono-OFL.txt)を保持してください。naiji が書き出す SVG には全文をメタデータとして含めます。

[公開用クレジット例](credits.txt)を用意しています。作品の内容に合う行を使ってください。動画の全フレームに、字形の出典・加工した旨・ライセンスと、この案内への URL を下端に2列・2行で小さく自動表示します。画面内の字形にも同じ表示が入ります。

SNS で公開するときは、トリミングやスタンプでクレジットを隠さないでください。クレジットを切り取る場合は、投稿の説明欄などで同じ情報を確認できるようにしてください。SNS の利用規約との整合は、利用するサービスごとに確認してください。

画像・動画全体にどの条件が及ぶかは、含まれる素材と加工の内容によります。自作コードの MIT License だけを根拠に、第三者の素材に由来する部分を独占的な条件で配布することはできません。
