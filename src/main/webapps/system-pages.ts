function toDataUrl(html: string) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

export function loadingPageUrl(title: string) {
  return toDataUrl(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Loading</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #f2f2f7; color: #111; }
      .wrap { height: 100vh; display: grid; place-items: center; }
      .card { display: grid; gap: 10px; padding: 20px 22px; border-radius: 14px; background: rgba(255,255,255,.75); border: 1px solid rgba(60,60,67,.18); }
      .title { font-weight: 600; }
      .sub { color: rgba(60,60,67,.7); font-size: 13px; }
      .spinner { width: 18px; height: 18px; border-radius: 999px; border: 2px solid rgba(0,0,0,.18); border-top-color: rgba(0,0,0,.55); animation: spin .9s linear infinite; }
      @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      .row { display: flex; align-items: center; gap: 10px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="row">
          <div class="spinner" aria-hidden="true"></div>
          <div class="title">${escapeHtml(title)}</div>
        </div>
        <div class="sub">正在加载网页内容…</div>
      </div>
    </div>
  </body>
</html>`)
}

export function errorPageUrl(args: { title: string; message: string; url?: string }) {
  return toDataUrl(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Load failed</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #f2f2f7; color: #111; }
      .wrap { height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { max-width: 720px; display: grid; gap: 10px; padding: 20px 22px; border-radius: 14px; background: rgba(255,255,255,.75); border: 1px solid rgba(60,60,67,.18); }
      .title { font-weight: 700; }
      .sub { color: rgba(60,60,67,.7); font-size: 13px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: rgba(60,60,67,.7); word-break: break-all; }
      .btn { display: inline-block; border-radius: 10px; border: 1px solid rgba(60,60,67,.18); padding: 8px 10px; background: rgba(255,255,255,.9); text-decoration: none; color: inherit; cursor: pointer; }
      .btn:disabled { opacity: .4; cursor: default; }
      .btnRow { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="title">${escapeHtml(args.title)}</div>
        <div class="sub">网页加载失败。你可以检查网络、允许域名设置，或切换到其他应用。</div>
        <div class="mono">${escapeHtml(args.message)}</div>
        ${args.url ? `<div class="mono">${escapeHtml(args.url)}</div>` : ''}
        <div class="btnRow">
          <button class="btn" type="button" data-error-retry ${args.url ? `data-url="${escapeAttr(args.url)}"` : ''}>重试</button>
        </div>
      </div>
    </div>
    <script>
      (function () {
        const btn = document.querySelector('[data-error-retry]');
        if (!btn) return;
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (url && url !== '#') {
            window.location.href = url;
          } else {
            window.location.reload();
          }
        });
      })();
    </script>
  </body>
</html>`)
}

function escapeHtml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function escapeAttr(s: string) {
  return s.replaceAll('"', '%22')
}

