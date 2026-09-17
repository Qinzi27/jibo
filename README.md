# 肌薄

肌薄是围绕薄肌锻炼的本地训练应用，支持 Android 8.0 及以上。没有账号、广告、追踪或后台服务，全部页面与动作素材随安装包提供，可离线使用。

## 安装

下载 [肌薄 v1.4.0 Android 测试版](dist/jibo-v1.4.0.apk)，传到手机后打开，按系统提示安装。可使用 [SHA-256 校验文件](dist/jibo-v1.4.0.apk.sha256) 核对安装包。

## 功能

- 内置健身房与居家训练计划，逐组记录重量、次数或秒数。
- 自建动作：从手机选择照片或视频截图，也可现场拍照，填写名字和学习笔记。
- 自定义计划：混合内置与自建动作，调整顺序、组数、目标和休息时间。
- 自动保存训练草稿、组间休息计时；“计划”页内切换训练计划和我的进度。
- “肌薄理论”：15 条公开可核实 X 原帖，按观点／训练／饮食／趣味分类，可搜索、按作者筛选、翻看截图及复制出处。长文采用摘要和短句截图节选，视频只收录封面，不代表完整推文历史。
- 用户提供的漫画单格裁剪成独立表情包，黄毛简笔画头像用作应用图标。
- 完整 JSON 备份与导入、训练 CSV 导出，另有食品标签计算工具。

## 本地与隐私

图片在设备上压缩成副本，原图不变。动作图片、计划和训练记录保存在应用私有空间，应用没有网络权限，也没有上传功能。Android 自动云备份和设备迁移已关闭，系统选择器明确请求仅本机内容；厂商选择器是否遵守该限定尚需真机确认。手机相册自身的云同步设置独立于肌薄。

JSON 备份包含自建动作、图片与计划。卸载或清空应用会删除本地记录，请先主动导出备份。导入是确认后的完整替换。数据为本机明文 JSON，未提供加密功能。

空白不代表零；有效数据填写完整后才能标记完成。模板目标不会自动变成实际完成记录，自重次数、计时与负重次数分别统计。

## 电脑预览

需要 Python 3，无需安装 npm 运行时依赖。macOS 可双击 `start-local.command`，Windows 可双击 `start-local.bat`，或运行：

```bash
python3 scripts/serve.py
```

打开 `http://127.0.0.1:8766/`，服务仅监听本机。浏览器记录与浏览器配置、地址及端口绑定，请固定使用同一入口。电脑上的选图按钮读取电脑文件，手机上的按钮读取手机文件。

也可直接打开 [离线单文件网页](dist/jibo-offline.html)。不同浏览器对本地 HTML 存储的支持可能不同，请定期导出备份。

## 构建与测试

网页无 npm 运行时依赖。修改 `web/` 后重新生成离线 HTML：

```bash
python3 scripts/build_web.py
npm test
npm run check
```

Android 构建需要 Python 3、JDK 17+、Android SDK Platform 35 和 Build Tools 35.0.0。先使用 Android SDK Manager 安装工具并处理许可，再运行：

```bash
python3 scripts/build_android.py --check-only
python3 scripts/build_android.py
```

通过 `ANDROID_HOME` 或 `--sdk PATH` 指定 SDK。脚本使用官方 SDK 工具构建和验证，不依赖 Gradle，也不会自动下载 SDK。产物写入 `dist/`。

图标的已导出资源随源码提供，正常构建无需图像库。需要重新导出图标时安装 Pillow，再运行 `python3 scripts/build_icons.py`；`scripts/generate_assets.py` 只生成动作示意图，不覆盖人物图标。

首次本地构建会生成私有测试签名密钥。发布更新需保持相同包名与签名密钥；源码不包含此处 APK 的私钥，因此自行生成的密钥不能覆盖安装此处 APK。可通过 `LEAN_KEYSTORE_PATH`、`LEAN_KEY_ALIAS`、`LEAN_STORE_PASS`、`LEAN_KEY_PASS` 提供自己的固定密钥。不要提交私钥或密码。

仓库的 Android Actions 工作流仅支持手动触发，需配置 `LEAN_KEYSTORE_BASE64`、`LEAN_KEY_ALIAS`、`LEAN_STORE_PASS`、`LEAN_KEY_PASS` 四项仓库 secrets；它保留构建产物，不自动发布。

可选浏览器回归需要 Node.js 与 Playwright。通过 `--node`、`--node-modules`、`--chromium` 指定已有工具，或使用 `PATH`、`NODE_PATH`、`CHROMIUM_PATH` 环境变量。默认也查找项目 `node_modules/playwright`。

```bash
python3 tests/jibo_ui_test.py --custom-only
```

浏览器测试使用独立临时配置与随机本机端口，不使用日常浏览器记录。其他测试范围可通过 `--mobile-only`、`--pwa-only`、`--theory-only` 选择，省略范围参数运行主要界面回归。

v1.4.0 已通过 63 项核心测试与 261 项独立浏览器检查（主要界面 97、手机布局 38、自建动作和计划 42、理论与合并导航 62、PWA 离线 22）。APK 编译、对齐与签名验证通过。尚未连接 Android 真机或模拟器验证系统选图、拍照、原生持久化、软键盘及覆盖安装。

## 目录与许可

- `web/`：应用界面、数据模型、计划及离线素材。
- `artwork/`：人物图标的高分辨率源图，供重新导出使用，不装入 APK。
- `android/`：Android 原生外壳和资源。
- `scripts/`：网页、Android 构建及本机预览工具。
- `tests/`：核心模型和浏览器回归测试。
- `dist/`：可安装 APK、校验文件与离线网页。

应用代码与原创素材采用 [MIT 许可](LICENSE)。X 原帖截图、漫画单格及人物参考图标涉及第三方素材，来源与截取范围见 [第三方素材说明](THIRD_PARTY_NOTICES.md)，不包含在 MIT 授权范围内。包名 `app.leancrew.local` 与既有存储标识保持不变，以保留升级兼容性。
