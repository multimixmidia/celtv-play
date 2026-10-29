/* Player: AVPlay (app Samsung Tizen) ou <video> + hls.js (navegador / Android / LG) — ES5 */
var Player = (function () {
  var AV = (window.webapis && window.webapis.avplay) ? window.webapis.avplay : null;
  var video = null, hls = null, host = null, url = null, opts = {}, state = 'idle';

  function rectOf(el) {
    var r = el.getBoundingClientRect(), k = 1920 / (window.innerWidth || 1920);
    return [Math.round(r.left * k), Math.round(r.top * k), Math.round(r.width * k), Math.round(r.height * k)];
  }
  function setPlayingBg(on) {
    var c = document.body.className.replace(/\s*\bplaying\b/g, '');
    document.body.className = on ? c + ' playing' : c;
    var h = document.documentElement.className.replace(/\s*\bplaying\b/g, '');
    document.documentElement.className = on ? h + ' playing' : h;
  }
  function fire(name, a) { if (opts[name]) try { opts[name](a); } catch (e) {} }

  /* ───── AVPlay (Samsung) ───── */
  function avPlay() {
    try { AV.stop(); } catch (e) {} try { AV.close(); } catch (e) {}
    try {
      AV.open(url);
      var r = rectOf(host); AV.setDisplayRect(r[0], r[1], r[2], r[3]);
      try { AV.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch (e) {}
      AV.setListener({
        onbufferingstart: function () { fire('onBuffer', true); },
        onbufferingcomplete: function () { fire('onBuffer', false); },
        onstreamcompleted: function () { state = 'ended'; fire('onEnd'); },
        onerror: function (e) { state = 'error'; fire('onError', 'Não foi possível reproduzir (' + e + ')'); },
        oncurrentplaytime: function () {}
      });
      setPlayingBg(true);
      state = 'loading'; fire('onBuffer', true);
      AV.prepareAsync(function () {
        if (opts.startAt) { try { AV.seekTo(opts.startAt * 1000); } catch (e) {} }
        AV.play(); state = 'playing'; fire('onBuffer', false); fire('onReady');
      }, function (e) { state = 'error'; fire('onBuffer', false); fire('onError', 'Canal indisponível (' + e + ')'); });
    } catch (e) { state = 'error'; fire('onError', 'Erro no player: ' + e.message); }
  }

  /* ───── HTML5 (navegador) ───── */
  function ensureVideo() {
    if (video) return video;
    video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.addEventListener('waiting', function () { fire('onBuffer', true); });
    video.addEventListener('playing', function () { state = 'playing'; fire('onBuffer', false); });
    video.addEventListener('ended', function () { state = 'ended'; fire('onEnd'); });
    video.addEventListener('error', function () { if (state !== 'idle') { state = 'error'; fire('onBuffer', false); fire('onError', 'Não foi possível reproduzir este conteúdo'); } });
    video.addEventListener('loadedmetadata', function () {
      if (opts.startAt) { try { video.currentTime = opts.startAt; } catch (e) {} opts.startAt = 0; }
      fire('onReady');
    });
    return video;
  }
  function htmlPlay() {
    var v = ensureVideo();
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    host.appendChild(v);
    state = 'loading'; fire('onBuffer', true);
    var isHls = /\.m3u8(\?|$)/i.test(url) || /m3u8/i.test(url);
    var isTs = /\.ts(\?|$)/i.test(url);
    if (isHls && !v.canPlayType('application/vnd.apple.mpegurl') && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(url); hls.attachMedia(v);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function () { tryPlay(v); });
      hls.on(window.Hls.Events.ERROR, function (ev, d) { if (d && d.fatal) { state = 'error'; fire('onBuffer', false); fire('onError', 'Canal indisponível'); } });
    } else {
      if (isTs && !v.canPlayType('video/mp2t')) { fire('onBuffer', false); fire('onError', 'Formato .ts não suportado aqui. Em Configurações, use "m3u8".'); return; }
      v.src = url; tryPlay(v);
    }
  }
  function tryPlay(v) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }

  function play(u, h, o) {
    stop(true);
    url = u; host = h; opts = o || {};
    if (AV) avPlay(); else htmlPlay();
  }
  function setHost(h) {
    host = h;
    if (AV) { try { var r = rectOf(h); AV.setDisplayRect(r[0], r[1], r[2], r[3]); } catch (e) {} }
    else if (video) { var t = video.currentTime, playing = !video.paused; h.appendChild(video); if (playing) tryPlay(video); }
  }
  function stop(keepBg) {
    state = 'idle';
    if (AV) { try { AV.stop(); } catch (e) {} try { AV.close(); } catch (e) {} if (!keepBg) setPlayingBg(false); }
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (video) { try { video.pause(); } catch (e) {} video.removeAttribute('src'); try { video.load(); } catch (e) {} if (video.parentNode) video.parentNode.removeChild(video); }
    url = null;
  }
  function toggle() {
    if (AV) { try { var st = AV.getState(); if (st === 'PLAYING') AV.pause(); else AV.play(); } catch (e) {} return; }
    if (video) { if (video.paused) tryPlay(video); else video.pause(); }
  }
  function paused() {
    if (AV) { try { return AV.getState() === 'PAUSED'; } catch (e) { return false; } }
    return video ? video.paused : false;
  }
  function seek(sec) {
    if (AV) { try { if (sec > 0) AV.jumpForward(sec * 1000); else AV.jumpBackward(-sec * 1000); } catch (e) {} return; }
    if (video && isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + sec));
  }
  function time() {
    if (AV) { try { return { cur: AV.getCurrentTime() / 1000, dur: AV.getDuration() / 1000 }; } catch (e) { return { cur: 0, dur: 0 }; } }
    if (video) return { cur: video.currentTime || 0, dur: isFinite(video.duration) ? video.duration : 0 };
    return { cur: 0, dur: 0 };
  }

  return { play: play, stop: stop, setHost: setHost, toggle: toggle, paused: paused, seek: seek, time: time,
    url: function () { return url; }, state: function () { return state; }, isAV: !!AV };
})();
