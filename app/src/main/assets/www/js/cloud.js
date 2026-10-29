/* Conecta Celtv (nuvem) — receber arquivos do celular via Supabase — ES5 */
var CLOUD = {
  url: 'https://egfyuauacwdxsnoyhnny.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZnl1YXVhY3dkeHNub3lobm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3ODgyODcsImV4cCI6MjEwODM2NDI4N30.tb37oGc51KdAu5y_2tp-UhvTXuW5gXzfBG4udvk8b30',
  phoneUrl: 'conecta-celtv.vercel.app'
};
function cloudRpc(fn, args, cb) {
  var x = new XMLHttpRequest();
  x.open('POST', CLOUD.url + '/rest/v1/rpc/' + fn);
  x.setRequestHeader('apikey', CLOUD.key);
  x.setRequestHeader('Authorization', 'Bearer ' + CLOUD.key);
  x.setRequestHeader('Content-Type', 'application/json');
  x.timeout = 15000;
  x.onload = function () {
    var j = null; try { j = JSON.parse(x.responseText); } catch (e) {}
    if (x.status >= 200 && x.status < 300) cb(null, j); else cb({ status: x.status, message: (j && j.message) || ('Erro ' + x.status) });
  };
  x.onerror = x.ontimeout = function () { cb({ status: 0, message: 'Sem internet' }); };
  x.send(JSON.stringify(args || {}));
}
function cloudUrl(path) { return CLOUD.url + '/storage/v1/object/public/celtv/' + path; }
function fileKind(ext) {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].indexOf(ext) >= 0) return 'image';
  if (['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'ts'].indexOf(ext) >= 0) return 'video';
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'flac'].indexOf(ext) >= 0) return 'audio';
  if (['m3u', 'm3u8', 'celtv'].indexOf(ext) >= 0) return 'playlist';
  return 'file';
}
function myPlatform() {
  if (window.tizen) return 'tizen';
  if (window.PalmSystem || window.webOS) return 'webos';
  if (window.AndroidApp || /Android/i.test(navigator.userAgent)) return 'androidtv';
  if (/Windows/i.test(navigator.userAgent)) return 'windows';
  return 'other';
}
