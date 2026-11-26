# rigo

漢字を部品にほどき、部品をひとつ選んで、それを含む別の字へ渡す。渡った先でまたほどく。
意味は参照しない。形だけの理由で、字から字へ移り続ける装置。

kanji taken apart; one part carried on into another kanji that contains it; taken apart again.
Meaning is never consulted — only shape decides where the chain goes.

**https://ogrew.github.io/rigo/**

## 使い方

- **Auto**: Start の字から部品をランダムに選んで渡り歩く（32 字で止まる）
  - Start に 2 字入れると、字ごとにランダムな経路を先に作って横に並べ、同じ拍で渡す（手数は揃える。再訪なしなら、レーンどうしでも同じ字を通らない）
- **Manual**: ほどけたら、キャンバス上の箱をクリックして進む部品を選ぶ
- **Route**: Start から Goal まで、Via 字を挟む経路を探して再生する
  - Start / Goal に 2 字ずつ入れると、字ごとに経路を探して横に並べ、同じ拍で渡す（`森林` → `海岸`）。手数は揃え、揃わないときは短い側が最後に待つ。Export では 16:9（1080 → 1920×1080）になる。レーンは境目のない同じ場に並び、残骸は隣のレーンまで流れ、ほどく・組み上がる瞬間には隣の字にも押しのけられる。字の広がりに合わせて自動で縮める。定規は場全体に 1 本
  - **Direction**（Settings › Motion、共有 URL は `dr`）: 横 / 縦。縦は上から下へ並べ、Export は 9:16（1080 → 1080×1920）
- **Whole char**（Settings › Motion、既定 ON）: 字そのものを部品として渡す
  - ほどけない字は、まるごと部品になって、それを含む字へ渡る（`平 平>評`：平が評の旁になる）
  - 取り出した部品が単独の字でもあれば、そのままその字になる（`奇 大>大`：奇から出た大が大になる）
  - OFF にすると従来どおり（ほどける字の部品だけで渡る）。Path に書かれた経路の Replay / Export は、この設定によらず通る
- **Path**: 辿った経路（`森 木>梅 毋>海`）。貼り直して Replay できる。複数の字は ` / ` で区切る（`森 木>漆 氵>海 / 林 木>歴 厂>岸`）
- **Share**: Path と見た目の設定を URL にしてコピーする（`index.html#p=森木梅毋海&st=brush&ink=c00000`）。開くとその通りに再生される。既定値と違う設定だけが URL に載る
- **Export →**: Path を 1080×1080 / 30fps の MP4（H.264 + AAC）に書き出す。音は同じ時刻表から合成して埋め込む

## ファイル

| file | |
|---|---|
| `index.html` / `app.js` | 通常ページ（Auto / Manual / Route） |
| `export.html` / `export.js` | 録画ページ |
| `rigo-core.js` | 装置の中身：ほどく・渡す・残骸・描画・音・タイムライン・データの読み込み |
| `share.js` | 共有 URL（`#p=…`）の読み書き。index ⇄ export の受け渡しもこれ |
| `data/` | 画面が読むデータ。`meta.json` と字形 3 層（`t0` 常用 / `t1` 人名用 / `t2` その他） |
| `kvg_all.json` | KanjiVG 6,984 字の筆画・部品木（`src/build_kvg_all.py` で生成）。`data/` の元 |
| `og.png` | 共有カードの画像（1200×630）。Path `森 木>漆 氵>海 / 林 木>歴 厂>岸` の 4.15 秒目を export.html の描画で切り出したもの |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | アイコン。`favicon/` の案から `node favicon/gen.js` で書き出す（`favicon/preview.html` で案と動きを見比べられる） |
| `export-credits.js` | 出力内の出典・ライセンス表示 |
| `mono.woff2`, `mono-bold.woff2` | JetBrains Mono (OFL 1.1) |
| `mp4-muxer.js`, `webm-muxer.js` | [mp4-muxer](https://github.com/Vanilagy/mp4-muxer), [webm-muxer](https://github.com/Vanilagy/webm-muxer) (MIT) |

ビルド工程はない。静的ファイルをそのまま置けば動く（GitHub Pages など）。

### データの読み込み

最初に読むのは `data/meta.json` と `data/t0.json`（常用とその部品）だけで、gzip 後でおよそ 1 MB。
Scope を広げたとき、範囲外の字を Start にしたとき、その字を含む Path を開いたときに、`t1` / `t2` を読み足す。
筆画は 10 倍した整数の差分で持っている。

`data/` は `kvg_all.json`（19 MB、画面からは読まない）から作る。部品の判定に `rigo-core.js` を使うので、
`isLeaf` など分解の規則を変えたら作り直すこと。

```
node src/split_data.js
```

## データと謝辞

- 字形・部品の木：[KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel — [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- 読み・意味：[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) © [EDRDG](https://www.edrdg.org/) — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（[kanji-data](https://github.com/davidluzgouveia/kanji-data) 経由）
- フォント：[JetBrains Mono](https://www.jetbrains.com/lp/mono/) — SIL OFL 1.1

## ライセンス

自作コードは MIT License。外部ライブラリ・フォント・データには、それぞれの配布条件が適用されます。

[出典・第三者ライセンス](THIRD_PARTY_NOTICES.md)に、対象ファイルと JSON 内の範囲、著作権表示、加工内容、元データを記載しています。原文は `licenses/` に同梱しています。

動画の全フレームに出典とライセンスを下部中央に `credits: ogrew.github.io/rigo/credits.html` の1行を小さく自動表示します。画面内の字形にも同じ表示が入ります。

画像・動画を公開するときの表示例は [credits.txt](credits.txt)、画面から読める案内は [出典・ライセンス](https://ogrew.github.io/rigo/credits.html)を参照してください。

## 関連

- [naiji](https://ogrew.github.io/naiji/) — 無い字を組み立てる装置
