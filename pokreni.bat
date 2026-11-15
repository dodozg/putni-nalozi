@echo off
cd /d "%~dp0"
if not exist "node_modules\" (
    echo Prvo pokretanje: instaliram Node.js ovisnosti (npm install)...
    call npm install
)
start "" "http://localhost:3000"
npm run dev
pause
