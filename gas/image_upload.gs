/**
 * 受付画面（royallips/royal-reception）の画像を、利用表アプリから保存するための Apps Script。
 * 端末ごとに GitHub トークンを入れなくて済むよう、トークンはこのスクリプトのプロパティにだけ保存する。
 *
 * スクリプト プロパティ（プロジェクトの設定 → スクリプト プロパティ）
 *   GH_TOKEN : royal-reception に書き込める GitHub トークン
 *   PASS     : 利用表アプリの合言葉（クラウド同期のパスワードと同じ）
 *
 * デプロイ：ウェブアプリ / 次のユーザーとして実行：自分 / アクセスできるユーザー：全員
 */
const REPO = 'royallips/royal-reception';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (!req.pass || req.pass !== props.getProperty('PASS')) return json_({ ok: false, error: 'auth' });
    const headers = { Authorization: 'token ' + props.getProperty('GH_TOKEN'), Accept: 'application/vnd.github+json' };

    // 画像の一覧（img フォルダ）
    if (req.action === 'list') {
      const r = UrlFetchApp.fetch(api_('img') + '?ref=main', { headers, muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) return json_({ ok: false, error: 'github', status: r.getResponseCode() });
      const files = JSON.parse(r.getContentText()).map(f => ({ name: f.name, sha: f.sha, url: f.download_url }));
      return json_({ ok: true, files });
    }

    // 1ファイルの操作は img/*.jpg だけに限る
    const path = String(req.path || '');
    if (!/^img\/[^\/]+\.jpg$/.test(path)) return json_({ ok: false, error: 'path' });
    const url = api_(path);
    const current = () => {
      const r = UrlFetchApp.fetch(url + '?ref=main', { headers, muteHttpExceptions: true });
      return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
    };

    if (req.action === 'get') {
      const f = current();
      return json_({ ok: true, exists: !!f, content: f ? f.content : null });
    }
    if (req.action === 'put') {
      const f = current();
      const body = { message: req.message || '画像を更新', content: req.content, branch: 'main' };
      if (f) body.sha = f.sha;
      const r = UrlFetchApp.fetch(url, { method: 'put', headers, contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
      return json_({ ok: r.getResponseCode() < 300, status: r.getResponseCode() });
    }
    if (req.action === 'delete') {
      const f = current();
      if (!f) return json_({ ok: true });
      const body = { message: req.message || '画像を削除', sha: f.sha, branch: 'main' };
      const r = UrlFetchApp.fetch(url, { method: 'delete', headers, contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
      return json_({ ok: r.getResponseCode() < 300, status: r.getResponseCode() });
    }
    return json_({ ok: false, error: 'action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function api_(path) {
  return 'https://api.github.com/repos/' + REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
