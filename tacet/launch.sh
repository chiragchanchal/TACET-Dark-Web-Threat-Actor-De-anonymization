#!/bin/bash
# TACET Full Launch Script
# This script installs dependencies, trains the ML model, builds the frontend, and starts the server.

set -e # Exit on any error

echo "========================================="
echo "        TACET FULL LAUNCH SCRIPT         "
echo "========================================="

echo "[1/5] Installing node dependencies..."
npm run setup

echo "[2/5] Installing Python ML dependencies..."
python -m pip install -r server/ml/requirements.txt

echo "[3/5] Training the stylometry model (generates artifacts)..."
python server/ml/train.py

echo "[4/5] Building the Vite web frontend..."
npm run build

echo "[5/5] Starting the TACET server..."
npm start
