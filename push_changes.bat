@echo off
echo ========================================
echo [TemplateAI] GitHub Push Start...
echo ========================================

git add .
git commit -m "feat: implement PortOne V2 payment integration with KG Inicis and webhooks"
git push

echo.
echo ========================================
echo Push Completed!
echo ========================================
pause
