@echo off
title ViralBoost Launcher
color 0A
echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                    🚀 ViralBoost Launcher                     ║
echo  ║         Social Video Promotion Platform - One Click          ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  Opening interactive demo in your default browser...
echo.

start "" "START.html"

echo  ✅ Done! If it didn't open, double-click START.html manually.
echo.
echo  For full deployment (requires Docker):
echo  1. Run: .\scripts\generate-secrets.ps1
echo  2. Run: docker-compose up -d postgres redis rabbitmq minio
echo  3. Run: docker-compose run --rm api-gateway npx prisma migrate dev
echo  4. Run: docker-compose up -d --build
echo  5. Open: https://localhost
echo.
pause