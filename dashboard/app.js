// Token Radar dashboard: renders window.RADAR (written by main.ts as ../data.js).
// No network, no framework. Sortable table, filters, a detail view per protocol and a
// live-token reference view, all from the same ranked board.
(function () {
  var R = window.RADAR;
  if (!R) { document.getElementById('app') && (document.body.textContent = 'No radar data.'); return; }
  var rows = R.rows, live = R.live;

  function money(n) {
    if (n === null || n === undefined) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n >= 0 ? 'pos' : 'neg') + '">' + s + '</span>';
  }
  function age(n) {
    if (n === null || n === undefined) return '—';
    if (n < 30) return n + 'd';
    if (n < 365) return Math.round(n / 30) + 'mo';
    return (n / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Header + footer.
  document.getElementById('meta').textContent =
    'Snapshot ' + R.as_of + ' · ' + R.board_size + ' pre-token protocols ranked · ' +
    R.watchlist_size + ' on the watchlist · ' + R.live_size + ' live tokens as reference · model ' + R.model_version;
  document.getElementById('asof').textContent = R.as_of;

  // Category multiples table.
  var mult = '<table class="mult"><thead><tr><th>Category</th><th class="num">Traded protocols</th>' +
    '<th class="num">Median mcap / TVL</th><th class="num">Multiple used</th></tr></thead><tbody>';
  R.multiples.forEach(function (m) {
    mult += '<tr><td>' + esc(m.category) + '</td><td class="num">' + m.traded + '</td><td class="num">' +
      (m.median_ratio === null ? '—' : m.median_ratio.toFixed(3)) + '</td><td class="num">' + m.multiple.toFixed(3) + '</td></tr>';
  });
  mult += '</tbody></table><p class="hint">Global median mcap / TVL across traded protocols: ' +
    R.global_median_ratio.toFixed(3) + '. Categories with no traded protocol take the global median. ' +
    'Multiples are shrunk toward it (weight ' + R.model.shrink_k + ') and winsorised to [' +
    R.model.multiple_floor + ', ' + R.model.multiple_cap + '].</p>';
  document.getElementById('multiples').innerHTML = mult;

  // Filter options.
  var cats = {}, chains = {};
  rows.forEach(function (r) { cats[r.category || '(no category)'] = 1; r.chains.forEach(function (c) { chains[c] = 1; }); });
  var catSel = document.getElementById('cat'), chainSel = document.getElementById('chain');
  Object.keys(cats).sort().forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
  Object.keys(chains).sort().forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o); });

  // Board: filter + sort + render.
  var sortKey = 'rank', sortDir = 1, selected = null;
  var qEl = document.getElementById('q'), wlEl = document.getElementById('wl');
  var tbody = document.getElementById('rows'), countEl = document.getElementById('count');

  function filtered() {
    var q = qEl.value.trim().toLowerCase(), cat = catSel.value, ch = chainSel.value, wl = wlEl.checked;
    return rows.filter(function (r) {
      if (wl && !r.watchlist) return false;
      if (cat && (r.category || '(no category)') !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sorted(list) {
    var k = sortKey, d = sortDir;
    return list.slice().sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') return va.localeCompare(vb) * d;
      return (va - vb) * d;
    });
  }
  function render() {
    var list = sorted(filtered());
    countEl.textContent = list.length + ' of ' + rows.length + ' protocols shown';
    var html = '';
    list.forEach(function (r) {
      html += '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (r.watchlist ? '<span class="badge">watchlist</span>' : '') + '<br><span class="hint">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="8">No protocols match the filters.</td></tr>';
  }
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
      render();
    });
  });
  [qEl, catSel, chainSel, wlEl].forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });

  // Detail view: model breakdown, farm plan, category comparables.
  function showDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    selected = slug;
    render();
    var base = r.tvl_usd * r.category_multiple;
    var peers = rows.filter(function (x) { return x.category === r.category && x.slug !== r.slug; }).slice(0, 5);
    var peerHtml = peers.length ? '<ul>' + peers.map(function (p) {
      return '<li>#' + p.rank + ' ' + esc(p.name) + ' — TVL ' + money(p.tvl_usd) + ', implied ' + money(p.implied_value_usd) + '</li>';
    }).join('') + '</ul>' : '<p class="hint">No other ranked protocol shares this category.</p>';
    document.getElementById('d-title').textContent = '#' + r.rank + ' ' + r.name + (r.watchlist ? ' — on the watchlist' : '');
    document.getElementById('d-body').innerHTML =
      '<p>' + esc(r.category || 'No category') + ' · ' + esc(r.chains.join(', ')) + ' · listed ' + (r.listed_at || 'unknown') +
      ' · snapshot ' + R.as_of + '.</p>' +
      '<div class="kv">' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b>' + r.category_multiple.toFixed(3) + 'x</b><span>category multiple</span></div>' +
      '<div><b>' + money(base) + '</b><span>TVL x multiple</span></div>' +
      '<div><b>' + r.growth_multiplier.toFixed(2) + 'x</b><span>growth (' + pct(r.change_7d) + ' in 7d)</span></div>' +
      '<div><b>' + r.maturity_multiplier.toFixed(2) + 'x</b><span>maturity (' + age(r.age_days) + ' old)</span></div>' +
      '<div><b>' + money(r.implied_value_usd) + '</b><span>implied value</span></div>' +
      '</div>' +
      '<h3>Farm plan</h3><ol class="farm">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<h3>Same-category comparables</h3>' + peerHtml;
    var d = document.getElementById('detail');
    d.hidden = false;
    d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Live token reference.
  var liveHtml = '';
  live.forEach(function (p) {
    var ratio = (p.mcap_usd !== null && p.tvl_usd > 0) ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—';
    liveHtml += '<tr><td><b>' + esc(p.name) + '</b><br><span class="hint">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td><td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + ratio + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  });
  document.getElementById('live-rows').innerHTML = liveHtml;

  render();
})();
