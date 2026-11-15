@echo off
cd /d "%~dp0"
if not exist "node_modules\" (
    echo Prvo pokretanje: instaliram Node.js ovisnosti (npm install)...
    call npm install
)
if not exist ".next\BUILD_ID" (
    echo Pripremam produkcijsku verziju aplikacije (npm run build)...
    call npm run build
)
start "" "http://localhost:3000"
npm start
pause
