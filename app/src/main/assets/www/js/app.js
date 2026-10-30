/* Celtv Play — app principal (ES5, compatível com TVs Samsung/LG antigas) */
(function () {
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function bg(e, url) { if (url) e.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")'; }
  var tt = null;
  function toast(m) { var t = $('toast'); t.textContent = m; t.className = 'show'; clearTimeout(tt); tt = setTimeout(function () { t.className = ''; }, 3200); }
  function loading(on, txt) { $('loading').className = on ? '' : 'hidden'; if (txt) $('loadingTxt').textContent = txt; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dur(s) { s = Math.max(0, Math.floor(s || 0)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60); }
  function tick() { var d = new Date(), t = pad(d.getHours()) + ':' + pad(d.getMinutes()), c = document.querySelectorAll('.clock'); for (var i = 0; i < c.length; i++) c[i].textContent = t; }
  setInterval(tick, 15000); tick();

  // Teclas do controle Samsung
  try {
    if (window.tizen && tizen.tvinputdevice) tizen.tvinputdevice.registerKeyBatch(['ChannelUp', 'ChannelDown', 'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info']);
  } catch (e) {}

  /* ───────── Perfis, favoritos, recentes, posição ───────── */
  var profiles = Store.get('profiles', []);
  function saveProfiles() { if (!Store.set('profiles', profiles)) toast('⚠️ Lista grande demais para salvar no aparelho. Use a URL da lista.'); profBackup(); }
  function cloudOn() { return !!(window.CLOUD && CLOUD.url && CLOUD.url.indexOf('SEU-PROJETO') < 0); }
  function deviceId() {
    var id = Store.get('dev_id', null); if (id) return id;
    try { if (window.webapis && webapis.productinfo && webapis.productinfo.getDuid) id = webapis.productinfo.getDuid(); } catch (e) {}
    if (!id) { try { if (window.AndroidApp && AndroidApp.deviceId) id = AndroidApp.deviceId(); } catch (e) {} }
    if (!id) id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    Store.set('dev_id', id); return id;
  }
  function profBackup() { if (!cloudOn()) return; try { cloudRpc('celtv_prof_save', { p_duid: deviceId(), p_prof: profiles }, function () {}); } catch (e) {} }
  /* ── Modo de navegação: tv (controle) ou phone (rolagem/toque) ── */
  function hasTouch() { try { return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0); } catch (e) { return false; } }
  function defaultMode() {
    var p = msgPlat();
    if (p === 'tizen' || p === 'webos') return 'tv';   // Smart TV = controle
    if (hasTouch()) return 'phone';                    // tem toque (celular/tablet) = rolagem
    return 'tv';                                        // TV box / PC sem toque = controle
  }
  function uiMode() { return Store.get('uimode', defaultMode()); }
  function applyMode() {
    var on = (uiMode() === 'phone');
    try { document.documentElement.classList[on ? 'add' : 'remove']('phone'); } catch (e) {}
    try { document.body.classList[on ? 'add' : 'remove']('phone'); } catch (e) {}
  }
  function toggleMode() { Store.set('uimode', uiMode() === 'phone' ? 'tv' : 'phone'); applyMode(); }
  function pid() { var p = Api.profile(); return p ? p.id : 'x'; }
  function favs() { return Store.get('fav_' + pid(), { live: [], vod: [], series: [] }); }
  function isFav(kind, id) { var f = favs()[kind]; for (var i = 0; i < f.length; i++) if (f[i].id === id) return true; return false; }
  function toggleFav(kind, item) {
    var f = favs(), arr = f[kind], i, found = -1;
    for (i = 0; i < arr.length; i++) if (arr[i].id === item.id) found = i;
    if (found >= 0) { arr.splice(found, 1); toast('Removido dos favoritos'); }
    else { arr.unshift(item); toast('⭐ Adicionado aos favoritos'); }
    Store.set('fav_' + pid(), f);
    return found < 0;
  }
  function addRecent(kind, item) {
    var r = Store.get('rec_' + pid(), []), out = [{ kind: kind, item: item }];
    for (var i = 0; i < r.length && out.length < 40; i++) if (!(r[i].kind === kind && r[i].item.id === item.id)) out.push(r[i]);
    Store.set('rec_' + pid(), out);
  }
  function posKey(kind, id) { return kind + ':' + id; }
  function getPos(k) { var p = Store.get('pos_' + pid(), {}); return p[k] || null; }
  function setPos(k, t, d) {
    var p = Store.get('pos_' + pid(), {});
    if (!t || (d && t > d - 90)) delete p[k]; else p[k] = { t: Math.floor(t), d: Math.floor(d || 0) };
    Store.set('pos_' + pid(), p);
  }

  /* ───────── Navegação entre telas ───────── */
  var SCR = {}, current = null, stack = [];
  function section(name) { return $('s-' + name); }
  function go(name, arg) {
    if (current) { stack.push({ name: current, focusEl: Nav.current() }); section(current).className = 'screen hidden'; if (SCR[current].leave) SCR[current].leave(); }
    current = name; section(name).className = 'screen'; Nav.setScope(section(name));
    SCR[name].enter(arg); tick();
  }
  function replaceRoot(name, arg) {
    if (current) { section(current).className = 'screen hidden'; if (SCR[current].leave) SCR[current].leave(); }
    stack = []; current = null; go(name, arg); stack = [];
  }
  function back() {
    if (SCR[current].back && SCR[current].back() === true) return;
    if (!stack.length) return exitAsk();
    var prev = stack.pop();
    section(current).className = 'screen hidden'; if (SCR[current].leave) SCR[current].leave();
    current = prev.name; section(current).className = 'screen'; Nav.setScope(section(current));
    if (SCR[current].resume) SCR[current].resume();
    if (prev.focusEl && prev.focusEl.offsetParent !== null) Nav.focus(prev.focusEl); else Nav.first();
  }
  var exitT = 0;
  function exitAsk() {
    if (Date.now() - exitT < 2500) { if (window.AndroidApp) { AndroidApp.exit(); return; } try { tizen.application.getCurrentApplication().exit(); } catch (e) { try { window.close(); } catch (e2) {} } return; }
    exitT = Date.now(); toast('Pressione Voltar de novo para sair');
  }

  /* Lista com renderização em partes (milhares de itens sem travar a TV) */
  function lazyList(box, items, render, chunk) {
    box.innerHTML = ''; var n = 0;
    function more() {
      var end = Math.min(items.length, n + chunk);
      for (; n < end; n++) (function (i) {
        var e = render(items[i], i), of = e._onFocus;
        e._onFocus = function (x) { if (i > n - 10 && n < items.length) more(); if (of) of(x); };
        box.appendChild(e);
      })(n);
    }
    more();
    var scroller = box.className.indexOf('scroll') >= 0 ? box : box.parentNode;
    scroller.scrollTop = 0;
    return { more: more };
  }

  /* ───────── LOGIN ───────── */
  var mode = 'xtream';
  SCR.login = {
    enter: function (msg) {
      $('loginMsg').textContent = msg || ''; $('loginMsg').className = 'msg';
      renderProfiles();
      setTimeout(function () { Nav.focus(profiles.length ? $('profList').firstChild : $('tabX')); }, 0);
    }
  };
  function setMode(m) {
    mode = m;
    $('tabX').className = 'tab f' + (m === 'xtream' ? ' on' : '') + (Nav.current() === $('tabX') ? ' focus' : '');
    $('tabM').className = 'tab f' + (m === 'm3u' ? ' on' : '') + (Nav.current() === $('tabM') ? ' focus' : '');
    $('formX').className = m === 'xtream' ? '' : 'hidden';
    $('formM').className = m === 'm3u' ? '' : 'hidden';
  }
  $('tabX')._onEnter = function () { setMode('xtream'); };
  $('tabM')._onEnter = function () { setMode('m3u'); };
  function renderProfiles() {
    var box = $('profList'); box.innerHTML = '';
    $('profBox').className = profiles.length ? 'profiles' : 'profiles hidden';
    profiles.forEach(function (p) {
      var r = el('div', 'prof f'), i = el('div', 'pi', p.type === 'xtream' ? '🔐' : '📄'), t = el('div');
      t.appendChild(el('div', 'pn', p.name));
      t.appendChild(el('div', 'ps', p.type === 'xtream' ? p.server.replace(/^https?:\/\//, '') + ' · ' + p.user : (p.m3uUrl ? 'Lista M3U (URL)' : 'Lista M3U (colada)')));
      r.appendChild(i); r.appendChild(t);
      r._onEnter = function () { useProfile(p); };
      box.appendChild(r);
    });
  }
  $('btnLogin')._onEnter = function () {
    var p;
    if (mode === 'xtream') {
      var s = normServer($('xServer').value), u = $('xUser').value.trim(), w = $('xPass').value;
      if (!s || !u || !w) { $('loginMsg').textContent = 'Preencha servidor, usuário e senha'; return; }
      p = { id: 'p' + Date.now(), type: 'xtream', name: $('xName').value.trim() || u, server: s, user: u, pass: w };
    } else {
      var url = $('mUrl').value.trim(), txt = $('mText').value.trim();
      if (!url && !txt) { $('loginMsg').textContent = 'Informe a URL da lista ou cole o conteúdo'; return; }
      if (url && !/^https?:\/\//i.test(url)) url = 'http://' + url;
      p = { id: 'p' + Date.now(), type: 'm3u', name: $('mName').value.trim() || 'Lista M3U', m3uUrl: txt ? '' : url, m3uText: txt || '' };
    }
    useProfile(p, true);
  };
  function useProfile(p, isNew) {
    loading(true, 'Conectando a ' + p.name + '…');
    Api.login(p, function (err) {
      loading(false);
      if (err) { if (current !== 'login') replaceRoot('login', '❌ ' + err.message); else { $('loginMsg').textContent = '❌ ' + err.message; } return; }
      if (isNew) {
        for (var i = profiles.length - 1; i >= 0; i--) {
          var q = profiles[i];
          if (q.type === p.type && ((p.type === 'xtream' && q.server === p.server && q.user === p.user) || (p.type === 'm3u' && p.m3uUrl && q.m3uUrl === p.m3uUrl))) { p.id = q.id; profiles.splice(i, 1); }
        }
        profiles.unshift(p); saveProfiles();
      }
      Store.set('active', p.id);
      replaceRoot('home');
    });
  }

  /* ───────── HOME (estilo streaming) ───────── */
  var HOME = { items: [], idx: 0, heroT: null, built: '' }, navWired = false;
  function wireNav() {
    if (navWired) return; navWired = true;
    var els = document.querySelectorAll('#s-home .nav .f');
    for (var i = 0; i < els.length; i++) els[i]._onEnter = (function (e) { return function () { homeGo(e.getAttribute('data-go')); }; })(els[i]);
  }
  SCR.home = {
    enter: function () { wireNav(); setAccount(); need(['live', 'vod', 'series'], function () { buildHome(true); }); },
    resume: function () { setAccount(); buildHome(false); },
    leave: function () { clearInterval(HOME.heroT); }
  };
  function setAccount() {
    var p = Api.profile(), inf = Api.info(), days = null, exp;
    $('acctName').textContent = p.type === 'xtream' ? p.user : p.name;
    if (inf && inf.user_info && inf.user_info.exp_date && inf.user_info.exp_date !== 'null') {
      days = Math.ceil((Number(inf.user_info.exp_date) * 1000 - Date.now()) / 86400000);
      exp = days > 0 ? 'vence em ' + days + ' dia' + (days > 1 ? 's' : '') : 'vencido';
    } else exp = p.type === 'xtream' ? 'sem vencimento' : 'lista M3U';
    $('acctExp').textContent = exp;
    $('acctAv').textContent = days != null ? (days > 0 ? (days > 999 ? '∞' : days) : '!') : '●';
  }
  function hero(i) {
    var h = HOME.items[i]; HOME.idx = i;
    var dots = $('heroDots'); dots.innerHTML = '';
    for (var k = 0; k < HOME.items.length; k++) dots.appendChild(el('div', 'dot' + (k === i ? ' on' : '')));
    if (!h) { $('heroTitle').textContent = 'Celtv Play'; $('heroTags').innerHTML = ''; $('heroPlot').textContent = 'Use o menu acima para ver seus canais, filmes e séries.'; $('heroBg').style.backgroundImage = ''; $('heroBtn').style.display = 'none'; return; }
    var it = h.item;
    $('heroBtn').style.display = '';
    $('heroTitle').textContent = it.name;
    var tg = $('heroTags'); tg.innerHTML = ''; tg.appendChild(el('span', 'htag', h.kind === 'series' ? 'SÉRIE' : 'FILME'));
    if (it.rating && Number(it.rating) > 0) tg.appendChild(el('span', 'htag', '★ ' + Number(it.rating).toFixed(1)));
    $('heroPlot').textContent = it.plot || '';
    $('heroBg').style.backgroundImage = ''; bg($('heroBg'), it.logo);
    $('heroBtn')._onEnter = function () { go('detail', { kind: h.kind, item: it }); };
  }
  function buildHome(reset) {
    var D = Api.data(), i, withImg = [], any = [];
    for (i = 0; i < D.series.length; i++) { any.push({ kind: 'series', item: D.series[i] }); if (D.series[i].logo && withImg.length < 6) withImg.push({ kind: 'series', item: D.series[i] }); }
    for (i = 0; i < D.vod.length; i++) { any.push({ kind: 'vod', item: D.vod[i] }); if (D.vod[i].logo && withImg.length < 6) withImg.push({ kind: 'vod', item: D.vod[i] }); }
    HOME.items = withImg.length ? withImg : any.slice(0, 6);
    hero(0);
    clearInterval(HOME.heroT);
    if (HOME.items.length > 1) HOME.heroT = setInterval(function () { if (current === 'home' && !FS.open) hero((HOME.idx + 1) % HOME.items.length); }, 8000);
    var sig = D.live.length + '|' + D.vod.length + '|' + D.series.length + '|' + Store.get('rec_' + pid(), []).length;
    if (HOME.built !== sig) { HOME.built = sig; buildRows(D); }
    if (reset) { var sel = document.querySelector('#s-home .mi.sel'); if (sel) Nav.focus(sel, true); }
  }
  function hRow(title, cards) {
    if (!cards.length) return null;
    var row = el('div', 'row'), h = el('h3'); h.innerHTML = title; row.appendChild(h);
    var sc = el('div', 'rowscroll scroll'); for (var i = 0; i < cards.length; i++) sc.appendChild(cards[i]); row.appendChild(sc);
    return row;
  }
  function posterCard(kind, it) {
    var e = el('div', 'pcard f'), po = el('div', 'po');
    if (it.logo) bg(po, it.logo); else po.textContent = kind === 'vod' ? '🎬' : '🍿';
    e.appendChild(po); e.appendChild(el('div', 'cn', it.name));
    if (it.rating && Number(it.rating) > 0) e.appendChild(el('div', 'rt', '★ ' + Number(it.rating).toFixed(1)));
    e._onEnter = function () { go('detail', { kind: kind, item: it }); };
    return e;
  }
  function catCard(kind, c) {
    var e = el('div', 'ccard f'), cim = el('div', 'cim'); e.appendChild(cim);
    if (c.logo) bg(cim, c.logo);
    e.appendChild(el('div', 'cnm', c.name));
    e._onEnter = function () { need([kind], function () { go('grid', { kind: kind, cat: c.id }); }); };
    return e;
  }
  function liveCard(it) {
    var e = el('div', 'lcard f'); if (it.logo) bg(e, it.logo);
    e.appendChild(el('div', 'ln', it.name));
    e._onEnter = function () { need(['live'], function () { go('live', it.id); }); };
    return e;
  }
  function seeAll(w) { var e = el('div', 'seeall f'); e.appendChild(el('div', 'ar', '→')); e.appendChild(el('div', null, 'Ver tudo')); e._onEnter = function () { homeGo(w); }; return e; }
  function buildRows(D) {
    var box = $('homeRows'); box.innerHTML = ''; var i, r;
    var rec = Store.get('rec_' + pid(), []), rc = [];
    for (i = 0; i < rec.length && rc.length < 18; i++) if (rec[i].kind === 'vod' || rec[i].kind === 'series') rc.push(posterCard(rec[i].kind, rec[i].item));
    r = hRow('▶ Continuar assistindo', rc); if (r) box.appendChild(r);
    var counts = catCounts('vod'), cc = [];
    for (i = 0; i < D.cats.vod.length && cc.length < 16; i++) if (counts[D.cats.vod[i].id]) cc.push(catCard('vod', D.cats.vod[i]));
    r = hRow('Categorias', cc); if (r) box.appendChild(r);
    var vc = []; for (i = 0; i < D.vod.length && vc.length < 18; i++) vc.push(posterCard('vod', D.vod[i])); if (D.vod.length > 18) vc.push(seeAll('vod'));
    r = hRow('🎬 Filmes • <b>Lançamentos</b>', vc); if (r) box.appendChild(r);
    var sc = []; for (i = 0; i < D.series.length && sc.length < 18; i++) sc.push(posterCard('series', D.series[i])); if (D.series.length > 18) sc.push(seeAll('series'));
    r = hRow('🍿 Séries', sc); if (r) box.appendChild(r);
    var lc = []; for (i = 0; i < D.live.length && lc.length < 18; i++) lc.push(liveCard(D.live[i])); if (D.live.length > 18) lc.push(seeAll('live'));
    r = hRow('📺 Canais ao vivo', lc); if (r) box.appendChild(r);
  }
  function need(kinds, cb) {
    var i = 0, D = Api.data();
    function next() {
      if (i >= kinds.length) { loading(false); return cb(); }
      var k = kinds[i++];
      if (D.loaded[k]) return next();
      loading(true, 'Carregando ' + ({ live: 'canais', vod: 'filmes', series: 'séries' })[k] + '…');
      Api.load(k, function (err) { if (err) { loading(false); toast('❌ ' + err.message); return; } next(); });
    }
    next();
  }
  function homeGo(w) {
    if (w === 'home') return;
    else if (w === 'live') need(['live'], function () { go('live'); });
    else if (w === 'vod') need(['vod'], function () { go('grid', 'vod'); });
    else if (w === 'series') need(['series'], function () { go('grid', 'series'); });
    else if (w === 'fav') go('list', 'fav');
    else if (w === 'recent') go('list', 'recent');
    else if (w === 'search') need(['live', 'vod', 'series'], function () { go('search'); });
    else if (w === 'settings') go('settings');
    else if (w === 'reload') { var p = Api.profile(); useProfile(p); }
    else if (w === 'receive') go('receive');
    else if (w === 'msgs') go('msgs');
  }

  /* ───────── TV AO VIVO ───────── */
  var L = { cat: null, items: [], prev: null, epgT: null, catT: null };
  function catCounts(kind) {
    var D = Api.data(), c = {}, arr = D[kind];
    for (var i = 0; i < arr.length; i++) c[arr[i].cat] = (c[arr[i].cat] || 0) + 1;
    return c;
  }
  function renderCats(box, kind, onPick, selId) {
    var D = Api.data(), counts = catCounts(kind), list = [{ id: 'fav', name: '⭐ Favoritos', n: favs()[kind].length }, { id: 'all', name: '📋 Todos', n: D[kind].length }];
    D.cats[kind].forEach(function (c) { if (counts[c.id]) list.push({ id: c.id, name: c.name, n: counts[c.id] }); });
    box.innerHTML = ''; var selEl = null;
    list.forEach(function (c) {
      var e = el('div', 'cat f' + (c.id === selId ? ' sel' : '')); e.appendChild(el('span', '', c.name)); e.appendChild(el('span', 'n', String(c.n)));
      e._cid = c.id;
      e._onFocus = function () { clearTimeout(L.catT); L.catT = setTimeout(function () { if (Nav.current() === e) onPick(c.id, e, false); }, 280); };
      e._onEnter = function () { onPick(c.id, e, true); };
      box.appendChild(e); if (c.id === selId) selEl = e;
    });
    return selEl;
  }
  function itemsOf(kind, cat) {
    var D = Api.data();
    if (cat === 'fav') return favs()[kind];
    if (cat === 'all') return D[kind];
    return D[kind].filter(function (x) { return x.cat === cat; });
  }
  function markSel(box, el2) { var c = box.children; for (var i = 0; i < c.length; i++) c[i].className = c[i].className.replace(/\s*\bsel\b/g, ''); if (el2) el2.className += ' sel'; }
  function pickLiveCat(id, e, jump) {
    if (L.cat !== id) {
      L.cat = id; markSel($('liveCats'), e);
      L.items = itemsOf('live', id);
      $('liveChHead').textContent = 'Canais (' + L.items.length + ')';
      lazyList($('liveList'), L.items, renderChan, 80);
      if (!L.items.length) $('liveList').appendChild(el('div', 'empty', id === 'fav' ? 'Nenhum favorito ainda. Use ⭐ ou o botão vermelho.' : 'Vazio'));
    }
    if (jump && $('liveList').firstChild && $('liveList').firstChild.className.indexOf('f') >= 0) Nav.focus($('liveList').firstChild);
  }
  function renderChan(it, i) {
    var e = el('div', 'chan f' + (L.prev && L.prev.id === it.id ? ' playing' : ''));
    e.appendChild(el('div', 'num', String(it.num || i + 1)));
    var lg = el('div', 'lg'); if (it.logo) bg(lg, it.logo); else lg.textContent = '📺'; e.appendChild(lg);
    e.appendChild(el('div', 'nm', it.name));
    if (isFav('live', it.id)) e.appendChild(el('div', 'st', '★'));
    e._item = it; e._idx = i;
    e._onEnter = function () { if (L.prev && L.prev.id === it.id && Player.url()) fullscreen('live', it, L.items, i); else preview(it, i); };
    return e;
  }
  function preview(it, i) {
    L.prev = it; L.prevIdx = i;
    var box = $('liveBox'); box.textContent = '';
    var sp = el('div', 'spinner'); box.appendChild(sp);
    Player.play(Api.streamUrl('live', it), box, {
      onBuffer: function (b) { sp.className = b ? 'spinner' : 'spinner hidden'; },
      onError: function (m) { sp.className = 'spinner hidden'; toast('⚠️ ' + m); }
    });
    $('liveTitle').textContent = (it.num ? it.num + '. ' : '') + it.name;
    $('liveFav').textContent = isFav('live', it.id) ? '★ Remover favorito' : '⭐ Favoritar';
    var rows = $('liveList').children;
    for (var k = 0; k < rows.length; k++) rows[k].className = rows[k].className.replace(/\s*\bplaying\b/g, '') + (rows[k]._item && rows[k]._item.id === it.id ? ' playing' : '');
    addRecent('live', it);
    loadEpg(it);
  }
  function loadEpg(it, target) {
    target = target || { now: $('liveNow'), next: $('liveNext'), bar: $('liveBar') };
    target.now.textContent = ''; target.next.textContent = ''; target.bar.style.width = '0';
    Api.epg(it, function (e, list) {
      if (L.prev !== it && (!FS.item || FS.item !== it)) return;
      var now = Date.now(), cur = null, nx = null;
      for (var i = 0; i < list.length; i++) { if (list[i].start <= now && list[i].end > now) cur = list[i]; else if (list[i].start > now && !nx) nx = list[i]; }
      if (!cur && list.length) cur = list[0];
      if (cur) { target.now.textContent = '▶ ' + hhmm(cur.start) + ' – ' + hhmm(cur.end) + '  ' + cur.title; target.bar.style.width = Math.max(0, Math.min(100, (now - cur.start) / (cur.end - cur.start) * 100)) + '%'; }
      else target.now.textContent = 'Sem guia de programação';
      if (nx) target.next.textContent = 'A seguir: ' + hhmm(nx.start) + '  ' + nx.title;
    });
  }
  $('liveFull')._onEnter = function () { if (L.prev) fullscreen('live', L.prev, L.items, L.prevIdx || 0); else toast('Escolha um canal primeiro'); };
  $('liveFav')._onEnter = function () {
    if (!L.prev) return toast('Escolha um canal primeiro');
    var on = toggleFav('live', L.prev); $('liveFav').textContent = on ? '★ Remover favorito' : '⭐ Favoritar';
    refreshLiveCats();
  };
  function refreshLiveCats() { var sel = renderCats($('liveCats'), 'live', pickLiveCat, L.cat); }
  SCR.live = {
    enter: function (chanId) {
      L.cat = null; L.prev = null;
      $('liveBox').textContent = 'Selecione um canal'; $('liveTitle').textContent = ''; $('liveNow').textContent = ''; $('liveNext').textContent = ''; $('liveBar').style.width = '0';
      var start = 'all';
      if (!chanId && favs().live.length) start = 'fav';
      renderCats($('liveCats'), 'live', pickLiveCat, null);
      var target = null, c = $('liveCats').children; for (var i = 0; i < c.length; i++) if (c[i]._cid === start) target = c[i];
      pickLiveCat(start, target, false);
      if (chanId) {
        var rows = $('liveList').children;
        for (var k = 0; k < rows.length; k++) if (rows[k]._item && rows[k]._item.id === chanId) { Nav.focus(rows[k]); preview(rows[k]._item, rows[k]._idx); return; }
      }
      Nav.focus($('liveList').firstChild && $('liveList').firstChild._item ? $('liveList').firstChild : target);
    },
    resume: function () { if (L.prev && Player.url()) Player.setHost($('liveBox')); },
    leave: function () { Player.stop(); L.prev = null; },
    red: function () { var c = Nav.current(); if (c && c._item) { toggleFav('live', c._item); refreshLiveCats(); } }
  };

  /* ───────── GRADE (filmes / séries) ───────── */
  var G = { kind: 'vod', cat: null, items: [] };
  function pickGridCat(id, e, jump) {
    if (G.cat !== id) {
      G.cat = id; markSel($('gridCats'), e);
      G.items = itemsOf(G.kind, id);
      $('gridCount').textContent = G.items.length + (G.kind === 'vod' ? ' filmes' : ' séries');
      lazyList($('grid'), G.items, renderCard, 60);
      if (!G.items.length) $('grid').appendChild(el('div', 'empty', id === 'fav' ? 'Nenhum favorito ainda' : 'Vazio'));
    }
    if (jump && $('grid').firstChild && $('grid').firstChild._item) Nav.focus($('grid').firstChild);
  }
  function renderCard(it) {
    var e = el('div', 'card f'), po = el('div', 'po');
    if (it.logo) bg(po, it.logo); else po.textContent = G.kind === 'vod' ? '🎬' : '🍿';
    e.appendChild(po); e.appendChild(el('div', 'cn', it.name));
    if (it.rating && Number(it.rating) > 0) e.appendChild(el('div', 'rt', '★ ' + Number(it.rating).toFixed(1)));
    e._item = it; var k = G.kind;
    e._onEnter = function () { go('detail', { kind: k, item: it }); };
    return e;
  }
  SCR.grid = {
    enter: function (arg) {
      var kind = typeof arg === 'object' ? arg.kind : arg, wantCat = typeof arg === 'object' ? arg.cat : null;
      G.kind = kind; G.cat = null;
      $('gridTitle').textContent = kind === 'vod' ? '🎬 Filmes' : '🍿 Séries';
      var start = wantCat || (favs()[kind].length ? 'fav' : 'all');
      renderCats($('gridCats'), kind, pickGridCat, null);
      var target = null, c = $('gridCats').children; for (var i = 0; i < c.length; i++) if (c[i]._cid === start) target = c[i];
      pickGridCat(start, target, false);
      Nav.focus($('grid').firstChild && $('grid').firstChild._item ? $('grid').firstChild : target);
    },
    resume: function () { var keep = G.cat; renderCats($('gridCats'), G.kind, pickGridCat, keep); }
  };

  /* ───────── DETALHE ───────── */
  var DT = null;
  function btn(txt, cls, fn) { var b = el('div', 'btn f ' + (cls || ''), txt); b._onEnter = fn; return b; }
  SCR.detail = {
    enter: function (a) {
      DT = a; var it = a.item;
      $('detHead').textContent = a.kind === 'vod' ? '🎬 Filme' : '🍿 Série';
      $('detTitle').textContent = it.name; $('detMeta').textContent = it.rating && Number(it.rating) > 0 ? '★ ' + Number(it.rating).toFixed(1) : '';
      $('detPlot').textContent = it.plot || ''; $('detPoster').style.backgroundImage = ''; bg($('detPoster'), it.logo);
      $('detSeasons').innerHTML = ''; $('detEps').innerHTML = ''; $('detEpsBox').className = 'eps hidden';
      renderDetBtns();
      if (a.kind === 'vod') {
        Api.vodInfo(it, function (e, inf) {
          if (DT !== a) return;
          var meta = [];
          if (inf.releasedate || inf.year) meta.push(String(inf.releasedate || inf.year).slice(0, 4));
          if (inf.genre) meta.push(inf.genre);
          if (inf.duration) meta.push(inf.duration);
          if (inf.rating && Number(inf.rating) > 0) meta.push('★ ' + Number(inf.rating).toFixed(1));
          if (meta.length) $('detMeta').textContent = meta.join('  ·  ');
          if (inf.plot || inf.description) $('detPlot').textContent = inf.plot || inf.description;
          if (inf.movie_image || inf.cover_big) bg($('detPoster'), inf.movie_image || inf.cover_big);
        });
      } else {
        loading(true, 'Carregando episódios…');
        Api.seriesInfo(it, function (err, s) {
          loading(false);
          if (DT !== a) return;
          if (err) return toast('❌ ' + err.message);
          var inf = s.info, meta = [];
          if (inf.releaseDate || inf.year) meta.push(String(inf.releaseDate || inf.year).slice(0, 4));
          if (inf.genre) meta.push(inf.genre);
          meta.push(s.seasons.length + ' temporada(s)');
          $('detMeta').textContent = meta.join('  ·  ');
          if (inf.plot) $('detPlot').textContent = inf.plot;
          if (inf.cover) bg($('detPoster'), inf.cover);
          DT.seasons = s.seasons;
          renderSeasons(0);
        });
      }
    },
    resume: function () { renderDetBtns(); if (DT && DT.seasons) renderEps(DT.season || 0, true); }
  };
  function renderDetBtns() {
    var box = $('detBtns'), it = DT.item; box.innerHTML = '';
    if (DT.kind === 'vod') {
      var pos = getPos(posKey('vod', it.id));
      if (pos) {
        box.appendChild(btn('▶ Continuar de ' + dur(pos.t), 'primary', function () { playVod(it, pos.t); }));
        box.appendChild(btn('↺ Do início', '', function () { playVod(it, 0); }));
      } else box.appendChild(btn('▶ Assistir', 'primary', function () { playVod(it, 0); }));
    }
    var fb = btn(isFav(DT.kind, it.id) ? '★ Remover favorito' : '⭐ Favoritar', '', function () { var on = toggleFav(DT.kind, it); fb.textContent = on ? '★ Remover favorito' : '⭐ Favoritar'; });
    box.appendChild(fb);
    if (Nav.current() === null || Nav.current().offsetParent === null || current === 'detail') Nav.focus(box.firstChild);
  }
  function renderSeasons(sel) {
    var box = $('detSeasons'); box.innerHTML = '';
    DT.seasons.forEach(function (s, i) {
      var b = el('div', 'season f' + (i === sel ? ' sel' : ''), 'Temporada ' + s.n);
      b._onEnter = function () { renderSeasons(i); var f = $('detEps').firstChild; if (f) Nav.focus(f); };
      box.appendChild(b);
    });
    renderEps(sel);
    var first = $('detEps').firstChild;
    if (sel === 0 && first) Nav.focus(first);
  }
  function renderEps(si, keepFocus) {
    DT.season = si; var s = DT.seasons[si]; if (!s) return;
    $('detEpsBox').className = 'eps';
    var box = $('detEps'); box.innerHTML = '';
    s.eps.forEach(function (ep, i) {
      var e = el('div', 'ep f'), pos = getPos(posKey('ep', ep.id));
      e.appendChild(el('div', 'en', 'E' + (ep.num || i + 1)));
      e.appendChild(el('div', 'et', ep.title));
      e.appendChild(el('div', 'ed', pos ? '⏸ ' + dur(pos.t) : (ep.dur || '')));
      e._onEnter = function () { playEp(si, i, pos ? pos.t : 0); };
      box.appendChild(e);
    });
  }
  function playVod(it, at) { addRecent('vod', it); fullscreen('vod', it, null, 0, { startAt: at }); }
  function playEp(si, i, at) {
    var s = DT.seasons[si], ep = s.eps[i];
    addRecent('series', DT.item);
    fullscreen('series', DT.item, s.eps, i, { ep: ep, startAt: at, seasonN: s.n });
  }

  /* ───────── TELA CHEIA ───────── */
  var FS = { open: false, kind: null, item: null, list: null, idx: 0, ep: null, osdT: null, posT: null, prevScreen: null };
  function fullscreen(kind, item, list, idx, o) {
    o = o || {};
    FS.open = true; FS.kind = kind; FS.item = item; FS.list = list; FS.idx = idx; FS.ep = o.ep || null; FS.seasonN = o.seasonN;
    FS.prevScreen = current; section(current).className = 'screen hidden';
    $('fsOverlay').className = '';
    var host = $('fsVideoHost');
    host.innerHTML = '';
    if (kind === 'image') { showFsImage(); return; }
    if (((kind === 'live' && L.prev === item) || (kind === 'file' && R.prev === item)) && Player.url()) { Player.setHost(host); }
    else startFs(o.startAt || 0);
    osd();
    clearInterval(FS.posT);
    if (kind === 'vod' || kind === 'series') FS.posT = setInterval(savePos, 10000);
  }
  function showFsImage() {
    var host = $('fsVideoHost'), im = document.createElement('img'); host.innerHTML = ''; im.src = FS.item.url; host.appendChild(im);
    $('oNum').textContent = ''; $('oLogo').style.display = 'none'; $('oName').textContent = FS.item.name;
    $('oNow').textContent = FS.list ? (FS.idx + 1) + ' de ' + FS.list.length : ''; $('oNext').textContent = ''; $('oT1').textContent = ''; $('oT2').textContent = ''; $('oBar').style.width = '0';
    $('oHint').textContent = '◀ ▶ foto anterior/próxima · Voltar sair';
    $('osd').className = 'osd'; clearTimeout(FS.osdT); FS.osdT = setTimeout(function () { $('osd').className = 'osd off'; }, 4000);
  }
  function fsUrl() { if (FS.kind === 'file') return FS.item.url; return FS.kind === 'series' ? Api.streamUrl('series', FS.item, FS.ep) : Api.streamUrl(FS.kind, FS.item); }
  function startFs(at) {
    if (at > 5) toast('Continuando de ' + dur(at));
    Player.play(fsUrl(), $('fsVideoHost'), {
      startAt: at,
      onBuffer: function (b) { $('fsSpin').className = b ? 'spinner' : 'spinner hidden'; },
      onError: function (m) { $('fsSpin').className = 'spinner hidden'; toast('⚠️ ' + m); osd(true); },
      onEnd: function () {
        if (FS.kind === 'series' && FS.list && FS.idx < FS.list.length - 1) { setPos(posKey('ep', FS.ep.id), 0); FS.idx++; FS.ep = FS.list[FS.idx]; toast('▶ Próximo episódio'); startFs(0); osd(); }
        else if (FS.kind !== 'live') { savePos(true); exitFs(); }
      }
    });
  }
  function savePos(ended) {
    if (!FS.open || (FS.kind !== 'vod' && FS.kind !== 'series')) return;
    var t = Player.time(), k = FS.kind === 'series' ? posKey('ep', FS.ep.id) : posKey('vod', FS.item.id);
    setPos(k, ended === true ? 0 : t.cur, t.dur);
  }
  function osd(stay) {
    var it = FS.item, live = FS.kind === 'live';
    $('oNum').textContent = live && it.num ? it.num : '';
    $('oLogo').style.backgroundImage = ''; $('oLogo').style.display = live && it.logo ? '' : 'none'; if (live) bg($('oLogo'), it.logo);
    $('oName').textContent = FS.kind === 'series' ? it.name + ' — T' + FS.seasonN + 'E' + (FS.ep.num || FS.idx + 1) + ' ' + (FS.ep.title || '') : it.name;
    $('oHint').textContent = live ? '▲▼ / CH± trocar canal · OK info · 🔴 favorito · Voltar sair' : 'OK pausar/continuar · ◀ ▶ voltar/avançar 10s · Voltar sair';
    if (live) { $('oT1').textContent = ''; $('oT2').textContent = ''; loadEpg(it, { now: $('oNow'), next: $('oNext'), bar: $('oBar') }); }
    else { $('oNow').textContent = ''; $('oNext').textContent = ''; updTime(); }
    $('osd').className = 'osd';
    clearTimeout(FS.osdT);
    if (!stay) FS.osdT = setTimeout(function () { if (!Player.paused()) $('osd').className = 'osd off'; }, 5000);
  }
  function updTime() {
    if (!FS.open || FS.kind === 'live') return;
    var t = Player.time();
    $('oT1').textContent = dur(t.cur) + (Player.paused() ? '  ⏸ Pausado' : '');
    $('oT2').textContent = t.dur ? dur(t.dur) : '';
    $('oBar').style.width = t.dur ? (t.cur / t.dur * 100) + '%' : '0';
  }
  setInterval(function () { if (FS.open && $('osd').className === 'osd') updTime(); }, 1000);
  function zap(d) {
    if (FS.kind !== 'live' || !FS.list || !FS.list.length) return;
    FS.idx = (FS.idx + d + FS.list.length) % FS.list.length;
    FS.item = FS.list[FS.idx];
    L.prev = FS.item; L.prevIdx = FS.idx;
    addRecent('live', FS.item);
    startFs(0); osd();
  }
  function exitFs() {
    if (!FS.open) return;
    savePos(); clearInterval(FS.posT); clearTimeout(FS.osdT); clearTimeout(FS.collT);
    FS.open = false; $('fsOverlay').className = 'hidden';
    section(FS.prevScreen).className = 'screen';
    if (FS.kind === 'live' && FS.prevScreen === 'live' && L.prev) {
      Player.setHost($('liveBox'));
      preview_ui(L.prev);
    } else if (FS.kind === 'file' && FS.prevScreen === 'receive' && R.prev === FS.item && Player.url()) {
      Player.setHost($('rcvBox'));
    } else if (FS.kind === 'image' || FS.kind === 'coll') { Player.stop(); $('fsVideoHost').innerHTML = ''; }
    else { Player.stop(); }
    if (SCR[current] && SCR[current].resume) SCR[current].resume();
    FS.item = null;
  }
  function preview_ui(it) {
    $('liveTitle').textContent = (it.num ? it.num + '. ' : '') + it.name;
    $('liveFav').textContent = isFav('live', it.id) ? '★ Remover favorito' : '⭐ Favoritar';
    var rows = $('liveList').children, target = null;
    for (var k = 0; k < rows.length; k++) { var on = rows[k]._item && rows[k]._item.id === it.id; rows[k].className = rows[k].className.replace(/\s*\bplaying\b/g, '') + (on ? ' playing' : ''); if (on) target = rows[k]; }
    if (target) Nav.focus(target);
    loadEpg(it);
  }
  function fsKey(k) {
    if (k === KEY.BACK || k === KEY.BACK_LG || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.STOP) return exitFs();
    if (FS.kind === 'coll') {
      if (k === KEY.LEFT || k === KEY.RW) return collPrev();
      if (k === KEY.RIGHT || k === KEY.FF) return collNext();
      if (k === KEY.ENTER || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) return collToggle();
      collOsd(); return;
    }
    if (FS.kind === 'image') {
      if (FS.list && (k === KEY.LEFT || k === KEY.RIGHT)) { FS.idx = (FS.idx + (k === KEY.RIGHT ? 1 : -1) + FS.list.length) % FS.list.length; FS.item = FS.list[FS.idx]; showFsImage(); }
      else showFsImage();
      return;
    }
    var live = FS.kind === 'live';
    if (live && (k === KEY.UP || k === KEY.CH_UP || k === KEY.PGUP)) return zap(-1);
    if (live && (k === KEY.DOWN || k === KEY.CH_DOWN || k === KEY.PGDN)) return zap(1);
    if (live && k === KEY.RED) { toggleFav('live', FS.item); return; }
    if (!live && (k === KEY.LEFT || k === KEY.RW)) { Player.seek(-10); osd(); return; }
    if (!live && (k === KEY.RIGHT || k === KEY.FF)) { Player.seek(10); osd(); return; }
    if (!live && (k === KEY.ENTER || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE)) { Player.toggle(); setTimeout(function () { osd(Player.paused()); }, 150); return; }
    osd();
  }

  /* ───────── Modo Coletânea (slideshow de fotos + fila de vídeos) ───────── */
  function collInterval() { var v = Store.get('slide', 5000); return v === 10000 ? 10000 : 5000; }
  function startColl(items, idx) {
    if (!items || !items.length) return;
    FS.open = true; FS.kind = 'coll'; FS.coll = { items: items, paused: false }; FS.idx = idx || 0;
    FS.prevScreen = current; section(current).className = 'screen hidden';
    $('fsOverlay').className = '';
    collShow(FS.idx);
  }
  function collOsd() {
    var items = FS.coll.items, f = items[FS.idx];
    $('oNum').textContent = ''; $('oLogo').style.display = 'none';
    $('oName').textContent = f.name;
    $('oNow').textContent = '🎞️ ' + (FS.idx + 1) + ' de ' + items.length + (FS.coll.paused ? '  ⏸ Pausado' : '  ▶ passando a cada ' + (collInterval() / 1000) + 's');
    $('oNext').textContent = ''; $('oT1').textContent = ''; $('oT2').textContent = ''; $('oBar').style.width = '0';
    $('oHint').textContent = 'OK pausar/continuar · ◀ ▶ anterior/próximo · Voltar sair';
    $('osd').className = 'osd'; clearTimeout(FS.osdT);
    if (!FS.coll.paused) FS.osdT = setTimeout(function () { $('osd').className = 'osd off'; }, 3500);
  }
  function collShow(i) {
    var items = FS.coll.items; FS.idx = i; var f = items[i], host = $('fsVideoHost');
    clearTimeout(FS.collT); try { Player.stop(true); } catch (e) {}
    host.innerHTML = ''; $('fsSpin').className = 'spinner hidden';
    if (f.kind === 'image') {
      var im = document.createElement('img'); im.src = f.url; host.appendChild(im);
      if (!FS.coll.paused) FS.collT = setTimeout(collNext, collInterval());
    } else {
      Player.play(f.url, host, {
        onBuffer: function (b) { $('fsSpin').className = b ? 'spinner' : 'spinner hidden'; },
        onError: function () { $('fsSpin').className = 'spinner hidden'; if (!FS.coll.paused) FS.collT = setTimeout(collNext, 2500); },
        onEnd: function () { if (!FS.coll.paused) collNext(); }
      });
    }
    collOsd();
  }
  function collNext() { if (FS.open && FS.kind === 'coll') collShow((FS.idx + 1) % FS.coll.items.length); }
  window.celtvColl = { start: startColl, next: collNext, toggle: collToggle, fs: function () { return { kind: FS.kind, idx: FS.idx, open: FS.open, paused: FS.coll && FS.coll.paused, hasImg: !!$('fsVideoHost').querySelector('img') }; } };
  function collPrev() { if (FS.open && FS.kind === 'coll') collShow((FS.idx - 1 + FS.coll.items.length) % FS.coll.items.length); }
  function collToggle() {
    FS.coll.paused = !FS.coll.paused;
    var f = FS.coll.items[FS.idx];
    if (f.kind === 'image') { if (FS.coll.paused) clearTimeout(FS.collT); else FS.collT = setTimeout(collNext, collInterval()); }
    else { try { Player.toggle(); } catch (e) {} }
    collOsd();
  }

  /* ───────── BUSCA ───────── */
  var qT = null;
  SCR.search = {
    enter: function () { $('q').value = ''; lastQ = null; $('sRes').innerHTML = ''; Nav.focus($('qWrap')); }
  };
  $('q').addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(doSearch, 350); });
  $('qWrap')._onDone = function () { doSearch(); var f = $('sRes').querySelector('.f'); if (f) Nav.focus(f); };
  function norm(s) { s = String(s || '').toLowerCase(); try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return s; }
  var lastQ = null;
  function doSearch() {
    var q = norm($('q').value.trim()), D = Api.data(), box = $('sRes');
    if (q === lastQ) return; lastQ = q; box.innerHTML = '';
    if (q.length < 2) return;
    var sets = [['live', '📺 Canais'], ['vod', '🎬 Filmes'], ['series', '🍿 Séries']], total = 0;
    sets.forEach(function (s) {
      var res = [], arr = D[s[0]] || [];
      for (var i = 0; i < arr.length && res.length < 30; i++) if (norm(arr[i].name).indexOf(q) >= 0) res.push(arr[i]);
      if (!res.length) return; total += res.length;
      box.appendChild(el('h4', '', s[1] + ' (' + res.length + ')'));
      var row = el('div', 'srow'); res.forEach(function (it, i) { row.appendChild(sItem(s[0], it, res, i)); }); box.appendChild(row);
    });
    if (!total) box.appendChild(el('div', 'empty', 'Nada encontrado'));
  }
  function sItem(kind, it, list, i) {
    var e = el('div', 'sitem f'), lg = el('div', 'lg');
    if (it.logo) bg(lg, it.logo); else lg.textContent = kind === 'live' ? '📺' : kind === 'vod' ? '🎬' : '🍿';
    e.appendChild(lg); e.appendChild(el('div', 'nm', it.name));
    e._onEnter = function () {
      if (kind === 'live') { addRecent('live', it); fullscreen('live', it, list.filter(function (x) { return true; }), i); }
      else go('detail', { kind: kind, item: it });
    };
    return e;
  }

  /* ───────── FAVORITOS / RECENTES ───────── */
  var LS = null;
  SCR.list = {
    enter: function (w) { LS = w; renderListScreen(); },
    resume: function () { var f = Nav.current(); renderListScreen(); }
  };
  function renderListScreen() {
    var box = $('listRes'); box.innerHTML = '';
    $('listTitle').textContent = LS === 'fav' ? '⭐ Favoritos' : '🕘 Recentes';
    var groups = { live: [], vod: [], series: [] };
    if (LS === 'fav') { var f = favs(); groups = { live: f.live, vod: f.vod, series: f.series }; }
    else Store.get('rec_' + pid(), []).forEach(function (r) { groups[r.kind].push(r.item); });
    var any = false;
    [['live', '📺 Canais'], ['vod', '🎬 Filmes'], ['series', '🍿 Séries']].forEach(function (s) {
      var arr = groups[s[0]]; if (!arr.length) return; any = true;
      box.appendChild(el('h4', '', s[1] + ' (' + arr.length + ')'));
      var row = el('div', 'srow'); arr.forEach(function (it, i) { row.appendChild(sItem(s[0], it, arr, i)); }); box.appendChild(row);
    });
    if (!any) box.appendChild(el('div', 'empty', LS === 'fav' ? 'Nenhum favorito ainda.' : 'Nada assistido ainda.'));
    var first = box.querySelector('.f'); if (first) Nav.focus(first);
  }

  /* ───────── CONFIGURAÇÕES ───────── */
  SCR.settings = { enter: renderSettings, resume: renderSettings };
  function setRow(label, val, fn) { var r = el('div', 'setRow f'); r.appendChild(el('span', '', label)); r.appendChild(el('span', 'v', val)); r._onEnter = fn; return r; }
  function renderSettings() {
    var box = $('setList'); box.innerHTML = '';
    var p = Api.profile(), inf = Api.info(), fmt = Store.get('fmt', 'auto');
    box.appendChild(setRow('📋 Lista atual', p.name, function () { go('login'); }));
    box.appendChild(setRow('➕ Adicionar / trocar lista', '›', function () { go('login'); }));
    box.appendChild(setRow('📡 Formato da TV ao vivo', { auto: 'Automático', m3u8: 'HLS (m3u8)', ts: 'MPEG-TS (ts)' }[fmt], function () {
      var o = ['auto', 'm3u8', 'ts'], n = o[(o.indexOf(fmt) + 1) % 3]; Store.set('fmt', n); renderSettings(); Nav.focus($('setList').children[2]);
    }));
    box.appendChild(setRow('📱 Modo de navegação', uiMode() === 'phone' ? 'Celular (rolagem/toque)' : 'TV (controle remoto)', function () {
      toggleMode(); renderSettings(); var i = 3; Nav.focus($('setList').children[i] || $('setList').firstChild);
    }));
    box.appendChild(setRow('🎞️ Player', Player.isAV ? 'Samsung AVPlay' : 'HTML5', function () {}));
    if (inf && inf.user_info) {
      var u = inf.user_info, ed = u.exp_date && u.exp_date !== 'null' ? new Date(Number(u.exp_date) * 1000).toLocaleDateString('pt-BR') : 'Sem vencimento';
      box.appendChild(setRow('👤 Conta', u.username + ' · ' + (u.status || '') + ' · vence ' + ed + ' · ' + (u.active_cons || 0) + '/' + (u.max_connections || '?') + ' telas', function () {}));
    }
    box.appendChild(setRow('🧹 Limpar favoritos e recentes desta lista', '›', function () { Store.del('fav_' + pid()); Store.del('rec_' + pid()); Store.del('pos_' + pid()); toast('Limpo'); }));
    box.appendChild(setRow('🗑️ Remover esta lista do aparelho', '›', function () {
      profiles = profiles.filter(function (x) { return x.id !== p.id; }); saveProfiles();
      Store.del('fav_' + pid()); Store.del('rec_' + pid()); Store.del('pos_' + pid()); Store.del('active');
      Player.stop(); replaceRoot('login', 'Lista removida');
    }));
    box.appendChild(setRow('🔄 Atualizar a lista (recarregar do servidor)', '›', function () { useProfile(Api.profile()); }));
    box.appendChild(setRow('📱 Código deste aparelho (para o suporte)', MSG.code || '—', function () {}));
    box.appendChild(setRow('ℹ️ Celtv Play', 'versão 1.0', function () {}));
    if (!Nav.current() || Nav.current().offsetParent === null) Nav.focus(box.firstChild);
  }


  /* ───────── RECEBER DO CELULAR (Conecta Celtv) ───────── */
  var R = { scr: null, files: [], folders: [], folder: null, prev: null, sig: '', known: null, pollT: null, on: false };
  var ICON = { apk: '🤖', zip: '🗜️', rar: '🗜️', pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', txt: '📝', json: '⚙️', xml: '⚙️', m3u: '📡', m3u8: '📡' };
  function rIcon(f) { var k = fileKind(f.ext); return k === 'image' ? '🖼️' : k === 'video' ? '🎬' : k === 'audio' ? '🎵' : (ICON[f.ext] || '📦'); }
  function fsize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; return (b / 1073741824).toFixed(2) + ' GB'; }
  $('rcvUrl').textContent = CLOUD.phoneUrl;
  $('btnRcvLogin')._onEnter = function () { go('receive'); };
  SCR.receive = {
    enter: function () {
      R.on = true; R.sig = ''; R.known = null; R.prev = null; R.folder = null;
      $('rcvFolders').innerHTML = ''; $('rcvList').innerHTML = ''; showRcvPin();
      R.scr = Store.get('rcv_screen', null);
      if (R.scr && R.scr.id) rPoll(); else rRegister();
      setTimeout(function () { Nav.focus($('rcvFolders').firstChild); }, 0);
    },
    leave: function () { R.on = false; clearTimeout(R.pollT); if (R.prev) { Player.stop(); R.prev = null; } },
    resume: function () { if (R.prev && Player.url()) Player.setHost($('rcvBox')); }
  };
  function rRegister() {
    cloudRpc('celtv_tv_register', { p_platform: myPlatform() }, function (err, r) {
      if (!R.on) return;
      if (err) { $('rcvNet').textContent = '⚠️ ' + err.message; R.pollT = setTimeout(rRegister, 4000); return; }
      R.scr = { id: r.screen_id, secret: r.secret }; Store.set('rcv_screen', R.scr); rPoll();
    });
  }
  function rPoll() {
    cloudRpc('celtv_tv_state', { p_screen: R.scr.id, p_secret: R.scr.secret, p_platform: myPlatform() }, function (err, m) {
      if (!R.on) return;
      if (err) {
        if (err.status === 403 || err.status === 400) { Store.del('rcv_screen'); R.scr = null; return rRegister(); }
        $('rcvNet').textContent = '⚠️ Sem internet';
      } else { $('rcvNet').textContent = '🟢 Pronto para receber'; rState(m); }
      R.pollT = setTimeout(rPoll, 3000);
    });
  }
  function rState(m) {
    var files = m.files || [], i, sig = m.pin + '|', newF = null, known = {};
    for (i = 0; i < files.length; i++) { files[i].url = cloudUrl(files[i].path); files[i].kind = fileKind(files[i].ext || ''); sig += files[i].id + ','; }
    for (i = 0; i < m.folders.length; i++) sig += m.folders[i].name + m.folders[i].count + ',';
    $('rcvPinNum').textContent = m.pin; renderQr();
    if (sig === R.sig) return; R.sig = sig;
    if (R.known) for (i = 0; i < files.length; i++) if (!R.known[files[i].id]) { newF = files[i]; break; }
    for (i = 0; i < files.length; i++) known[files[i].id] = 1; R.known = known;
    R.files = files; R.folders = m.folders.filter(function (f) { return f.count > 0 || !f.auto; });
    if (newF) { R.folder = newF.folder; toast('📥 Recebido em ' + newF.folder + ': ' + newF.name); }
    rRender(newF);
  }
  function rRender(select) {
    var fbox = $('rcvFolders'), cur = Nav.current(), curId = cur && cur._rid;
    fbox.innerHTML = '';
    var pin = el('div', 'cat f' + (R.folder === null ? ' sel' : '')); pin.appendChild(el('span', '', '🔑 Parear celular')); pin._rid = 'pin';
    pin._onEnter = pin._onFocus = function () { R.folder = null; markSel(fbox, pin); $('rcvList').innerHTML = ''; $('rcvHead').textContent = 'Arquivos'; showRcvPin(); };
    fbox.appendChild(pin);
    var selEl = null;
    R.folders.forEach(function (f) {
      var e = el('div', 'cat f' + (R.folder === f.name ? ' sel' : '')); e.appendChild(el('span', '', f.icon + ' ' + f.name)); e.appendChild(el('span', 'n', String(f.count)));
      e._rid = 'f:' + f.name;
      e._onFocus = function () { if (R.folder !== f.name) { R.folder = f.name; markSel(fbox, e); rFiles(); } };
      e._onEnter = function () { R.folder = f.name; markSel(fbox, e); rFiles(); var x = $('rcvList').firstChild; if (x) Nav.focus(x); };
      fbox.appendChild(e); if (R.folder === f.name) selEl = e;
    });
    if (!R.folders.length) fbox.appendChild(el('div', 'empty', 'Nada recebido ainda'));
    if (R.folder !== null) rFiles(); else showRcvPin();
    if (select) { var rows = $('rcvList').children; for (var i = 0; i < rows.length; i++) if (rows[i]._file && rows[i]._file.id === select.id) { Nav.focus(rows[i]); rPreview(select); return; } }
    if (curId) { var all = document.querySelectorAll('#s-receive .f'); for (var j = 0; j < all.length; j++) if (all[j]._rid === curId) { Nav.focus(all[j], true); return; } }
    if (!cur || cur.offsetParent === null) Nav.focus(selEl || pin);
  }
  function rFiles() {
    var list = R.files.filter(function (x) { return x.folder === R.folder; }), box = $('rcvList');
    $('rcvHead').textContent = (R.folder || '') + ' (' + list.length + ')';
    box.innerHTML = '';
    list.forEach(function (f, i) {
      var e = el('div', 'chan f'), lg = el('div', 'lg');
      if (f.kind === 'image') bg(lg, f.url); else lg.textContent = rIcon(f);
      e.appendChild(lg); var t = el('div', 'nm', f.name); e.appendChild(t); e.appendChild(el('div', 'num', fsize(f.size)));
      e._file = f; e._rid = 'x:' + f.id; e._list = list; e._idx = i;
      e._onEnter = function () { rOpen(f, list, i); };
      box.appendChild(e);
    });
  }
  function renderQr() {
    if (!window.qrcode) return;
    var pin = $('rcvPinNum').textContent; if (!/^\d{4}$/.test(pin)) return;
    var url = 'https://' + (CLOUD.phoneUrl || 'conecta-celtv.vercel.app') + '/?pin=' + pin;
    try { var q = qrcode(0, 'M'); q.addData(url); q.make(); $('rcvQr').innerHTML = q.createImgTag(6, 0); } catch (e) {}
  }
  function showRcvPin() { if (R.prev) { Player.stop(); R.prev = null; } $('rcvPin').className = 'rcvPin'; $('rcvPrev').className = 'hidden'; renderQr(); }
  function rPreview(f) {
    $('rcvPin').className = 'rcvPin hidden'; $('rcvPrev').className = '';
    var box = $('rcvBox'); if (R.prev) { Player.stop(); R.prev = null; } box.innerHTML = '';
    $('rcvTitle').textContent = f.name;
    $('rcvMeta').textContent = fsize(f.size) + ' · ' + new Date(f.time).toLocaleString('pt-BR');
    $('rcvTip').textContent = ''; var bb = $('rcvBtns'); bb.innerHTML = '';
    var list = R.files.filter(function (x) { return x.folder === f.folder; }), idx = 0;
    for (var i = 0; i < list.length; i++) if (list[i].id === f.id) idx = i;
    if (f.kind === 'image') {
      var im = document.createElement('img'); im.src = f.url; box.appendChild(im);
      bb.appendChild(btn('⛶ Tela cheia', 'primary', function () { fullscreen('image', f, list.filter(function (x) { return x.kind === 'image'; }), 0); FS.idx = Math.max(0, FS.list.indexOf(f)); showFsImage(); }));
    } else if (f.kind === 'video' || f.kind === 'audio') {
      R.prev = f;
      var sp = el('div', 'spinner'); box.appendChild(sp);
      Player.play(f.url, box, { onBuffer: function (b) { sp.className = b ? 'spinner' : 'spinner hidden'; }, onError: function (m) { sp.className = 'spinner hidden'; $('rcvTip').textContent = '⚠️ ' + m; } });
      bb.appendChild(btn('⛶ Tela cheia', 'primary', function () { fullscreen('file', f, null, 0); }));
      $('rcvTip').textContent = 'OK de novo = tela cheia';
    } else if (f.kind === 'playlist') {
      box.appendChild(el('div', 'bigI', '📡'));
      $('rcvTip').textContent = f.ext === 'celtv' ? 'Lista IPTV enviada pelo celular. Aperte OK para usar no Celtv Play.' : 'Lista IPTV: adicione para assistir os canais no Celtv Play.';
      bb.appendChild(btn('➕ Usar como lista do Celtv Play', 'primary', function () {
        if (f.ext !== 'celtv') return useProfile({ id: 'p' + Date.now(), type: 'm3u', name: f.name.replace(/\.m3u8?$/i, ''), m3uUrl: f.url, m3uText: '' }, true);
        loading(true, 'Lendo a lista…');
        httpGet(f.url, 20000, function (err, txt) {
          loading(false);
          var c = null; try { c = JSON.parse(txt); } catch (e) {}
          if (err || !c || !c.celtv) return toast('❌ Não foi possível ler a lista');
          if (c.type === 'xtream') useProfile({ id: 'p' + Date.now(), type: 'xtream', name: c.name || c.user, server: normServer(c.server), user: c.user, pass: c.pass }, true);
          else useProfile({ id: 'p' + Date.now(), type: 'm3u', name: c.name || 'Lista M3U', m3uUrl: c.url, m3uText: '' }, true);
        });
      }));
    } else {
      box.appendChild(el('div', 'bigI', rIcon(f)));
      var plat2 = myPlatform();
      $('rcvTip').textContent = f.ext === 'apk' ? (plat2 === 'androidtv' ? 'APK: abra pelo gerenciador de arquivos da TV para instalar.' : '⛔ Esta TV não instala APK (só Android TV). O arquivo fica guardado.') : 'Arquivo guardado. Esta TV não abre este formato.';
    }
    if (f.kind === 'image' || f.kind === 'video') {
      var media = list.filter(function (x) { return x.kind === 'image' || x.kind === 'video'; });
      if (media.length >= 2) {
        var si = 0; for (var mi = 0; mi < media.length; mi++) if (media[mi].id === f.id) si = mi;
        bb.appendChild(btn('🎞️ Modo coletânea (loop)', '', function () { startColl(media, si); }));
        bb.appendChild(btn('⏱️ Intervalo das fotos: ' + (collInterval() / 1000) + 's', '', function () { Store.set('slide', collInterval() === 5000 ? 10000 : 5000); rPreview(f); }));
      }
    }
  }
  function rOpen(f, list, i) {
    var row = Nav.current();
    if ($('rcvTitle').textContent === f.name && $('rcvPrev').className === '') {
      if (f.kind === 'image') { fullscreen('image', f, list.filter(function (x) { return x.kind === 'image'; }), 0); FS.idx = Math.max(0, FS.list.indexOf(f)); showFsImage(); return; }
      if (f.kind === 'video' || f.kind === 'audio') { fullscreen('file', f, null, 0); return; }
      var b = $('rcvBtns').firstChild; if (b) { b._onEnter(); return; }
    }
    rPreview(f);
  }

  /* ───────── Central de mensagens (avisos + suporte) ───────── */
  var MSG = { code: null, list: [], pollT: null, first: true }, bannerT = null;
  function msgPlat() { if (window.tizen) return 'tizen'; if (window.webOS || window.PalmSystem) return 'webos'; if (window.AndroidApp || /Android/i.test(navigator.userAgent)) return 'androidtv'; if (/Windows/i.test(navigator.userAgent)) return 'windows'; return 'other'; }
  function curProfile() { try { return Api.profile(); } catch (e) { return null; } }
  function msgInit() {
    var p = curProfile();
    if (!p) { setTimeout(msgInit, 5000); return; }  // espera o login para registrar com nome
    MSG.code = Store.get('dev_code', null);
    var label = p.name || p.user || '';
    cloudRpc('celtv_dev_reg', { p_code: MSG.code || '', p_label: label, p_platform: msgPlat(), p_acct: p.user || p.name || '', p_duid: deviceId() }, function (err, r) {
      if (err || !r || !r.code) { setTimeout(msgInit, 10000); return; }
      MSG.code = r.code; Store.set('dev_code', r.code);
      msgPoll(); clearInterval(MSG.pollT); MSG.pollT = setInterval(msgPoll, 20000);
    });
  }
  function msgRead() { return Store.get("msg_read", 0); }
  window.celtvPoll = function(){ msgPoll(); };
  function setBadge(n) { var b = $('msgBadge'); if (!b) return; if (n > 0) { b.textContent = n > 99 ? '99' : n; b.className = 'nbadge'; } else b.className = 'nbadge hidden'; }
  function msgPoll() {
    if (!MSG.code) return;
    cloudRpc('celtv_msg_poll', { p_code: MSG.code }, function (err, list) {
      if (err || !list) return;
      MSG.list = list;
      var maxId = list.length ? list[0].id : 0, unread = 0, i;
      for (i = 0; i < list.length; i++) if (list[i].id > msgRead()) unread++;
      setBadge(unread);
      var lb = Store.get('msg_banner', 0);
      if (MSG.first) { MSG.first = false; Store.set('msg_banner', maxId); }
      else if (maxId > lb) { for (i = list.length - 1; i >= 0; i--) if (list[i].id > lb) showBanner(list[i]); Store.set('msg_banner', maxId); }
      if (current === 'msgs') renderMsgs();
    });
  }
  function showBanner(m) {
    var b = $('msgBanner'); b.innerHTML = '';
    b.appendChild(el('div', 'bt', (m.kind === 'promo' ? '🎉 ' : m.kind === 'warn' ? '⚠️ ' : '📢 ') + (m.title || 'Aviso')));
    if (m.body) b.appendChild(el('div', 'bb', m.body));
    b.appendChild(el('div', 'bk', 'Abra 💬 Mensagens para ver'));
    b.className = 'show'; clearTimeout(bannerT); bannerT = setTimeout(function () { b.className = 'hidden'; }, 8000);
  }
  var SUP_REASONS = ['📶 O sinal / canais caíram', '▶️ Um canal não abre', '➕ Falta um canal ou filme', '🔑 Problema para entrar'];
  SCR.msgs = {
    enter: function () {
      $('msgsCode').textContent = MSG.code ? ('Código: ' + MSG.code) : '';
      renderMsgs(); renderSup();
      if (MSG.list.length) { Store.set('msg_read', MSG.list[0].id); setBadge(0); }
      var f = $('msgsList').firstChild;
      Nav.focus(f && /\bf\b/.test(f.className || '') ? f : $('supBox').querySelector('.f'));
    }
  };
  function renderMsgs() {
    var box = $('msgsList'); box.innerHTML = '';
    if (!MSG.list.length) { box.appendChild(el('div', 'empty', 'Nenhum aviso ainda.')); return; }
    for (var i = 0; i < MSG.list.length; i++) {
      var m = MSG.list[i], it = el('div', 'msgItem ' + (m.kind || 'info')), h = el('div', 'mh');
      h.appendChild(el('div', 'mi2', m.kind === 'promo' ? '🎉' : m.kind === 'warn' ? '⚠️' : '📢'));
      h.appendChild(el('div', 'mt', m.title || 'Aviso'));
      h.appendChild(el('div', 'md', new Date(m.time).toLocaleString('pt-BR')));
      it.appendChild(h); if (m.body) it.appendChild(el('div', 'mb', m.body)); box.appendChild(it);
    }
  }
  var supSel = null;
  function renderSup() {
    var box = $('supBox'); box.innerHTML = ''; supSel = null;
    box.appendChild(el('div', 'supNote', '1) Escolha o assunto   2) Especifique   3) Enviar'));
    var btns = [];
    function clearSel() { for (var i = 0; i < btns.length; i++) btns[i].className = btns[i].className.replace(/\s*\bsel\b/g, ''); }
    SUP_REASONS.concat(['💬 Outro assunto']).forEach(function (r) {
      var b = el('div', 'supBtn f', r);
      b._onEnter = function () { supSel = r; clearSel(); b.className += ' sel'; Nav.focus($('supText').parentNode); };
      btns.push(b); box.appendChild(b);
    });
    var w = el('div', 'field f'); w.innerHTML = '<label>✍️ Sua mensagem</label><textarea id="supText" placeholder="Especifique…"></textarea>';
    box.appendChild(w);
    var send = el('div', 'supBtn send f', '📨 Enviar');
    send._onEnter = function () {
      if (!supSel) { toast('Escolha o assunto primeiro'); return; }
      var t = (document.getElementById('supText').value || '').trim();
      if (!t) { toast('Especifique sua mensagem'); Nav.focus($('supText').parentNode); return; }
      var reason = supSel.replace(/^\S+\s/, '');
      sendSup(reason + ' — ' + t);
      document.getElementById('supText').value = ''; supSel = null; clearSel();
    };
    box.appendChild(send);
  }
  function sendSup(reason) {
    var p = curProfile(), label = (p && (p.name || p.user)) || '';
    cloudRpc('celtv_support_send', { p_code: MSG.code || '', p_label: label, p_reason: reason }, function (err) {
      if (err) toast('❌ ' + err.message); else toast('✅ Mensagem enviada');
    });
  }

  /* ───────── Teclado / controle ───────── */
  // Android (WebView) envia teclas especiais por aqui: window.cpKey(10009)
  window.cpKey = function (k) { handleKey(k, { target: document.activeElement || document.body, preventDefault: function () {} }); };
  document.addEventListener('keydown', function (e) { handleKey(e.keyCode, e); });
  function handleKey(k, e) {
    if (Nav.editing()) {
      if (k === KEY.DONE || k === KEY.CANCEL || k === KEY.BACK || k === KEY.BACK_LG || k === KEY.ESC || (k === KEY.ENTER && e.target.tagName !== 'TEXTAREA') || k === KEY.UP || k === KEY.DOWN) {
        e.preventDefault(); Nav.stopEdit(); if (k === KEY.UP) Nav.move('up'); if (k === KEY.DOWN) Nav.move('down');
      }
      return;
    }
    if (!$('loading').className) { if (k === KEY.BACK || k === KEY.BACK_LG || k === KEY.ESC) e.preventDefault(); return; }
    if (FS.open) { e.preventDefault(); fsKey(k); return; }
    if (k === KEY.LEFT) Nav.move('left');
    else if (k === KEY.RIGHT) Nav.move('right');
    else if (k === KEY.UP) Nav.move('up');
    else if (k === KEY.DOWN) Nav.move('down');
    else if (k === KEY.ENTER) Nav.activate();
    else if (k === KEY.BACK || k === KEY.BACK_LG || k === KEY.ESC || (k === KEY.BACKSPACE && e.target.tagName !== 'INPUT')) back();
    else if (k === KEY.RED && SCR[current].red) SCR[current].red();
    else if (k === KEY.STOP) Player.stop();
    else return;
    e.preventDefault();
  }

  /* ───────── Início ───────── */
  applyMode();
  function autoLogin() {
    var act = Store.get('active', null), ap = null;
    for (var i = 0; i < profiles.length; i++) if (profiles[i].id === act) ap = profiles[i];
    if (!ap && profiles.length) ap = profiles[0];
    if (ap) { current = null; useProfile(ap); return true; }
    return false;
  }
  if (cloudOn()) msgInit();
  if (!autoLogin()) {
    if (!profiles.length && cloudOn()) {
      loading(true, 'Restaurando suas listas…');
      cloudRpc('celtv_prof_load', { p_duid: deviceId() }, function (err, data) {
        loading(false);
        if (!err && data && data.length) {
          profiles = data; Store.set('profiles', profiles);
          toast('✅ Listas restauradas');
          if (autoLogin()) return;
        }
        replaceRoot('login');
      });
    } else replaceRoot('login');
  }
})();
