/*
 * The single page of the draft-label review tool (slice B of IDEA-261111-5cc), served from 127.0.0.1 only.
 *
 * Rules this file keeps:
 * - Self-contained: no external script, stylesheet, font or image, no analytics. Captions and photos of real posts are for the
 *   maintainer's eyes only and must never leave the machine (the server also sends a CSP that forbids any other origin).
 * - Everything that comes from a post (caption, names, handles) is put into the page as TEXT (textContent, value, attributes),
 *   never as HTML, so a caption cannot run code in the page.
 * - The script avoids backticks and "${" so it can live in this template literal unchanged.
 */

const PAGE_STYLE = String.raw`
:root { color-scheme: light dark; --line: #8886; --ok: #1a7f37; --warn: #9a6700; --bad: #cf222e; --mute: #888; }
* { box-sizing: border-box; }
body { margin: 0; padding: 12px 16px; font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 18px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 12px 0 6px; }
a { color: inherit; }
button, select, input, textarea { font: inherit; }
button { padding: 4px 10px; cursor: pointer; }
input[type=text], select { padding: 3px 5px; width: 100%; }
input.w14 { width: 14em; } input.w18 { width: 18em; } figure.fig { margin: 0; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.mute { color: var(--mute); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 6px 0; }
.badge { display: inline-block; padding: 0 6px; border-radius: 8px; border: 1px solid var(--line); font-size: 12px; }
.badge.verified { color: var(--ok); } .badge.flagged { color: var(--bad); } .badge.skipped { color: var(--warn); }
.flag { display: inline-block; margin: 0 4px 2px 0; padding: 0 6px; border-radius: 8px; background: #bf870033; font-size: 12px; cursor: help; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 16px; align-items: start; }
.left { position: sticky; top: 8px; max-height: calc(100vh - 24px); overflow: auto; }
.left img { display: block; width: 100%; height: auto; border: 1px solid var(--line); margin: 0 0 4px; }
.left figcaption { font-size: 12px; color: var(--mute); margin-bottom: 10px; }
.left pre { white-space: pre-wrap; word-break: break-word; border: 1px solid var(--line); padding: 8px; }
.card { border: 1px solid var(--line); border-radius: 6px; padding: 8px; margin: 8px 0; }
.card label, .grid label { display: block; font-size: 12px; color: var(--mute); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 8px; }
.sched { border-top: 1px dashed var(--line); margin-top: 6px; padding-top: 6px; }
.status { min-height: 1.4em; margin: 6px 0; }
.status.ok { color: var(--ok); } .status.warn { color: var(--warn); } .status.error { color: var(--bad); }
.banner { border: 1px solid var(--line); border-left: 4px solid var(--warn); padding: 4px 8px; margin: 6px 0; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } .left { position: static; max-height: none; } }
`;

