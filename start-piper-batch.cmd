@echo off
cd /d "%~dp0"
set "WORD_AUDIO_MODE=batch"
set "PORT=3002"
set "WORD_GARDEN_NODE=node"
if exist ".runtime\node.exe" set "WORD_GARDEN_NODE=.runtime\node.exe"
"%WORD_GARDEN_NODE%" server.mjs --generate-piper
if errorlevel 1 (
  pause
  exit /b 1
)
call start.cmd
