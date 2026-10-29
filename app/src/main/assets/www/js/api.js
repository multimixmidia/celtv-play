/* Acesso aos servidores IPTV (Xtream Codes) e listas M3U — ES5 */
var Store = {
  get: function (k, d) { try { var v = localStorage.getItem('cp_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('cp_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem('cp_' + k); } catch (e) {} }
};

function httpGet(url, timeout, cb) {
  var x = new XMLHttpRequest(), done = false;
  try { x.open('GET', url, true); } catch (e) { return cb({ message: 'URL inválida' }); }
  x.timeout = timeout || 25000;
  x.onload = function () {
    if (done) return; done = true;
    if (x.status >= 200 && x.status < 300) cb(null, x.responseText);
    else cb({ status: x.status, message: x.status === 401 || x.status === 403 ? 'Usuário ou senha incorretos' : 'Servidor respondeu ' + x.status });
  };
  x.onerror = function () { if (!done) { done = true; cb({ message: 'Não foi possível conectar ao servidor' }); } };
  x.ontimeout = function () { if (!done) { done = true; cb({ message: 'O servidor demorou para responder' }); } };
  x.send();
}
function httpJson(url, cb) {
  httpGet(url, 40000, function (err, txt) {
    if (err) return cb(err);
    var j; try { j = JSON.parse(txt); } catch (e) { return cb({ message: 'Resposta inválida do servidor' }); }
    cb(null, j);
  });
}

function normServer(s) {
  s = String(s || '').replace(/\s+/g, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  s = s.replace(/\/(player_api\.php|get\.php|panel_api\.php|xmltv\.php).*$/i, '');
  return s.replace(/\/+$/, '');
}
function b64(s) {
  if (!s) return '';
  try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (e2) { return s; } }
}

/* Modelo único usado pelo app:
   D.cats = {live:[{id,name}], vod:[...], series:[...]}
   D.live = [{id,name,logo,cat,num,url?,epg}]   D.vod = [{id,name,logo,cat,rating,ext,url?}]   D.series = [{id,name,logo,cat,rating,plot}] */
var Api = (function () {
  var P = null, D = null, info = null;

  function xUrl(params) {
    var u = P.server + '/player_api.php?username=' + encodeURIComponent(P.user) + '&password=' + encodeURIComponent(P.pass);
    return params ? u + '&' + params : u;
  }
  function liveFormat() {
    var pref = Store.get('fmt', 'auto');
    var allowed = (info && info.user_info && info.user_info.allowed_output_formats) || [];
    if (pref !== 'auto') return pref;
    var avplay = !!(window.webapis && window.webapis.avplay);
    if (avplay && (!allowed.length || allowed.indexOf('ts') >= 0)) return 'ts';
    if (!allowed.length || allowed.indexOf('m3u8') >= 0) return 'm3u8';
    return 'ts';
  }

  function login(profile, cb) {
    P = profile; D = { cats: { live: [], vod: [], series: [] }, live: [], vod: [], series: [], loaded: {} }; info = null;
    if (P.type === 'xtream') {
      httpJson(xUrl(), function (err, j) {
        if (err) return cb(err);
        if (!j || !j.user_info) return cb({ message: 'Servidor não é compatível (Xtream)' });
        if (String(j.user_info.auth) !== '1') return cb({ message: 'Usuário ou senha incorretos' });
        if (j.user_info.status && j.user_info.status !== 'Active') return cb({ message: 'Conta ' + j.user_info.status + ' (expirada ou bloqueada)' });
        info = j; cb(null, j);
      });
    } else {
      var parse = function (txt) {
        if (!txt || txt.indexOf('#EXT') < 0) return cb({ message: 'Lista M3U inválida' });
        parseM3U(txt); D.loaded = { live: 1, vod: 1, series: 1 }; cb(null, {});
      };
      var loadM3u = function () {
        if (P.m3uText) parse(P.m3uText);
        else httpGet(P.m3uUrl, 90000, function (err, txt) { if (err) return cb(err); parse(txt); });
      };
      // Link M3U do próprio servidor (get.php?username=…&password=…) → entra como usuário/senha:
      // assim ganha séries completas, capas e guia de programação.
      var xt = !P.m3uText && xtreamFromUrl(P.m3uUrl);
      if (!xt) return loadM3u();
      var bak = { type: P.type, server: P.server, user: P.user, pass: P.pass };
      P.type = 'xtream'; P.server = xt.server; P.user = xt.user; P.pass = xt.pass;
      httpJson(xUrl(), function (err, j) {
        if (!err && j && j.user_info && String(j.user_info.auth) === '1') { info = j; P.m3uUrl = ''; return cb(null, j); }
        P.type = bak.type; P.server = bak.server; P.user = bak.user; P.pass = bak.pass;
        loadM3u();
      });
    }
  }

  function xtreamFromUrl(u) {
    u = String(u || '');
    var m = /^(https?:\/\/[^?#]*?)\/(get|playlist|player_api)\.php\?(.*)$/i.exec(u);
    if (!m) return null;
    var q = m[3], us = /(?:^|&)username=([^&#]+)/i.exec(q), pw = /(?:^|&)password=([^&#]+)/i.exec(q);
    if (!us || !pw) return null;
    var dec = function (x) { try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch (e) { return x; } };
    return { server: m[1].replace(/\/+$/, ''), user: dec(us[1]), pass: dec(pw[1]) };
  }

  function parseM3U(txt) {
    var lines = txt.split(/\r?\n/), cur = null, catIdx = { live: {}, vod: {}, series: {} }, n = 0, sIdx = {};
    var SE = /^(.*?)[\s._\-|:]*(?:S|T)(\d{1,2})\s*[ ._\-]?\s*(?:E|EP)\s?(\d{1,4})(?!\d)/i;
    D.seriesEps = {};
    function cat(kind, name) {
      name = name || 'Sem categoria';
      if (!catIdx[kind][name]) { catIdx[kind][name] = 'm' + kind + D.cats[kind].length; D.cats[kind].push({ id: catIdx[kind][name], name: name }); }
      return catIdx[kind][name];
    }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim(); if (!l) continue;
      if (l.indexOf('#EXTINF') === 0) {
        var c = l.lastIndexOf(','), m;
        cur = { name: c >= 0 ? l.slice(c + 1).trim() : 'Canal', logo: '', group: '', epg: '' };
        m = /tvg-logo="([^"]*)"/i.exec(l); if (m) cur.logo = m[1];
        m = /group-title="([^"]*)"/i.exec(l); if (m) cur.group = m[1];
        m = /tvg-id="([^"]*)"/i.exec(l); if (m) cur.epg = m[1];
      } else if (l.charAt(0) !== '#') {
        var it = cur || { name: l, logo: '', group: '' }; cur = null;
        var isVod = /\/(movie|series)\//i.test(l) || /\.(mp4|mkv|avi|mov)(\?|$)/i.test(l);
        n++;
        var se = SE.exec(it.name);
        if (se && (isVod || /\/series\//i.test(l))) {
          var sname = (se[1] || it.name).replace(/[\s\-|:]+$/, '').trim() || it.name, key = (it.group || '') + '|' + sname.toLowerCase(), sid = sIdx[key];
          if (!sid) {
            sid = 's' + (D.series.length + 1); sIdx[key] = sid;
            D.series.push({ id: sid, name: sname, logo: it.logo, cat: cat('series', it.group), rating: '', plot: '' });
            D.seriesEps[sid] = {};
          }
          var sn = String(Number(se[2])), eps = D.seriesEps[sid];
          (eps[sn] = eps[sn] || []).push({ id: 'e' + n, num: Number(se[3]), title: it.name.slice(se[0].length).replace(/^[\s\-|:.]+/, '') || ('Episódio ' + Number(se[3])), url: l, ext: '', plot: '', dur: '' });
          continue;
        }
        if (isVod) D.vod.push({ id: 'v' + n, name: it.name, logo: it.logo, cat: cat('vod', it.group), url: l, rating: '' });
        else D.live.push({ id: 'l' + n, name: it.name, logo: it.logo, cat: cat('live', it.group), url: l, num: D.live.length + 1, epg: it.epg });
      }
    }
  }

  function load(kind, cb) {
    if (D.loaded[kind]) return cb(null);
    var ca = { live: 'get_live_categories', vod: 'get_vod_categories', series: 'get_series_categories' }[kind];
    var st = { live: 'get_live_streams', vod: 'get_vod_streams', series: 'get_series' }[kind];
    httpJson(xUrl('action=' + ca), function (err, cats) {
      if (err) return cb(err);
      httpJson(xUrl('action=' + st), function (err2, list) {
        if (err2) return cb(err2);
        D.cats[kind] = (cats || []).map(function (c) { return { id: String(c.category_id), name: c.category_name }; });
        D[kind] = (list || []).map(function (s, i) {
          if (kind === 'live') return { id: String(s.stream_id), name: s.name, logo: s.stream_icon || '', cat: String(s.category_id), num: s.num || i + 1, epg: s.epg_channel_id || '' };
          if (kind === 'vod') return { id: String(s.stream_id), name: s.name, logo: s.stream_icon || '', cat: String(s.category_id), rating: s.rating || '', ext: s.container_extension || 'mp4' };
          return { id: String(s.series_id), name: s.name, logo: s.cover || '', cat: String(s.category_id), rating: s.rating || '', plot: s.plot || '' };
        });
        D.loaded[kind] = 1;
        cb(null);
      });
    });
  }

  function streamUrl(kind, item, ep) {
    if (kind === 'series' && ep && ep.url) return ep.url;
    if (item.url) return item.url;
    var b = P.server + '/', a = encodeURIComponent(P.user) + '/' + encodeURIComponent(P.pass) + '/';
    if (kind === 'live') return b + 'live/' + a + item.id + '.' + liveFormat();
    if (kind === 'vod') return b + 'movie/' + a + item.id + '.' + (item.ext || 'mp4');
    return b + 'series/' + a + ep.id + '.' + (ep.ext || 'mp4');
  }

  function epg(item, cb) {
    if (P.type !== 'xtream') return cb(null, []);
    httpJson(xUrl('action=get_short_epg&stream_id=' + item.id + '&limit=3'), function (err, j) {
      if (err || !j || !j.epg_listings) return cb(null, []);
      cb(null, j.epg_listings.map(function (e) {
        return { title: b64(e.title), desc: b64(e.description), start: Number(e.start_timestamp) * 1000, end: Number(e.stop_timestamp) * 1000 };
      }));
    });
  }

  function vodInfo(item, cb) {
    if (P.type !== 'xtream') return cb(null, {});
    httpJson(xUrl('action=get_vod_info&vod_id=' + item.id), function (err, j) {
      if (err || !j) return cb(null, {});
      cb(null, j.info || {});
    });
  }

  function seriesInfo(item, cb) {
    if (P.type !== 'xtream') {
      var map = (D.seriesEps && D.seriesEps[item.id]) || {}, seasons = [];
      for (var k in map) if (map.hasOwnProperty(k)) seasons.push({ n: k, eps: map[k].slice().sort(function (a, b) { return a.num - b.num; }) });
      seasons.sort(function (a, b) { return Number(a.n) - Number(b.n); });
      return setTimeout(function () { cb(null, { info: {}, seasons: seasons }); }, 0);
    }
    httpJson(xUrl('action=get_series_info&series_id=' + item.id), function (err, j) {
      if (err) return cb(err);
      var seasons = [], eps = (j && j.episodes) || {};
      for (var s in eps) if (eps.hasOwnProperty(s)) {
        seasons.push({ n: s, eps: eps[s].map(function (e) {
          return { id: String(e.id), num: e.episode_num, title: e.title || ('Episódio ' + e.episode_num), ext: e.container_extension || 'mp4',
            plot: (e.info && e.info.plot) || '', dur: (e.info && e.info.duration) || '' };
        }) });
      }
      seasons.sort(function (a, b) { return Number(a.n) - Number(b.n); });
      cb(null, { info: (j && j.info) || {}, seasons: seasons });
    });
  }

  return {
    login: login, load: load, streamUrl: streamUrl, epg: epg, vodInfo: vodInfo, seriesInfo: seriesInfo,
    data: function () { return D; }, profile: function () { return P; }, info: function () { return info; },
    isXtream: function () { return P && P.type === 'xtream'; }
  };
})();
