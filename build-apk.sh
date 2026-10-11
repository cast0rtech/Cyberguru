#!/usr/bin/env bash
# ==============================================================================
# Cyberguru - Script de Compilación de APK para Android (Linux / macOS)
# Autor: cast0rtech
# ==============================================================================
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=========================================================="
echo "   CYBERGURU — Generador de APK para Android"
echo "   Autor: cast0rtech"
echo -e "==========================================================${NC}\n"

# 1. Detectar Android SDK si no está en PATH
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
        echo -e "${GREEN}[✓] Android SDK detectado en: $ANDROID_HOME${NC}"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
        echo -e "${GREEN}[✓] Android SDK detectado en: $ANDROID_HOME${NC}"
    fi
fi

# 2. Compilar Frontend y sincronizar con Capacitor
echo -e "${YELLOW}[1/3] Compilando frontend y sincronizando assets web...${NC}"
cd frontend
npm run build
npx cap sync android
cd ..

# 3. Compilar APK con Gradle
echo -e "${YELLOW}[2/3] Ensamblando APK nativa con Gradle...${NC}"
cd frontend/android
chmod +x ./gradlew
./gradlew assembleDebug
cd ../..

# 4. Copiar APK generada a la raíz
APK_SRC="frontend/android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="Cyberguru.apk"

if [ -f "$APK_SRC" ]; then
    cp "$APK_SRC" "$APK_DEST"
    SIZE=$(du -h "$APK_DEST" | cut -f1)
    echo -e "${GREEN}[3/3] ¡APK compilada exitosamente!${NC}"
    echo -e "${CYAN}Archivo generado: $APK_DEST ($SIZE)${NC}"
    echo -e "${YELLOW}Para instalar en un dispositivo conectado:${NC}"
    echo "  adb install -r $APK_DEST"
else
    echo -e "${RED}[X] No se encontró el APK generado en $APK_SRC${NC}"
    exit 1
fi
