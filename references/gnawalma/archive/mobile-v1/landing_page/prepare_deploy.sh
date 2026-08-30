#!/bin/bash

# Configuration
APK_SOURCE="../build/app/outputs/flutter-apk/app-release.apk"
DEST_DIR="."
DEST_FILE="gnawalma-latest.apk"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Gnawalma Deployment Prep ===${NC}"

# 1. Check for Release APK
if [ -f "$APK_SOURCE" ]; then
    echo -e "📦 Found release APK. Copying to deployment folder..."
    cp "$APK_SOURCE" "$DEST_DIR/$DEST_FILE"
    echo -e "${GREEN}✓ APK copied successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  No app-release.apk found!${NC}"
    echo "   Running build command first..."
    cd ..
    flutter build apk --release
    cd landing_page
    
    # Try copy again
    if [ -f "$APK_SOURCE" ]; then
        cp "$APK_SOURCE" "$DEST_DIR/$DEST_FILE"
        echo -e "${GREEN}✓ Build success & APK copied!${NC}"
    else
        echo -e "${RED}❌ Build failed or APK not found.${NC}"
        exit 1
    fi
fi

echo -e "\n${BLUE}=== Ready for Deployment ===${NC}"
echo -e "Your 'landing_page' folder now contains:"
echo -e " - index.html"
echo -e " - styles.css"
echo -e " - logo.png"
echo -e " - gnawalma-latest.apk (The App)"

echo -e "\n${GREEN}Recommended Option: Netlify Drop${NC}"
echo -e "1. Go to https://app.netlify.com/drop"
echo -e "2. Drag and drop the '${YELLOW}landing_page${NC}' folder from your file manager."
echo -e "3. Done! You will get a permanent public URL (e.g., rigid-soup-123.netlify.app)."

echo -e "\n${YELLOW}Alternative (CLI): Surge.sh${NC}"
echo -e "Run: npm install -g surge && surge"
