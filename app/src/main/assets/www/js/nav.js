/* Navegação por controle remoto (setas / OK / Voltar) — ES5 */
var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACK_LG: 461, ESC: 27, BACKSPACE: 8,
  CH_UP: 427, CH_DOWN: 428, PGUP: 33, PGDN: 34, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
  PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412, DONE: 65376, CANCEL: 65385, INFO: 457 };

var Nav = (function () {
  var cur = null, scope = null, editing = null;

  function visible(el) {
    if (!el || el.offsetParent === null) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function all() {
    var root = scope || document;
    var list = root.querySelectorAll('.f'), out = [];
    for (var i = 0; i < list.length; i++) if (visible(list[i])) out.push(list[i]);
    return out;
  }
  function colOf(el) { while (el && el !== document.body) { if (el.className && /\bcol\b|\bnavgroup\b/.test(el.className)) return el; el = el.parentNode; } return null; }

  function focus(el, noScroll) {
    if (!el) return;
    if (cur && cur !== el) { cur.className = cur.className.replace(/\s*\bfocus\b/g, ''); }
    cur = el;
    if (!/\bfocus\b/.test(el.className)) el.className += ' focus';
    var c = colOf(el); if (c) c._last = el;
    if (!noScroll) scrollInto(el);
    if (el._onFocus) el._onFocus(el);
  }
  function scrollInto(el) {
    var p = el.parentNode;
    while (p && p !== document.body) {
      if (p.className && /\bscroll\b/.test(p.className)) {
        var er = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
        if (p.scrollHeight > p.clientHeight + 2) {
          var padY = er.height * 0.6;
          if (er.top < pr.top + padY) p.scrollTop -= (pr.top + padY - er.top);
          else if (er.bottom > pr.bottom - padY) p.scrollTop += (er.bottom - pr.bottom + padY);
        }
        if (p.scrollWidth > p.clientWidth + 2) {
          var padX = er.width * 0.7;
          if (er.left < pr.left + padX) p.scrollLeft -= (pr.left + padX - er.left);
          else if (er.right > pr.right - padX) p.scrollLeft += (er.right - pr.right + padX);
        }
        if (p._onScroll) p._onScroll();
      }
      p = p.parentNode;
    }
  }

  function move(dir) {
    if (!cur || !visible(cur)) { var f = all()[0]; if (f) focus(f); return; }
    var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, bestScore = 1e9, items = all();
    for (var i = 0; i < items.length; i++) {
      var el = items[i]; if (el === cur) continue;
      var b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var dx = bx - ax, dy = by - ay, main, cross;
      if (dir === 'left') { if (b.right > a.left + 2) continue; main = a.left - b.right; cross = Math.abs(dy); }
      else if (dir === 'right') { if (b.left < a.right - 2) continue; main = b.left - a.right; cross = Math.abs(dy); }
      else if (dir === 'up') { if (b.bottom > a.top + 2) continue; main = a.top - b.bottom; cross = Math.abs(dx); }
      else { if (b.top < a.bottom - 2) continue; main = b.top - a.bottom; cross = Math.abs(dx); }
      // mesma coluna: prefere alinhamento
      var score = Math.max(0, main) + cross * (dir === 'left' || dir === 'right' ? 0.6 : 2.2);
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      var c1 = colOf(cur), c2 = colOf(best);
      var grp = c2 && /\bnavgroup\b/.test(c2.className);
      if (c2 && c2 !== c1 && (grp || dir === 'left' || dir === 'right')) {
        var pref = (c2._last && c2.contains(c2._last) && visible(c2._last)) ? c2._last : c2.querySelector('.f.sel');
        if (pref && visible(pref)) best = pref;
      }
      focus(best);
      return true;
    }
    return false;
  }

  function activate() {
    if (!cur) return;
    if (/\bfield\b/.test(cur.className)) { startEdit(cur); return; }
    if (cur._onEnter) cur._onEnter(cur); else if (cur.onclick) cur.onclick();
  }

  function startEdit(wrap) {
    var inp = wrap.querySelector('input,textarea'); if (!inp) return;
    editing = wrap; wrap.className += ' editing';
    try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
  }
  function stopEdit() {
    if (!editing) return;
    var inp = editing.querySelector('input,textarea');
    try { inp.blur(); } catch (e) {}
    editing.className = editing.className.replace(/\s*\bediting\b/g, '');
    var w = editing; editing = null;
    if (w._onDone) w._onDone(inp.value);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document.body) { if (t.className && /(^|\s)f(\s|$)/.test(t.className)) break; t = t.parentNode; }
    if (!t || t === document.body) return;
    focus(t, true);
    if (/\bfield\b/.test(t.className)) startEdit(t); else activate();
  });

  return {
    focus: focus, move: move, activate: activate, all: all,
    current: function () { return cur; },
    setScope: function (el) { scope = el; },
    editing: function () { return editing; },
    stopEdit: stopEdit,
    first: function () { var a = all(); if (a.length) focus(a[0]); }
  };
})();
