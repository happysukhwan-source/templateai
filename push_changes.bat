@echo off
echo ========================================
echo [TemplateAI] GitHub Push Start...
echo ========================================

git add .
git commit -m "feat: implement tiered credit deduction (5000px+ 2 credits) and refine text placeholders"
git push

echo.
echo ========================================
echo Push Completed!
echo ========================================
pause
