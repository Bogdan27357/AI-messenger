#!/bin/bash
#
# ПРМ Мессенджер — Установка (Linux / macOS)
# Запуск: chmod +x setup.sh && ./setup.sh
#

set -e

APP_NAME="ПРМ Мессенджер"
APP_ID="prm-messenger"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICON_SRC="$SCRIPT_DIR/logo.png"

# Colors
C="\033[36m"  # cyan
G="\033[32m"  # green
R="\033[31m"  # red
Y="\033[33m"  # yellow
N="\033[0m"   # reset

echo ""
echo -e "${C}╔══════════════════════════════════════════╗${N}"
echo -e "${C}║     ПРМ — Корпоративный мессенджер       ║${N}"
echo -e "${C}║         Установка приложения              ║${N}"
echo -e "${C}╚══════════════════════════════════════════╝${N}"
echo ""

# ─── Check / Install Node.js ────────────────────────────────────────

check_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v)
    echo -e "${G}✓${N} Node.js найден: $NODE_VER"
    # Check minimum version (18+)
    MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR" -lt 18 ]; then
      echo -e "${Y}⚠ Требуется Node.js 18+. Текущая версия: $NODE_VER${N}"
      install_node
    fi
  else
    echo -e "${Y}Node.js не найден. Устанавливаю...${N}"
    install_node
  fi
}

install_node() {
  OS="$(uname -s)"
  if [ "$OS" = "Darwin" ]; then
    # macOS
    if command -v brew &>/dev/null; then
      echo "Установка через Homebrew..."
      brew install node@20
    else
      echo -e "${R}Homebrew не найден.${N}"
      echo "Установите Node.js вручную: https://nodejs.org/"
      echo "Или установите Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
      exit 1
    fi
  else
    # Linux
    if command -v apt-get &>/dev/null; then
      echo "Установка через apt (Node.js 20)..."
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
      echo "Установка через dnf..."
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo dnf install -y nodejs
    elif command -v pacman &>/dev/null; then
      echo "Установка через pacman..."
      sudo pacman -S --noconfirm nodejs npm
    else
      echo -e "${R}Не удалось определить пакетный менеджер.${N}"
      echo "Установите Node.js 18+ вручную: https://nodejs.org/"
      exit 1
    fi
  fi
  echo -e "${G}✓${N} Node.js установлен: $(node -v)"
}

# ─── Install dependencies ───────────────────────────────────────────

install_deps() {
  echo ""
  echo -e "${C}[1/4]${N} Установка зависимостей сервера..."
  cd "$SCRIPT_DIR"
  npm install --production=false 2>&1 | tail -1

  echo -e "${C}[2/4]${N} Установка зависимостей клиента..."
  cd "$SCRIPT_DIR/client"
  npm install 2>&1 | tail -1

  echo -e "${G}✓${N} Все зависимости установлены"
}

# ─── Build frontend ─────────────────────────────────────────────────

build_frontend() {
  echo ""
  echo -e "${C}[3/4]${N} Сборка фронтенда..."
  cd "$SCRIPT_DIR/client"
  npx vite build 2>&1 | tail -3
  echo -e "${G}✓${N} Фронтенд собран"
}

# ─── Create directories ─────────────────────────────────────────────

ensure_dirs() {
  mkdir -p "$SCRIPT_DIR/server/data"
  mkdir -p "$SCRIPT_DIR/server/uploads"
}

# ─── Create desktop shortcut ────────────────────────────────────────

create_shortcut() {
  echo ""
  echo -e "${C}[4/4]${N} Создание ярлыка..."

  OS="$(uname -s)"
  if [ "$OS" = "Darwin" ]; then
    create_macos_app
  else
    create_linux_desktop
  fi
}