const PAGE_SCRIPT = String.raw`
(function () {
  'use strict';
  var app = document.getElementById('app');
  var config = null;
  var dirty = false;
  var enc = encodeURIComponent;

  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  // h(tag, attributes, ...children): builds an element; every value is set as text or as an attribute, never as HTML.
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var value;
    var hasValue = false;
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') { value = v; hasValue = true; }
      else if (k === 'checked') el.checked = true;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    if (hasValue) el.value = value;
    return el;
  }
  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('api/' + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) { return { status: res.status, body: json }; });
    });
  }
  function loadConfig() {
    if (config) return Promise.resolve(config);
    return api('GET', 'config').then(function (r) { config = r.body; return config; });
  }
  function clear() { app.textContent = ''; }
  function go(hash) { dirty = false; location.hash = hash; }

  // ------------------------------------------------------------------------------------------------------------------ list
  function showList() {
    dirty = false;
    Promise.all([loadConfig(), api('GET', 'drafts')]).then(function (results) {
      var data = results[1].body;
      var filters = { status: 'all', flag: 'all', text: '' };
      var table = h('table');
      var count = h('span', { class: 'mute' });

      function rows() {
        return data.posts.filter(function (p) {
          if (filters.status !== 'all' && p.status !== filters.status) return false;
          if (filters.flag === 'any' && p.flags.length === 0) return false;
          if (filters.flag !== 'all' && filters.flag !== 'any' && !p.flags.some(function (f) { return f.flag === filters.flag; })) return false;
          if (filters.text && (p.stratum || '').toLowerCase().indexOf(filters.text.toLowerCase()) < 0 && p.postId.toLowerCase().indexOf(filters.text.toLowerCase()) < 0) return false;
          return true;
        });
      }
      function renderTable() {
        table.textContent = '';
        table.appendChild(h('tr', {}, ['Post', 'Stratum', 'Images', 'Events', 'Status', 'Flags', 'Notes'].map(function (t) { return h('th', {}, t); })));
        var shown = rows();
        count.textContent = shown.length + ' of ' + data.posts.length + ' shown';
        shown.forEach(function (p) {
          table.appendChild(h('tr', {},
            h('td', {}, h('a', { href: '#/post/' + enc(p.postId) }, p.postId)),
            h('td', {}, p.stratum || ''),
            h('td', {}, String(p.imageCount)),
            h('td', {}, String(p.eventCount)),
            h('td', {}, h('span', { class: 'badge ' + p.status, title: p.note || '' }, p.status)),
            h('td', {}, p.flags.map(function (f) { return h('span', { class: 'flag', title: (config.flagHelp[f.flag] || '') + (f.detail ? ' (' + f.detail + ')' : '') }, f.flag + (f.detail ? ': ' + f.detail : '')); })),
            h('td', { class: 'mute' }, p.warnings.length ? p.warnings.length + ' warning(s)' : '', p.edited ? ' edited' : '')
          ));
        });
      }
      function select(options, onchange) {
        return h('select', { onchange: function (e) { onchange(e.target.value); renderTable(); } }, options.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
      }

      var s = data.summary;
      var firstPending = data.posts.filter(function (p) { return p.status === 'pending'; })[0];
      clear();
      append(app, [
        h('h1', {}, 'Draft label review'),
        h('p', { class: 'mute' }, 'Reading and writing: ' + config.storage + '. Local only; nothing on this page is sent anywhere else. Drafts are UNVERIFIED, so every field may be wrong.'),
        h('p', {}, data.posts.length + ' drafts: ' + s.pending + ' pending, ' + s.verified + ' verified, ' + s.skipped + ' skipped, ' + s.flagged + ' flagged. '),
        data.warnings.length ? h('div', { class: 'banner' }, data.warnings.join(' ')) : null,
        data.unreadable.length ? h('div', { class: 'banner' }, data.unreadable.length + ' draft(s) could not be read: ', data.unreadable.map(function (u) { return h('div', {}, u.postId + ': ' + u.problem); })) : null,
        h('div', { class: 'row' },
          firstPending ? h('button', { onclick: function () { go('#/post/' + enc(firstPending.postId)); } }, 'Open the first pending post') : h('span', { class: 'mute' }, 'No post is pending.'),
          select([['all', 'any status'], ['pending', 'pending'], ['verified', 'verified'], ['skipped', 'skipped'], ['flagged', 'flagged']], function (v) { filters.status = v; }),
          select([['all', 'any flag or none'], ['any', 'has a flag']].concat(Object.keys(config.flagHelp).map(function (f) { return [f, f]; })), function (v) { filters.flag = v; }),
          h('input', { type: 'text', placeholder: 'filter by stratum or id', class: 'w14', oninput: function (e) { filters.text = e.target.value; renderTable(); } }),
          count),
        table
      ]);
      renderTable();
    });
  }

  // ------------------------------------------------------------------------------------------------------------------ post
  function showPost(id) {
    Promise.all([loadConfig(), api('GET', 'post/' + enc(id))]).then(function (results) {
      var res = results[1];
      if (res.status !== 200) { clear(); append(app, [h('p', {}, h('a', { href: '#/' }, 'Back to the list')), h('p', { class: 'status error' }, res.body.error || 'Could not load this post.')]); return; }
      var data = res.body;
      var label = data.label;
      if (!Array.isArray(label.events)) label.events = [];
      var statusEl = h('p', { class: 'status', role: 'status' });
      var flagsEl = h('div', {});
      var eventsEl = h('div', {});
      var badgeEl = h('span', {});
      var noteEl = h('input', { type: 'text', placeholder: 'note (optional, local only)', value: data.note || '', class: 'w18' });
      var nextId = data.next;

      function status(text, kind) { statusEl.textContent = text; statusEl.className = 'status ' + (kind || ''); }
      function markDirty() { dirty = true; status('Unsaved changes.', 'warn'); }
      function showFlags(flags) {
        flagsEl.textContent = '';
        if (!flags.length) { flagsEl.appendChild(h('span', { class: 'mute' }, 'No flags.')); return; }
        flags.forEach(function (f) {
          flagsEl.appendChild(h('div', { class: 'banner' }, h('b', {}, f.flag + (f.detail ? ' (' + f.detail + ')' : '') + ': '), config.flagHelp[f.flag] || ''));
        });
      }
      function showBadge(st) { badgeEl.className = 'badge ' + st; badgeEl.textContent = st; }
      function list(text) { return text.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t !== ''; }); }

      function field(title, key, obj, extra) {
        var input = h('input', { type: 'text', value: obj[key] === undefined ? '' : String(obj[key]), list: extra && extra.list, oninput: function (e) { obj[key] = e.target.value; markDirty(); } });
        return h('label', {}, title, input);
      }
      function listField(title, key, ev, datalist) {
        var input = h('input', { type: 'text', value: (ev[key] || []).join(', '), list: datalist, placeholder: 'comma separated; empty = not scored', oninput: function (e) {
          var items = list(e.target.value);
          if (items.length) ev[key] = items; else delete ev[key];
          markDirty();
        } });
        return h('label', {}, title, input);
      }
      function renderEvents() {
        eventsEl.textContent = '';
        label.events.forEach(function (ev, i) {
          if (!Array.isArray(ev.schedules)) ev.schedules = [];
          var schedules = h('div', {});
          ev.schedules.forEach(function (sc, j) {
            schedules.appendChild(h('div', { class: 'sched' },
              h('div', { class: 'grid' },
                field('Start date (YYYY-MM-DD)', 'eventStartDate', sc),
                field('End date', 'eventEndDate', sc),
                field('Start time', 'eventStartTime', sc),
                field('End time', 'eventEndTime', sc),
                field('Place (this schedule)', 'location', sc)),
              h('button', { type: 'button', onclick: function () { ev.schedules.splice(j, 1); markDirty(); renderEvents(); } }, 'Remove schedule ' + (j + 1))));
          });
          eventsEl.appendChild(h('div', { class: 'card' },
            h('div', { class: 'row' }, h('b', {}, 'Event ' + (i + 1) + ' of ' + label.events.length),
              h('button', { type: 'button', onclick: function () { if (confirm('Remove event ' + (i + 1) + '?')) { label.events.splice(i, 1); markDirty(); renderEvents(); } } }, 'Remove event')),
            h('div', { class: 'grid' },
              field('Event name', 'eventName', ev),
              field('Place (event)', 'location', ev),
              field('Ticket price (digits; empty = not stated)', 'ticketPrice', ev),
              h('label', {}, 'Free', h('input', { type: 'checkbox', checked: ev.free === true, onchange: function (e) { if (e.target.checked) ev.free = true; else delete ev.free; markDirty(); } })),
              listField('Categories', 'categories', ev, 'categories'),
              listField('Performers', 'performers', ev)),
            h('h2', {}, 'Schedules (' + ev.schedules.length + ')'),
            schedules,
            h('button', { type: 'button', onclick: function () { ev.schedules.push({ eventStartDate: '' }); markDirty(); renderEvents(); } }, 'Add a schedule')));
        });
        eventsEl.appendChild(h('button', { type: 'button', onclick: function () { label.events.push({ eventName: '', schedules: [{ eventStartDate: '' }] }); markDirty(); renderEvents(); } }, 'Add an event'));
      }

      function after(next) { if (next) go('#/post/' + enc(next)); else go('#/'); }
      function save() {
        return api('PUT', 'post/' + enc(id) + '/edit', { label: label }).then(function (r) {
          if (r.status === 200) { dirty = false; showFlags(r.body.flags); status('Edits saved on this computer.', 'ok'); } else status(r.body.error || 'Could not save.', 'error');
        });
      }
      function verify(overwrite) {
        status('Checking and uploading...');
        api('POST', 'post/' + enc(id) + '/verify', { label: label, overwrite: !!overwrite }).then(function (r) {
          if (r.status === 200) {
            dirty = false; showBadge('verified');
            status('Verified and uploaded.', 'ok');
            statusEl.appendChild(document.createTextNode(' '));
            statusEl.appendChild(nextId ? h('a', { href: '#/post/' + enc(nextId) }, 'Next pending post') : h('a', { href: '#/' }, 'Back to the list'));
          } else if (r.status === 409) {
            if (confirm('A verified label for this post already exists in the store. Overwrite it?')) verify(true); else status('Not overwritten.', 'warn');
          } else status(r.body.error || 'Verification failed.', 'error');
        });
      }
      function mark(st) {
        api('POST', 'post/' + enc(id) + '/status', { status: st, note: noteEl.value }).then(function (r) {
          if (r.status === 200) { dirty = false; showBadge(st); status('Marked ' + st + '.', 'ok'); after(nextId); } else status(r.body.error || 'Could not save the status.', 'error');
        });
      }

      var reasonSel = h('select', { onchange: function (e) { if (e.target.value) label.groupingReason = e.target.value; else delete label.groupingReason; markDirty(); } },
        [''].concat(config.groupingReasons).map(function (r) { return h('option', { value: r }, r || '(none)'); }));
      reasonSel.value = label.groupingReason || '';

      var meta = data.meta || {};
      var imageCount = data.images.length;
      clear();
      append(app, [
        h('div', { class: 'row' }, h('a', { href: '#/' }, 'Back to the list'), h('h1', {}, id), badgeEl, data.edited ? h('span', { class: 'mute' }, 'has saved edits') : null),
        h('div', { class: 'cols' },
          h('div', { class: 'left' },
            h('h2', {}, 'Caption (as production saw it)'),
            h('pre', {}, label.caption || '(empty)'),
            data.images.map(function (file, i) {
              return h('figure', { class: 'fig' }, h('img', { src: 'img/' + enc(id) + '/' + enc(file), alt: 'image ' + (i + 1) + ' of ' + imageCount, loading: 'lazy' }), h('figcaption', {}, 'Image ' + (i + 1) + ' of ' + imageCount));
            })),
          h('div', { class: 'right' },
            h('p', { class: 'mute' }, 'Draft from production: UNVERIFIED. Compare every field with the images and the caption; the input fields (caption, images, date, owner) are fixed and cannot be edited here.'),
            h('p', { class: 'mute' }, 'Stratum: ' + (meta.stratum || 'unknown') + '. Events in the draft: ' + (meta.extractedEventCount === undefined ? 'unknown' : meta.extractedEventCount) + '. Extraction passes: ' + (meta.extractionAuditRows === undefined ? 'unknown' : meta.extractionAuditRows) + '. Images fetched: ' + (meta.imagesFetched === undefined ? 'unknown' : meta.imagesFetched) + ' of ' + (meta.imagesAvailable === undefined ? 'unknown' : meta.imagesAvailable) + '.'),
            meta.postUrl ? h('p', { class: 'mute' }, 'Source: ' + meta.postUrl) : null,
            data.warnings.length ? h('div', { class: 'banner' }, data.warnings.join(' ')) : null,
            flagsEl,
            h('h2', {}, 'Expected answer'),
            h('label', {}, 'Grouping reason', reasonSel),
            h('datalist', { id: 'categories' }, config.categories.map(function (c) { return h('option', { value: c }); })),
            eventsEl,
            statusEl,
            h('div', { class: 'row' },
              h('button', { type: 'button', onclick: save }, 'Save edits'),
              h('button', { type: 'button', onclick: function () { verify(false); } }, 'Verify and upload'),
              h('button', { type: 'button', onclick: function () { if (confirm('Throw away your saved edits and go back to the draft?')) api('DELETE', 'post/' + enc(id) + '/edit').then(function () { dirty = false; showPost(id); }); } }, 'Reset to the draft')),
            h('div', { class: 'row' }, noteEl,
              h('button', { type: 'button', onclick: function () { mark('skipped'); } }, 'Skip'),
              h('button', { type: 'button', onclick: function () { mark('flagged'); } }, 'Flag for later'))))
      ]);
      showBadge(data.status);
      showFlags(data.flags);
      renderEvents();
    });
  }

  function route() {
    var m = /^#\/post\/(.+)$/.exec(location.hash);
    if (m) showPost(decodeURIComponent(m[1])); else showList();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  route();
})();
`;

export { PAGE_SCRIPT, PAGE_STYLE };

export function renderReviewPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Draft label review</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<div id="app"><p>Loading...</p></div>
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;
}
