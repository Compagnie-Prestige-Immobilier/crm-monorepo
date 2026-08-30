#!/bin/bash

# Gnawalma Deployment Script
# ------------------------------------------------------------------
DOMAIN="gnawalma-dev.surge.sh" 

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Gnawalma Auto-Deploy ===${NC}"

# Resolve directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build/app/outputs/flutter-apk"
LANDING_DIR="$SCRIPT_DIR"

# 1. Check for Surge
if ! command -v surge &> /dev/null; then
    echo -e "${RED}❌ Surge CLI is not installed.${NC}"
    exit 1
fi

# 2. Decide if we need to build
SHOULD_BUILD=true
if [[ "$1" == "--skip-build" || "$1" == "--fast" ]]; then
    SHOULD_BUILD=false
    echo -e "${YELLOW}⏩ Skipping Flutter build as requested...${NC}"
fi

if [ "$SHOULD_BUILD" = true ]; then
    echo -e "\n${BLUE}🔨 Building Release APK...${NC}"
    cd "$PROJECT_ROOT"
    
    # We remove old APKs to ensure we don't copy an old one by mistake
    rm -f "$BUILD_DIR"/*.apk
    
    # Build for a specific platform to keep size smaller if preferred, 
    # but here we follow the standard release build
    flutter build apk --release
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Flutter build failed.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Build successful!${NC}"
fi

# 3. Locate and Copy the APK
cd "$LANDING_DIR"
APK_SOURCE=$(find "$BUILD_DIR" -name "*release.apk" | head -n 1)

if [ -z "$APK_SOURCE" ]; then
    APK_SOURCE=$(find "$BUILD_DIR" -name "*.apk" | head -n 1)
fi

if [ -f "$APK_SOURCE" ]; then
    echo -e "\n${BLUE}📦 Updating Deployment Assets...${NC}"
    cp -f "$APK_SOURCE" "$LANDING_DIR/app-release.apk"
    echo -e "${GREEN}✓ APK copied: $(basename "$APK_SOURCE")${NC}"
else
    # Fallback: check if we already have one in landing_page (for --skip-build)
    if [ ! -f "$LANDING_DIR/app-release.apk" ]; then
        echo -e "${RED}❌ No APK found to deploy.${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⚠️ Using existing APK in landing folder.${NC}"
fi

# 4. Update Build Metadata in HTML
CURRENT_DATE=$(date +"%Y.%m.%d %H:%M")
# Get human readable size (e.g., 24M)
APK_SIZE=$(du -h "$LANDING_DIR/app-release.apk" | cut -f1)

echo -e "${BLUE}📝 Updating HTML metadata...${NC}"

# Update Build Date
sed -i "s|<span class=\"value\">#.*</span>|<span class=\"value\">#$CURRENT_DATE</span>|" index.html

# Update APK Size
# Looks for 'APK FILE • ...' and replaces it
sed -i "s|APK FILE • [0-9.]*[A-Z]*|APK FILE • $APK_SIZE|g" index.html

echo -e "${GREEN}✓ Updated Build Version: #$CURRENT_DATE${NC}"
echo -e "${GREEN}✓ Updated Display Size: $APK_SIZE${NC}"

# 5. Deploy to Surge
echo -e "\n${BLUE}🚀 Deploying to $DOMAIN...${NC}"
surge . $DOMAIN

echo -e "\n${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "URL: ${BLUE}https://$DOMAIN${NC}"
