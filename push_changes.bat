@echo off
echo ========================================
echo [TemplateAI] GitHub Push Start...
echo ========================================

git add .
git commit -m "feat: optimize for 3 Flash with pixel-perfect gray placeholders"
git push

echo.
echo ========================================
echo Push Completed!
echo ========================================
pause
