# rigo

漢字を部品にほどき、部品をひとつ選んで、それを含む別の字へ渡す。渡った先でまたほどく。
意味は参照しない。形だけの理由で、字から字へ移り続ける装置。

kanji taken apart; one part carried on into another kanji that contains it; taken apart again.
Meaning is never consulted — only shape decides where the chain goes.

**https://ogrew.github.io/rigo/**

## 使い方

- **Auto**: Start の字から部品をランダムに選んで渡り歩く（32 字で止まる）
- **Manual**: ほどけたら、キャンバス上の箱をクリックして進む部品を選ぶ
- **Route**: Start から Goal まで、Via 字を挟む経路を探して再生する
- **Path**: 辿った経路（`森 木>梅 毋>海`）。貼り直して Replay できる
- **Export →**: Path を 1080×1080 / 30fps の MP4（H.264 + AAC）に書き出す。音は同じ時刻表から合成して埋め込む

## ファイル

| file | |
|---|---|
| `index.html` / `app.js` | 通常ページ（Auto / Manual / Route） |
| `export.html` / `export.js` | 録画ページ |
| `rigo-core.js` | 装置の中身：ほどく・渡す・残骸・描画・音・タイムライン |
| `kvg_all.json` | KanjiVG 6,984 字の筆画・部品木（`src/build_kvg_all.py` で生成） |
| `mono.woff2`, `mono-bold.woff2` | JetBrains Mono (OFL 1.1) |
| `mp4-muxer.js`, `webm-muxer.js` | [mp4-muxer](https://github.com/Vanilagy/mp4-muxer), [webm-muxer](https://github.com/Vanilagy/webm-muxer) (MIT) |

ビルド工程はない。静的ファイルをそのまま置けば動く（GitHub Pages など）。
`kvg_all.json` は 19 MB（gzip 後 6 MB）。

## データと謝辞

- 字形・部品の木：[KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel — [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- 読み・意味：[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) © [EDRDG](https://www.edrdg.org/) — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（[kanji-data](https://github.com/davidluzgouveia/kanji-data) 経由）
- フォント：[JetBrains Mono](https://www.jetbrains.com/lp/mono/) — SIL OFL 1.1

## ライセンス

このリポジトリのコード（`*.js`, `*.html`, `src/`）は MIT License。
`kvg_all.json` は KanjiVG と KANJIDIC2 の派生物なので CC BY-SA（3.0 / 4.0）に従う。
