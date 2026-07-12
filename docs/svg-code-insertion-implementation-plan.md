# SVGコード挿入対応 実装詳細プラン

作成日: 2026-07-10  
対象: `tool/html-tools/new-markdown-editor/index.html`

## 1. 目的

Markdown Editorで、SVGをBase64データURIに変換せず、`<svg>...</svg>` のコードとして本文へ挿入できるようにする。

これにより、利用者は図形、アイコン、簡単な図解をMarkdownファイル内で編集できる。保存したMarkdownにもSVGコードがそのまま残るため、差分確認と再編集がしやすい。

## 2. 対象範囲

| 項目 | 方針 |
| --- | --- |
| ツールバー | 既存の画像挿入ボタンから「画像URL」と「SVGコード」を選べるようにする。 |
| SVGの入力 | ダイアログでコードを貼り付ける。未入力時は編集可能なSVGテンプレートを挿入する。 |
| クリップボード | `image/svg+xml` はSVGテキストとして挿入する。PNG/JPEGなどは現在どおりJPEGのBase64埋め込みを維持する。 |
| プレビュー | 文書モードとスライドモードの双方で、安全なSVGを表示する。 |
| 保存 | SVGを通常のMarkdown本文として保存する。別ファイルや画像アセットは作らない。 |
| エクスポート | HTMLではSVGを保持する。PDF/Wordなどの既存SVG-to-PNG変換経路を確認し、失敗時を扱う。 |

対象外は、SVGファイルを独立アセットとして管理する機能、外部SVG URLのダウンロード、SVGの視覚エディタ、複数SVGの一括インポートである。

## 3. 現状と課題

現在は、画像ボタンがMarkdown画像構文 `![alt](URL)` を挿入する。クリップボードの画像はCanvas経由でJPEG Base64に変換している。SVGもこの経路に入ると、コードではなく画像データになる。

プレビューではスライドモードにSVG向けのDOMPurify設定がある一方、文書モードはSVGを明示した許可設定を持たない。そのため、SVGコードを本文へ直接書いた場合の表示仕様が分散しており、将来のライブラリ更新でも壊れにくい形になっていない。

PDF/WordなどのエクスポートにはSVGをPNGに変換する既存処理がある。外部画像やWebフォントを参照するSVGはCanvasのCORS制約で変換に失敗する可能性がある。

## 4. 体験設計

### 4.1 挿入操作

画像ボタンをメニュー起点に変更し、次のコマンドを表示する。

| コマンド | 動作 |
| --- | --- |
| 画像URLを挿入 | 現在の `![代替テキスト](URL)` 挿入を維持する。 |
| SVGコードを挿入 | ダイアログを開き、SVGコードを挿入する。 |

`SVGコードを挿入` のダイアログには、コード入力欄、挿入、キャンセルを置く。入力欄が空の場合は、次のような最小テンプレートを挿入する。

```html
<svg width="320" height="180" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="説明">
  <rect width="320" height="180" rx="8" fill="#f3f4f6" />
  <text x="160" y="96" text-anchor="middle" font-size="20" fill="#111827">SVG</text>
</svg>
```

選択範囲にSVGコードがある場合は、その内容をダイアログへ初期表示する。挿入後は、SVG全体を選択状態にしてすぐ編集できるようにする。

### 4.2 クリップボードの扱い

貼り付け処理は次の順序で分岐する。

1. `clipboardData` のテキストが `<svg` で始まる場合、SVGとして検証してコード挿入する。
2. クリップボード項目のMIME型が `image/svg+xml` の場合、`FileReader.readAsText()` で読み、SVGとして挿入する。
3. それ以外の `image/*` は、現行どおりCanvasでJPEG Base64に圧縮して挿入する。
4. SVGとして検証できない場合は、貼り付けを止め、理由を通知する。元のコードを勝手に画像化しない。

## 5. 実装設計

### 5.1 UIとコマンド

`index.html` のツールバーにある画像ボタンを、メニューを開くボタンに変更する。既存の `insertFormatting('image')` は `insertImageUrl()` に分離し、SVG専用の `openSvgInsertDialog()` と `insertSvgMarkup()` を追加する。

ダイアログは既存のモーダル実装と同じDOM/CSSパターンを使う。新しいUIライブラリは導入しない。

### 5.2 SVGの事前検証と正規化

挿入前に `sanitizeSvgMarkupForInsert(markup)` を通す。

処理内容は以下とする。

1. `DOMParser` でXMLとして解析し、ルート要素が `svg` であることを確認する。
2. XML解析エラー、空文字列、`<svg>` 以外のルートは拒否する。
3. `DOMPurify` のSVGプロファイルと許可リストで不要なノードと属性を除去する。
4. シリアライズ後の結果が空、または `svg` 要素を含まない場合は拒否する。
5. 表示・保存時に揺れないよう、`xmlns` と `viewBox` を補完または正規化する。

初期の許可タグは、`svg`、`g`、`path`、`rect`、`circle`、`ellipse`、`line`、`polyline`、`polygon`、`text`、`tspan`、`title`、`desc`、`defs`、`linearGradient`、`radialGradient`、`stop`、`clipPath`、`mask`、`pattern` とする。

初期の許可属性は、寸法・座標・描画に必要な `viewBox`、`xmlns`、`width`、`height`、`x`、`y`、`cx`、`cy`、`r`、`rx`、`ry`、`x1`、`x2`、`y1`、`y2`、`d`、`points`、`fill`、`stroke`、`stroke-width`、`stroke-linecap`、`stroke-linejoin`、`opacity`、`transform`、`preserveAspectRatio`、`text-anchor`、`font-size`、`font-family`、`role`、`aria-label`、`id`、`class` とする。

