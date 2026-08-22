/* iacharaSync.js — 「いあきゃら」連携。
 *
 * いあきゃらには公式APIが無く(2026年8月時点、公式が準備中の様子はある)、
 * かつこのアプリはサーバーを持たない静的サイトのため、
 * ブラウザから直接 fetch("https://iachara.com/...") することはCORSでブロックされる。
 *
 * 代わりに「ブックマークレット」方式を採用する。
 *   1. 下記 BOOKMARKLET_SOURCE を、いあきゃらの自分のキャラクターシートページ
 *      (https://iachara.com/view/xxxxx) を開いた状態でブラウザ上で実行する
 *      (ブックマークレットとして登録し、そのページ上でクリックする)。
 *   2. スクリプトは「いあきゃらのページ自身」の同一オリジンJSとして動作し、
 *      名前・カラー・立ち絵・職業・年齢などの表示内容を読み取ってJSONにまとめ、
 *      クリップボードにコピーする。
 *   3. このアプリの「いあきゃらから貼り付け」欄にそのJSONを貼り付けると、
 *      各項目がフォームに自動入力される。
 *
 * これは「ユーザー本人が、自分が投稿したキャラクター情報を、自分のブラウザで
 * 閲覧したページから自分の意思で取り出す」操作であり、いあきゃら利用規約
 * 第15条が禁止する「営利目的の複製・転用」からは除外される
 * (「ただし、ユーザー本人による投稿情報の利用は除く」)行為を想定している。
 * 大量的・自動的な連続アクセスは行わない(1キャラクターごとに手動で実行する)。
 *
 * なお、いあきゃらの公開シートページには「タグ」「シナリオ」「HO」は
 * 表示されないため(ユーザー本人の管理画面側の情報と思われる)、
 * これらは引き続き手動入力が必要。
 */