create_linux_desktop() {
  # Convert logo to proper icon if possible
  ICON_DIR="$HOME/.local/share/icons"
  mkdir -p "$ICON_DIR"

  if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$ICON_DIR/prm-messenger.png"
    ICON_PATH="$ICON_DIR/prm-messenger.png"
  else
    ICON_PATH="applications-internet"
  fi

  # Create launcher script
  LAUNCHER="$SCRIPT_DIR/prm-launcher.sh"
  cat > "$LAUNCHER" << LAUNCHER_EOF
#!/bin/bash
cd "$SCRIPT_DIR"
node start.js "\$@"
LAUNCHER_EOF
  chmod +x "$LAUNCHER"

  # Create .desktop file
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  DESKTOP_FILE="$DESKTOP_DIR/prm-messenger.desktop"

  cat > "$DESKTOP_FILE" << DESKTOP_EOF
[Desktop Entry]
Name=ПРМ Мессенджер
Comment=Корпоративный мессенджер — Аэропорт Пулково
Exec=$LAUNCHER
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=Network;Chat;InstantMessaging;
StartupWMClass=prm-messenger
Keywords=messenger;chat;мессенджер;чат;прм;
DESKTOP_EOF

  chmod +x "$DESKTOP_FILE"

  # Also copy to Desktop if it exists
  if [ -d "$HOME/Desktop" ]; then
    cp "$DESKTOP_FILE" "$HOME/Desktop/prm-messenger.desktop"
    chmod +x "$HOME/Desktop/prm-messenger.desktop"
    echo -e "${G}✓${N} Ярлык создан на рабочем столе"
  elif [ -d "$HOME/Рабочий стол" ]; then
    cp "$DESKTOP_FILE" "$HOME/Рабочий стол/prm-messenger.desktop"
    chmod +x "$HOME/Рабочий стол/prm-messenger.desktop"
    echo -e "${G}✓${N} Ярлык создан на рабочем столе"
  fi

  # Update desktop database
  if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  fi

  echo -e "${G}✓${N} Приложение добавлено в меню"
}

create_macos_app() {
  APP_DIR="$HOME/Applications/ПРМ Мессенджер.app"
  mkdir -p "$APP_DIR/Contents/MacOS"
  mkdir -p "$APP_DIR/Contents/Resources"

  # Copy icon
  if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$APP_DIR/Contents/Resources/icon.png"
    # Try to create .icns if sips available
    if command -v sips &>/dev/null && command -v iconutil &>/dev/null; then
      ICONSET="$APP_DIR/Contents/Resources/icon.iconset"
      mkdir -p "$ICONSET"
      for size in 16 32 64 128 256 512; do
        sips -z $size $size "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}.png" 2>/dev/null || true
        double=$((size * 2))
        sips -z $double $double "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" 2>/dev/null || true
      done
      iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/app.icns" 2>/dev/null || true
      rm -rf "$ICONSET"
    fi
  fi

  # Create launcher
  cat > "$APP_DIR/Contents/MacOS/launch" << MAC_EOF
#!/bin/bash
cd "$SCRIPT_DIR"
exec node start.js
MAC_EOF
  chmod +x "$APP_DIR/Contents/MacOS/launch"

  # Create Info.plist
  cat > "$APP_DIR/Contents/Info.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>ПРМ Мессенджер</string>
  <key>CFBundleIdentifier</key>
  <string>com.pulkovo.prm-messenger</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>launch</string>
  <key>CFBundleIconFile</key>
  <string>app.icns</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST_EOF

  echo -e "${G}✓${N} Приложение создано: ~/Applications/ПРМ Мессенджер.app"
}

# ─── Main ────────────────────────────────────────────────────────────

main() {
  check_node
  ensure_dirs
  install_deps
  build_frontend
  create_shortcut

  echo ""
  echo -e "${G}╔══════════════════════════════════════════╗${N}"
  echo -e "${G}║        Установка завершена!               ║${N}"
  echo -e "${G}╚══════════════════════════════════════════╝${N}"
  echo ""
  echo "Способы запуска:"
  echo -e "  ${C}1.${N} Из меню приложений / ярлык на рабочем столе"
  echo -e "  ${C}2.${N} Команда: ${Y}node start.js${N}        — десктоп (Electron)"
  echo -e "  ${C}3.${N} Команда: ${Y}node start.js --web${N}  — в браузере"
  echo ""
  echo -e "Демо-вход: ${Y}admin / admin123${N}"
  echo ""

  # Ask to launch now
  read -p "Запустить приложение сейчас? [Y/n] " LAUNCH
  LAUNCH=${LAUNCH:-Y}
  if [[ "$LAUNCH" =~ ^[YyДд] ]]; then
    echo ""
    echo -e "${C}Запуск ПРМ Мессенджер...${N}"
    cd "$SCRIPT_DIR"
    node start.js
  fi
}

main