`script`、イベント属性（`on*`）、`javascript:` URL、`foreignObject`、外部画像参照（`image href`）は初回実装では許可しない。特に `foreignObject` はHTMLをSVG内に持ち込めるため、文書モードでは別途安全性を検証するまで対象外とする。

### 5.3 プレビューのサニタイズを共通化

`renderMarkdown()` で文書モードとスライドモードに分かれているDOMPurify設定を、共通のヘルパーに整理する。

| ヘルパー | 用途 |
| --- | --- |
| `getSvgSanitizeOptions()` | SVG用のタグ・属性・禁止規則を1か所で定義する。 |
| `sanitizeMarkdownPreviewHtml(html)` | 文書モードのHTMLを安全にサニタイズする。 |
| `sanitizeSvgMarkupForInsert(markup)` | 挿入前のSVG検証と正規化を行う。 |

文書モードは `USE_PROFILES: { html: true, svg: true }` を明示する。スライドモードのMarp本体から生成されたHTMLを無条件に変更する既存の例外は維持する。ただし、利用者が入力したSVGに対しては挿入時の検証を必ず通す。

### 5.4 CSSと表示サイズ

既存の `.markdown-body svg { max-width: 100%; height: auto; }` を基準にする。必要なら次を追加する。

- SVGをブロック表示にして前後の段落と干渉しないようにする。
- `width` または `height` が未指定のSVGには、プレビュー上で最小限の表示領域を与える。
- 印刷用とポップアウト用のCSSにも同じ最大幅制約を適用する。

SVGの実寸をCSSで一律に上書きしない。作者が指定した `viewBox` と寸法を優先する。

### 5.5 保存・競合・エクスポート

SVGはMarkdown本文のHTMLブロックとして保存されるため、通常保存、分割保存、競合検出、読み取り専用の `.full.md` 保護は既存仕様を維持する。

エクスポートでは次を確認する。

- HTMLプレビュー・HTML出力: サニタイズ済みSVGをそのまま保持する。
- PDF/Word/画像化経路: 既存の `convertSvgToPng()` を利用する。
- PNG変換が失敗した場合: 対象SVGを見つけやすい通知を出し、変換済みデータがない状態で壊れた画像を出力しない。

外部画像、外部フォント、外部CSSを参照するSVGは、ブラウザ上で表示できてもPNG変換に失敗する可能性がある。このため初回実装では自己完結したSVGのみを正式サポートとする。

## 6. 実装手順

1. 既存モーダルの構造を確認し、SVG入力ダイアログのHTML/CSS/イベントを追加する。
2. 画像ツールバーをメニュー化し、URL画像挿入とSVGコード挿入を分離する。
3. SVGテンプレート、検証、DOMPurify設定、コード挿入ヘルパーを追加する。
4. `paste` ハンドラをSVGテキスト、`image/svg+xml`、ラスター画像の順に分岐させる。
5. 文書モードのプレビュー処理を共通サニタイズ設定へ置き換える。
6. HTML出力、ポップアウト、PDF/Word出力でSVGの表示と変換失敗を確認する。
7. 表示バージョンと変更履歴がある場合は、実装完了時にのみ更新する。

## 7. 受け入れ基準

| ケース | 期待結果 |
| --- | --- |
| ツールバーからSVGを挿入 | `<svg>...</svg>` が本文へ入り、Base64文字列を含まない。 |
| SVGコードを貼り付け | プレビューに表示され、保存・再読込後もコードのまま残る。 |
| `image/svg+xml` を貼り付け | SVGコードとして挿入される。 |
| PNG/JPEGを貼り付け | 従来どおりJPEG Base64画像として挿入される。 |
| `script` や `onclick` を含むSVG | 有害な要素・属性が除去されるか、挿入が拒否される。 |
| 外部画像を参照するSVG | 初回実装では拒否または参照属性が除去される。 |
| HTMLプレビュー | SVGが表示される。 |
| PDF/Word出力 | 自己完結したSVGが可視状態で出力される。 |
| `.full.md` | 既存どおり読み取り専用のままで、SVG対応によって編集可能にならない。 |

## 8. テスト計画

最初は自動テスト基盤を追加せず、ブラウザでの手動回帰テストを実施する。単一HTMLアプリであり、挿入・貼り付け・サニタイズ・複数出力形式を通す確認が重要なためである。

テスト用SVGは、基本図形、グラデーション、`text`/`tspan`、不正な `script`/イベント属性、外部参照を含むものを用意する。確認結果は実装時の変更記録へ残す。

将来、エディタをJavaScriptモジュールへ分割する段階で、`sanitizeSvgMarkupForInsert()` とクリップボード種別判定をユニットテスト対象にする。

## 9. 判断が必要な項目

以下は初回実装では保守的に決めるが、着手前またはレビュー時に確認する。

| 項目 | 初期判断 | 理由 |
| --- | --- | --- |
| `foreignObject` | 不許可 | SVG内HTMLはサニタイズ・エクスポートの複雑さを増やす。 |
| 外部 `image href` | 不許可 | CORSと可搬性の問題がある。 |
| `style` 属性 | 原則不許可 | CSSの許可範囲を広げず、属性ベースで描画する。 |
| SVGファイルのドロップ | 対象外 | まず貼り付けとコード入力を安定させる。 |
| UI形式 | 画像ボタンのメニュー | 既存の画像URL操作を壊さず、SVG機能を発見可能にする。 |

## 10. 完了条件

SVGコードをBase64へ変換せずに挿入、保存、再編集、プレビュー、主要エクスポートできること。許可範囲外のSVG機能は、静かに実行される状態を作らず、除去または明確なエラーとして扱うこと。