(function (global) {
  'use strict';

  // いあきゃらのキャラクターシートページ上で実行するブックマークレットの中身。
  // 構造(MUIのクラス名等)に依存せず、"ラベルの次に値が並ぶ"という
  // 表示パターンだけを頼りに読み取ることで、多少のUI変更に耐えるようにしている。
  //
  // 注意: ページ全体ではなく <main> 内だけを対象にし、さらにメール/ログイン/
  // アカウントらしき値は取得段階で除外している。ヘッダーなどにある
  // 「ログイン中のアカウント表示」を誤って character の紹介文に混入させて
  // しまう事故が実際に起きたため(2026-08)、二重にガードしている。
  //
  // 追加で「出力 → キャラ出力」も自動でクリックし、そこで生成される
  // よみ・カラーコード(16進)・性格・好きなもの・嫌いなもの・備考などを含む
  // テキストも合わせて取得する(その項目が無いシートでは静かにスキップする)。
  const BOOKMARKLET_SOURCE = `(async function(){
    try {
      if (!/iachara\\.com/.test(location.hostname)) {
        alert('いあきゃらのキャラクターシートページ(iachara.com)で実行してください。');
        return;
      }
      var emailPattern = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9.-]+/;
      var suspiciousPattern = /mail|メール|login|ログイン|account|アカウント|password|パスワード|token|userid|ユーザーid|uid/i;
      var root = document.querySelector('main') || document.body;
      var fields = {};
      root.querySelectorAll('div').forEach(function (div) {
        if (div.children.length !== 2) return;
        var a = div.children[0], b = div.children[1];
        if (a.tagName !== 'P' || a.children.length !== 0) return;
        var label = a.textContent.trim();
        if (!label || suspiciousPattern.test(label)) return;
        if (b.tagName === 'P' && b.children.length === 0) {
          var value = b.textContent.trim();
          if (!value || emailPattern.test(value) || suspiciousPattern.test(value)) return;
          fields[label] = value;
        } else {
          var swatch = b.querySelector('[style*="background-color"]');
          if (swatch) fields[label] = swatch.style.backgroundColor;
        }
      });

      var charOutputText = '';
      try {
        function findByText(text) {
          var all = root.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].children.length === 0 && all[i].textContent.trim() === text) return all[i];
          }
          return null;
        }
        function clickUp(leaf) {
          if (!leaf) return false;
          var el = leaf;
          for (var i = 0; i < 5 && el; i++) {
            if (el.className && String(el.className).indexOf('button_button') > -1) { el.click(); return true; }
            el = el.parentElement;
          }
          leaf.click();
          return true;
        }
        var capturedText = null;
        var origExec = document.execCommand ? document.execCommand.bind(document) : null;
        if (origExec) {
          document.execCommand = function (cmd) {
            if (cmd === 'copy') {
              var active = document.activeElement;
              if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
                capturedText = active.value;
              }
            }
            return origExec.apply(document, arguments);
          };
        }
        var shutsuryoku = findByText('出力');
        if (shutsuryoku) {
          clickUp(shutsuryoku);
          await new Promise(function (r) { setTimeout(r, 150); });
          var kyaraShutsuryoku = findByText('キャラ出力');
          if (kyaraShutsuryoku) {
            kyaraShutsuryoku.click();
            await new Promise(function (r) { setTimeout(r, 100); });
          }
        }
        if (origExec) document.execCommand = origExec;
        if (capturedText) charOutputText = capturedText;
      } catch (e2) { /* キャラ出力が無いシートなどは無視して続行 */ }

      var name = document.title.replace(/\\s*-\\s*いあきゃら\\s*$/, '').trim();
      var img = document.querySelector('img[src*="image.iaproject.app"]');
      var payload = {
        source: 'iachara-bookmarklet',
        iacharaUrl: location.href,
        name: name,
        image: img ? img.src : '',
        fields: fields,
        charOutputText: charOutputText
      };
      var text = JSON.stringify(payload, null, 2);
      var done = function () {
        alert('キャラクター情報をコピーしました。\\n「キャラクター色相環ソート」の「いあきゃらから貼り付け」欄にペーストしてください。');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { prompt('コピーができなかったので、下のテキストを手動でコピーしてください:', text); });
      } else {
        prompt('下のテキストをコピーしてください:', text);
      }
    } catch (e) {
      alert('読み取りに失敗しました: ' + e.message);
    }
  })();`;

  function bookmarkletHref() {
    return 'javascript:' + encodeURIComponent(BOOKMARKLET_SOURCE);
  }

  // メール/ログイン/アカウントらしき項目を弾くための防御フィルタ。
  // ブックマークレット側にも同じガードがあるが、古いバージョンで
  // 既にコピー済みのJSONを貼り付けるケースにも備えて、受け取り側でも
  // 二重にチェックする。
  const EMAIL_PATTERN = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+/;
  const SUSPICIOUS_PATTERN = /mail|メール|login|ログイン|account|アカウント|password|パスワード|token|userid|ユーザーid|uid/i;

  function isSafeField(label, value) {
    if (!value) return false;
    if (SUSPICIOUS_PATTERN.test(label)) return false;
    if (EMAIL_PATTERN.test(value) || SUSPICIOUS_PATTERN.test(value)) return false;
    return true;
  }

  // 「出力 → キャラ出力」で生成されるテキストのラベル一覧。
  // このテンプレートに沿った「ラベル：値」の行だけを項目の区切りとして認識し、
  // それ以外の行(性格・備考などの自由記述内)は直前の項目の続きとして扱う。
  const CHAR_OUTPUT_LABELS = [
    'よみ', '年齢', '性別', '身長／体重', '身長', '体重', '職業', 'カラーコード',
    '一人称／二人称', '一人称', '二人称', '性格', '好きなもの', '嫌いなもの', '備考'
  ];

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 「キャラ出力」のテキストを { ラベル: 値(複数行可) } に分解する。
  function parseCharOutputText(text) {
    if (!text) return {};
    const pattern = new RegExp(`^(${CHAR_OUTPUT_LABELS.map(escapeRegex).join('|')})[:：]\\s?(.*)$`);
    const fields = {};
    let currentLabel = null;
    let buffer = [];
    const flush = () => {
      if (currentLabel) {
        const value = buffer.join('\n').trim();
        if (value) fields[currentLabel] = value;
      }
      buffer = [];
    };
    text.split('\n').forEach((line) => {
      const m = line.match(pattern);
      if (m) {
        flush();
        currentLabel = m[1];
        buffer = [m[2]];
      } else if (currentLabel) {
        buffer.push(line);
      }
    });
    flush();
    return fields;
  }

  // ブックマークレットが出力したJSONを、Characterのフィールドにマッピングする。
  function parseIacharaExport(rawText) {
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch (e) {
      throw new Error('JSONとして読み取れませんでした。ブックマークレットでコピーした内容をそのまま貼り付けてください。');
    }

    const rawFields = payload.fields || {};
    const fields = {};
    Object.keys(rawFields).forEach((label) => {
      if (isSafeField(label, rawFields[label])) fields[label] = rawFields[label];
    });

    const charFields = {};
    Object.entries(parseCharOutputText(payload.charOutputText || '')).forEach(([label, value]) => {
      if (isSafeField(label, value)) charFields[label] = value;
    });

    const result = {
      name: payload.name || '',
      image: payload.image || '',
      iacharaUrl: payload.iacharaUrl || '',
      source: 'iachara'
    };

    // カラーコードは「キャラ出力」側(16進で直接書かれている)を優先する。
    if (charFields['カラーコード']) {
      const hex = ColorUtils.normalizeHex('#' + charFields['カラーコード'].replace(/^#/, ''));
      if (/^#[0-9a-f]{6}$/.test(hex)) result.color = hex;
    }
    if (!result.color && fields['カラー']) {
      const hex = ColorUtils.rgbStringToHex(fields['カラー']);
      if (hex) result.color = hex;
    }
    result.occupation = charFields['職業'] || fields['職業'] || undefined;
    result.age = charFields['年齢'] || fields['年齢'] || undefined;
    // 性別・身長は、実際のシート表示(fields)側を構造化データとして優先し、
    // 無ければ「キャラ出力」のメモ的な記述(charFields)で補う。
    result.gender = fields['性別'] || charFields['性別'] || undefined;
    result.height = fields['身長'] || charFields['身長／体重'] || charFields['身長'] || undefined;

    const knownLabels = ['カラー', '職業', '年齢', '性別', '身長'];
    const extraLines = Object.keys(fields)
      .filter((label) => !knownLabels.includes(label) && fields[label])
      .map((label) => `${label}: ${fields[label]}`);

    const knownCharLabels = ['カラーコード', '職業', '年齢', '性別', '身長／体重', '身長'];
    const charExtraOrder = ['よみ', '体重', '一人称／二人称', '一人称', '二人称', '性格', '好きなもの', '嫌いなもの', '備考'];
    charExtraOrder.forEach((label) => {
      if (!knownCharLabels.includes(label) && charFields[label]) {
        extraLines.push(`${label}: ${charFields[label]}`);
      }
    });

    if (extraLines.length) result.extraInfo = extraLines.join('\n');

    return result;
  }

  async function fetchFromIachara(url) {
    throw new Error(
      '直接取得は未対応です(CORSの制約のため)。いあきゃらのページ上でブックマークレットを実行し、出力されたJSONをこちらに貼り付けてください。'
    );
  }

  global.IacharaSync = { BOOKMARKLET_SOURCE, bookmarkletHref, parseIacharaExport, fetchFromIachara };
})(window);
