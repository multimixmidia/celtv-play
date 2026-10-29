@echo off
chcp 65001 >nul
echo === Publicando Celtv Play (APK) ===
copy /Y "C:\tvcast\CeltvPlay-Android\build-apk.yml" "C:\tvcast\CeltvPlay-Android\.github\workflows\build-apk.yml"
cd /d C:\tvcast\CeltvPlay-Android
git add -A
git commit -m "publicar APK no Release"
git push
echo.
echo Pronto! Aguarde 2-3 min e acesse o link do Release.
pause
