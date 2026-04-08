@echo off
echo ========================================
echo [TemplateAI] GitHub Push Start...
echo ========================================

git add .
git commit -m "feat: unify conversion modes to Figma Template with Gemini 3.1 Pro"
git push

echo.
echo ========================================
echo Push Completed!
echo ========================================
pause
