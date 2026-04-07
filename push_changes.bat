@echo off
echo ========================================
echo [TemplateAI] GitHub Push Start...
echo ========================================

git add .
git commit -m "feat: fix 413 error with client-side compression and integrate PortOne V2 payments"
git push

echo.
echo ========================================
echo Push Completed!
echo ========================================
pause
