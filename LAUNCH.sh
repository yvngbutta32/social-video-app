#!/bin/bash
# ViralBoost Launcher for macOS/Linux

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🚀 ViralBoost Launcher                     ║"
echo "║         Social Video Promotion Platform - One Click          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Opening interactive demo in your default browser..."
echo ""

# Detect OS and open appropriately
if [[ "$OSTYPE" == "darwin"* ]]; then
    open START.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open START.html
else
    echo "Please open START.html manually in your browser"
fi

echo "✅ Done! If it didn't open, double-click START.html manually."
echo ""
echo "For full deployment (requires Docker):"
echo "  1. Run: ./scripts/generate-secrets.sh"
echo "  2. Run: docker-compose up -d postgres redis rabbitmq minio"
echo "  3. Run: docker-compose run --rm api-gateway npx prisma migrate dev"
echo "  4. Run: docker-compose up -d --build"
echo "  5. Open: https://localhost"
echo ""
read -p "Press Enter to exit..."