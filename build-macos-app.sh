#!/bin/bash

APP_NAME="LocalHttpProxy"
APP_DIR="dist/${APP_NAME}.app"

# 清理旧的构建
rm -rf dist

# 创建 .app 目录结构
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources/app"

# 复制应用文件
cp -r server.js src public config node_modules package.json "${APP_DIR}/Contents/Resources/app/"

# 创建启动脚本
cat > "${APP_DIR}/Contents/MacOS/${APP_NAME}" << 'LAUNCHER'
#!/bin/bash
cd "$(dirname "$0")/../Resources/app"

# 尝试多种方式找到 node
if [ -x "/usr/local/bin/node" ]; then
    NODE_PATH="/usr/local/bin/node"
elif [ -x "/opt/homebrew/bin/node" ]; then
    NODE_PATH="/opt/homebrew/bin/node"
elif [ -d "$HOME/.nvm" ]; then
    # 加载 nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    NODE_PATH="$(which node)"
else
    # 尝试从 PATH 中找
    NODE_PATH="$(which node 2>/dev/null)"
fi

if [ -z "$NODE_PATH" ] || [ ! -x "$NODE_PATH" ]; then
    osascript -e 'display alert "错误" message "找不到 Node.js，请先安装 Node.js"'
    exit 1
fi

"$NODE_PATH" server.js
LAUNCHER
chmod +x "${APP_DIR}/Contents/MacOS/${APP_NAME}"

# 创建 Info.plist
cat > "${APP_DIR}/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>LocalHttpProxy</string>
    <key>CFBundleIdentifier</key>
    <string>com.local.httpproxy</string>
    <key>CFBundleName</key>
    <string>LocalHttpProxy</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
PLIST

echo "✅ 应用已打包到: dist/${APP_NAME}.app"
echo "双击即可运行，会自动打开浏览器控制页面"
