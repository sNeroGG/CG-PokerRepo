@echo off
cd /d "%~dp0"

echo ========================================
echo   CHOLOS GROUP CORPORATION - Monorepo local
echo ========================================
echo.

echo [1/2] Instalando dependencias (root + workspaces)...
call npm install
if errorlevel 1 (
    echo Error en npm install.
    pause
    exit /b 1
)

echo.
echo [2/2] Iniciando frontend en http://localhost:3000
echo Copia frontend\.env.example a frontend\.env.local y configura Supabase
echo.

cd frontend
call npm run dev

pause
