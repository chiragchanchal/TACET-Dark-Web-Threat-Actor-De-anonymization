@echo off
title TACET Full Launch Script
echo =========================================
echo         TACET FULL LAUNCH SCRIPT         
echo =========================================

echo [1/5] Installing node dependencies...
call npm run setup
if %errorlevel% neq 0 (
  echo Error installing node dependencies.
  pause
  exit /b %errorlevel%
)

echo [2/5] Installing Python ML dependencies...
python -m pip install -r server\ml\requirements.txt
if %errorlevel% neq 0 (
  echo Error installing Python dependencies.
  pause
  exit /b %errorlevel%
)

echo [3/5] Training the stylometry model (generates artifacts)...
python server\ml\train.py
if %errorlevel% neq 0 (
  echo Error training the ML model.
  pause
  exit /b %errorlevel%
)

echo [4/5] Building the Vite web frontend...
call npm run build
if %errorlevel% neq 0 (
  echo Error building the frontend.
  pause
  exit /b %errorlevel%
)

echo [5/5] Starting the TACET server...
call npm start

pause
