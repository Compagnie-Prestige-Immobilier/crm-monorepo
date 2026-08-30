#!/bin/bash

# Configuration
APK_SOURCE="../build/app/outputs/flutter-apk/app-release.apk"
DEST_DIR="."
DEST_FILE="gnawalma-latest.apk"
PORT=8000

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Gnawalma Local Release Manager ===${NC}"

# Check if APK exists
if [ -f "$APK_SOURCE" ]; then
    echo -e "Found release APK. Copying to landing page..."
    cp "$APK_SOURCE" "$DEST_DIR/$DEST_FILE"
    echo -e "${GREEN}✓ Updated $DEST_FILE with latest build.${NC}"
else
    echo -e "⚠️  No app-release.apk found in build outputs."
    echo "   Using existing placeholder if available."
fi

# Get Local IP (Linux/MacOS compatible)
IP=$(hostname -I | awk '{print $1}')

echo -e "\n${GREEN}🚀 Server Starting!${NC}"
echo -e "Scan this URL on your phone (same WiFi):"
echo -e "${BLUE}http://$IP:$PORT${NC}"
echo -e "----------------------------------------"

# Start Python Server
python3 -m http.server $PORT
