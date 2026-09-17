# 肌薄

肌薄是围绕薄肌锻炼的本地训练应用，支持 Android 8.0 及以上。没有账号、广告、追踪或后台服务，全部页面与动作素材随安装包提供，可离线使用。

## 安装

下载 [肌薄 v1.5.1 Android 版](https://github.com/Qinzi27/jibo/releases/latest)，将 APK 传到手机后打开，按系统提示安装。可使用 [SHA-256 校验文件](dist/jibo-v1.5.1.apk.sha256) 核对安装包。

## 应用更新

首次从 v1.4 或更早版本升级，需要手动安装当前 APK；保持原应用和记录，不要先卸载。此后可在「设置 → 软件更新」检查、下载并安装新版。

默认在打开应用时每天最多检查一次，可关闭自动检查；发现新版不会自动下载或打断训练。点下载后显示进度，可随时取消。下载文件留在应用缓存，校验大小、SHA-256、包名、版本和签名信息通过后才交给 Android 安装器。系统可能要求允许肌薄安装应用，并由用户确认安装。

更新只从本仓库的 GitHub Releases 获取更新清单和 APK，不发送训练、照片或其他本地记录。断网、下载失败或取消更新不影响训练记录。网页预览提供发布页入口；APK 更新在安卓端执行。

## 功能

- 内置健身房与居家训练计划，逐组记录重量、次数或秒数。
- 自建动作：从手机选择照片或视频截图，也可现场拍照，填写名字和学习笔记。
- 自定义计划：混合内置与自建动作，调整顺序、组数、目标和休息时间。
- 自动保存训练草稿、组间休息计时；“计划”页内切换训练计划和我的进度。
- “肌薄理论”：15 条公开可核实 X 原帖，按观点／训练／饮食／趣味分类，可搜索、按作者筛选、翻看截图及复制出处。长文采用摘要和短句截图节选，视频只收录封面，不代表完整推文历史。
- 用户提供的漫画单格裁剪成独立表情包，黄毛简笔画头像用作应用图标。
- 完整 JSON 备份与导入、训练 CSV 导出，另有食品标签计算工具。

## 本地与隐私

图片在设备上压缩成副本，原图不变。动作图片、计划和训练记录保存在应用私有空间，仅更新模块使用联网权限，仍没有训练数据或图片上传功能。Android 自动云备份和设备迁移已关闭，系统选择器明确请求仅本机内容；厂商选择器是否遵守该限定尚需真机确认。手机相册自身的云同步设置独立于肌薄。

JSON 备份包含自建动作、图片与计划。卸载或清空应用会删除本地记录，请先主动导出备份。导入是确认后的完整替换。数据为本机明文 JSON，未提供独立的应用层加密。Android 版使用应用私有目录中的 AtomicFile 保存完整记录，并用私有 SharedPreferences 保存界面与更新偏好；浏览器版使用当前站点的 localStorage。没有远程数据库，也不需要数据库账号。

空白不代表零；有效数据填写完整后才能标记完成。模板目标不会自动变成实际完成记录，自重次数、计时与负重次数分别统计。

## 安全保护

v1.5.1 补齐导入／导出目标校验，拒绝外部选择器返回的私有文件路径及本应用 provider 地址；WebView 仅允许本地入口页面，禁止远程网页、子页面和任意联网。拍照临时原图在压缩完成后按文件标识清理，压缩副本保留在记录中，不更改手机相册原图。

浏览器版发现其他窗口修改或清空记录时同步状态；发现损坏内容时暂停写入并保留原文供导出恢复，导入取消或记录变化后不会继续执行过期确认。窗口写入前检查最新存储快照，但 localStorage 本身不提供跨进程事务。

更新包仍需验证大小、哈希、包名、版本及原签名，安装和授权页面只交给系统组件。没有可用系统组件时保留已验证安装包并提示失败，不回退到第三方安装器。

源码与安装包已检查私钥、常见访问令牌及非运行文件，未检出泄漏；这不等于对未知漏洞或被攻破／root 的设备作绝对安全保证。系统相机、文件选择器和覆盖安装的真实设备验证尚待完成。

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

Android 构建需要 Python 3、JDK 17+、Android SDK Platform 35 和 Build Tools 35.0.0。JVM 更新规则测试也使用这个 JDK，可通过 `JAVA_HOME` 指定。先使用 Android SDK Manager 安装工具并处理许可，再运行：

```bash
python3 scripts/build_android.py --check-only
python3 android/tests/run_tests.py
python3 android/tests/run_local_security_tests.py
python3 tests/packaging_security_test.py
python3 scripts/build_android.py
```

通过 `ANDROID_HOME` 或 `--sdk PATH` 指定 SDK。脚本使用官方 SDK 工具构建和验证，不依赖 Gradle，也不会自动下载 SDK。产物写入 `dist/`。

图标的已导出资源随源码提供，正常构建无需图像库。需要重新导出图标时安装 Pillow，再运行 `python3 scripts/build_icons.py`；`scripts/generate_assets.py` 只生成动作示意图，不覆盖人物图标。

首次本地构建会生成私有测试签名密钥。发布更新需保持相同包名与签名密钥；源码不包含此处 APK 的私钥，因此自行生成的密钥不能覆盖安装此处 APK。可通过 `LEAN_KEYSTORE_PATH`、`LEAN_KEY_ALIAS`、`LEAN_STORE_PASS`、`LEAN_KEY_PASS` 提供自己的固定密钥。不要提交私钥或密码。

仓库的 Android Actions 工作流固定官方动作的提交版本，仅向签名所需步骤提供签名凭据，且仅上传本次构建产物。工作流仅支持手动触发，需配置 `LEAN_KEYSTORE_BASE64`、`LEAN_KEY_ALIAS`、`LEAN_STORE_PASS`、`LEAN_KEY_PASS` 四项仓库 secrets；它保留构建产物，不自动发布。

可选浏览器回归需要 Node.js 与 Playwright。通过 `--node`、`--node-modules`、`--chromium` 指定已有工具，或使用 `PATH`、`NODE_PATH`、`CHROMIUM_PATH` 环境变量。默认也查找项目 `node_modules/playwright`。

```bash
python3 tests/jibo_ui_test.py --custom-only
```

浏览器测试使用独立临时配置与随机本机端口，不使用日常浏览器记录。`--updates-only` 使用模拟原生桥验证界面状态，不代表真实安卓安装器测试。其他测试范围可通过 `--mobile-only`、`--pwa-only`、`--theory-only`、`--updates-only`、`--security-only` 选择，省略范围参数运行主要界面回归。

v1.5.1 通过 47 项本地文件／WebView 规则与 84 项更新规则 JVM 检查、63 项核心测试、5 组打包安全测试，以及 224 项浏览器检查（主要界面 97、自建动作与照片 42、PWA 离线 22、模拟更新界面 38、安全专项 25）。安全专项包含真实多窗口存储和故意注入的恶意导入／脚本／图片；外部图片探针被 CSP 阻断，没有外部响应。APK 编译、对齐与签名验证通过，签名与旧版一致。尚未连接 Android 真机或模拟器验证系统选图、拍照、原生持久化、软键盘及覆盖安装。

## 发布更新

构建脚本会同时生成 APK、`.apk.sha256` 与 `dist/jibo-update.json`。每次更新必须提高 Android `versionCode`，保持 `app.leancrew.local` 包名和相同签名密钥，并同步网页与 package.json 的版本。

可用 `--notes-file 文件路径` 写入这次更新说明（UTF-8 文本，最多 4000 字）；`--output` 可改变输出目录，但 APK 文件名应保持 `jibo-v版本号.apk`。

将这三个文件上传至同一个公开的 GitHub Release，以 `v版本号` 作为标签；发布为正式 Release，并设为 Latest。应用使用固定的 `https://github.com/Qinzi27/jibo/releases/latest/download/jibo-update.json` 地址检查更新。清单中的 APK URL 必须指向本仓库该版本，不能修改哈希后复用别的 APK。原始私钥始终保留在本机或仓库 secrets 中，不放入源码或发布附件。

## 目录与许可

- `web/`：应用界面、数据模型、计划及离线素材。
- `artwork/`：人物图标的高分辨率源图，供重新导出使用，不装入 APK。
- `android/`：Android 原生外壳和资源。
- `scripts/`：网页、Android 构建及本机预览工具。
- `tests/`：核心模型和浏览器回归测试。
- `dist/`：可安装 APK、校验文件与离线网页。

应用代码与原创素材采用 [MIT 许可](LICENSE)。X 原帖截图、漫画单格及人物参考图标涉及第三方素材，来源与截取范围见 [第三方素材说明](THIRD_PARTY_NOTICES.md)，不包含在 MIT 授权范围内。包名 `app.leancrew.local` 与既有存储标识保持不变，以保留升级兼容性。
