# 插件清单（dsh-plugin-catalog）

装了插件却不知道它干什么、入口在哪、命令怎么敲，是常见问题。这个插件把这些信息做成两处入口：**左侧边栏的「插件清单」面板**，以及一个可以直接问的模型工具 `plugin_catalog`。

## 它做什么

- 读取当前 profile 真正声明的插件（`package.json` 的 `dsh.profile.bundles`）与其 `node_modules` 里带 `dsh.bundle.patch` 的包，拿到包名、版本、插件元数据（`locale/*.json` 的标题与描述）。
- 与本插件内置的精编说明（`catalog.js` 的 `CURATED`）按包名合并：分类、作用、怎么用。
- **挂载项**：解析每个包自带的 `cordis.patch.yml`，列出这个 bundle 实际往宿主里插入了哪些 id / name（事实，不靠猜源码）。
- **README 用法节选**：没有精编说明的插件，自动从它的 README（`README.zh-CN.md` → `README_ZH.md` → `README.md`）里找「用法 / 使用方式 / 快速开始 / 快速上手 / Usage / Quick start」一类小节，摘前三五行作为入门说明。
- **状态**：显示「已启用」；profile 声明了但 `node_modules` 里没有包时，单独列为「声明了但没装上」，便于发现半装/坏装。
- **功能重叠提示**：包名共享显著词（browser / context / zotero / ppt / memory …）的插件会互相标注「功能可能重叠」，只作提示，不是结论。
- **更新检查与就地更新**：每个插件与 npm registry 的已发布 `latest` 对比（6 小时缓存），标出「可更新 vX」。更新不再是「自己去别处装」——卡片上的「更新」和顶部的「一键更新」会真的把新版本装上；本地符号链接包与 npm 上没有的私有包标注「没有发布源」，不参与对比，也不给更新按钮。
- **卸载**：卡片上的「卸载」按钮把插件从 profile 的依赖与 `bundles` 声明里移除、删掉包文件。可卸载性由宿主判定——官方内置包、随安装包提供的可选包、本插件自己都没有这个按钮。
- **使用统计**：扫本机的 DSH 会话日志，按工具调用给每个插件算「被调用多少次、占插件调用多少百分比、占全部工具调用多少百分比、最近一次调用时间」，卡片上一条「使用：」行直接显示，点开还能看到具体是哪些工具被调用。
- **一键导出**：把当前清单（含每个插件的使用次数）排成一份 Word，需要 PDF 时用 DSH 自带的 LibreOffice 转一次；版式与手工做的那份《插件使用清单》一致（使用概览 → 按大类分组的作用/用法/使用表 → 统计口径与未归属调用）。
- 按「内容创作 / 学术文献 / 浏览器与视觉 / 记忆与上下文 / 界面与陪伴 / 维护与管理 / 开发与集成 / 其他插件」分组展示。

## 左侧边栏面板

装好后左侧边栏多一个「插件清单」图标（`sidebar.panellist` 席位），点开就是手册式页面：

面板外面包了一层 React 错误边界：渲染时抛异常不会白屏，而是显示「插件清单面板出错了」、异常信息和一个「重试渲染」按钮，并把原始错误打到浏览器 console（前缀 `[dsh-plugin-catalog]`）。

- 配色只用主题变量（`--dsw-alias-*`）与 `color-mix` 淡填充，不写死前景色当背景：DSH 的 `--dsw-alias-brand-primary` 在浅色主题里是深色、在深色主题里是浅色（它是前景色），拿它当按钮底色会变成「白底白字」；按钮底色一律用 `label-primary` 的低透明度混色，两种主题都看得清；
- 顶部搜索框：**按空格切词，多个词必须同时命中**；搜索范围覆盖插件名、作用、用法、大类、挂载项、README 节选、版本号，以及这个插件被调用过的工具名（搜 `ops bash` 能命中挂载了 `ops_bash` 的 dsh-ops）；
- 排序下拉：按大类 / 名称（默认，按大类分组）、按使用次数、按最近调用（后两种变成一张平铺列表，卡片上带大类标签）；
- 分类筛选按钮：只看某一类；
- 每条显示：标题、版本、包名、作用、「怎么用」；
- **点开卡片**：看挂载项、README 用法全文节选、功能重叠提示，以及「复制包名」按钮（拿包名去「设置 → 插件」里搜到它的卡片与开关）；
- 「刷新」按钮重新读取宿主数据；新装的插件刷新后即出现。
- **「检查更新」按钮**：对比 npm 已发布版本，卡片上出现「可更新 vX」标记；勾「只看可更新」就只剩该更新的插件。
- **「使用：」行（每张卡片）**：如「使用：2075 次 · 占插件调用 80.9% · 占全部工具调用 38.1%」，前面一条小蓝条按占比伸缩；从没被调用过的插件显示「暂无工具调用记录」。点开卡片能看到「最近一次调用」与「被调用的工具：ops_bash ×2028、ops_inspect_local_file ×47」。
- **「卸载」按钮（每张卡片）**：只有宿主说这个包可以移除时才出现。点一下同样先出确认条，写清它会删除什么、入口会立刻消失、**没有撤销按钮**（要回来得重新安装）；确认后卡片显示「已卸载 dsh-ppt（v0.36.0），重启 DSH 后彻底卸干净」，面板顶部出现「已卸载：…」提示。
- **「更新」按钮（每张卡片）与「一键更新（N 个）」（顶部）**：点一下先出确认条（写清从哪个版本到哪个版本、会先卸载再装、失败会回滚），确认后才真正执行；卡片上随即显示「已更新 v0.35.0 → v0.36.0，重启 DSH 后生效」这类结果行。多个插件按顺序逐个更新（同一时刻只跑一个），全部完成后自动刷新清单与版本号；需要重启时面板顶部出现一条黄色提示。
- **「开关」行（点开卡片）**：显示这个插件当前是启用还是停用，并给一个「启用 / 停用」按钮。停用只是把它从 profile 的选择里去掉，**包文件不删**，重启后不再挂载；想用再点启用即可。
- **「安装来源」行（点开卡片）**：把这个包在 profile 里的依赖声明原样写出来（如 `github:owner/repo#<commit>`、`link:../../../Desktop/ops`），并说明 git 固定提交的包不会自动更新、本地目录的包跟着源目录变。
- **「版本历史」（点开卡片）**：向 npm 要这个包的全部已发布版本（最多列 40 个、面板显示前 12 个），标出当前版本、`latest` 与预发布；每个旧版本后面都有「装此版本」，点它走的是和更新同一条通道（先卸后装、失败自动恢复）。
- **一键导出到桌面（顶部右侧）**：选 Word 或 PDF，点一下就把「当前清单」写成文件（**只写你选的那一种**：选 PDF 时中间的 Word 走系统临时目录，转完即删），**落在桌面**（`%USERPROFILE%\Desktop`，中文/OneDrive 桌面也认），文件名 `DeepSeek Harness 插件使用清单-<时间戳>.docx`（同名 `.pdf` 紧随其后）；结果行给出大小、页数、**文件的完整路径**（带「复制路径」按钮）与「下载一份」链接——文件本来就已经写在那个目录里，点「下载一份」只是让浏览器再存到它自己的下载目录（通常是系统的「下载」文件夹）。同一时刻只允许一次导出，连点会得到 `export-busy`，不会一次堆出一串文件。PDF 依靠 DSH 自带的那套 LibreOffice，找不到时自动只给 Word 并说明原因。

面板数据来自宿主侧路由 `/dsh-plugin-catalog`（JSON，只读），更新检查走 `/dsh-plugin-catalog/updates.json`（`?force=1` 跳过缓存），使用统计走 `/dsh-plugin-catalog/usage.json`（`?force=1` 跳过缓存），更新执行走 `POST /dsh-plugin-catalog/update`、卸载走 `POST /dsh-plugin-catalog/remove`、启用/停用走 `POST /dsh-plugin-catalog/toggle`（`{ name, enabled, confirm: true }`，都要 `confirm: true`，且只接受本机回环地址）；版本历史走 `GET /dsh-plugin-catalog/versions.json?name=<包名>`；另有一个不依赖面板席位的独立清单页 `GET /dsh-plugin-catalog/page`（整页 HTML，可打印/存 PDF）。导出走 `POST /dsh-plugin-catalog/export`（`format: 'docx' | 'pdf'`、`confirm: true`；同一时刻只跑一次，忙时 429 `export-busy`），下载走 `GET /dsh-plugin-catalog/export/download?file=<文件名>`（只肯发导出目录里的 `.docx` / `.pdf`）。读取路由不可用时面板会显示内置快照并提示原因，不会白屏。

## 模型工具

在对话里直接问，或让模型调用工具：

```text
这个插件是干什么的：dsh-ppt
有哪些能处理文献的插件？
把所有插件按类列一下
```

| action | 作用 |
| --- | --- |
| `list` | 列出全部已安装插件，按大类分组，带作用与用法 |
| `categories` | 只给每个大类的插件数量 |
| `search` | 按关键词在包名/标题/分类/作用/用法/挂载项/README 里查 |
| `get` | 查单个插件（`name` 传包名），带状态、挂载项、README 用法节选 |
| `usage` | 列出各插件的工具调用次数与占比（`force` 可跳过缓存），附未归属的调用排行与统计口径 |
| `updates` | 对比 npm registry，列出哪些插件有新版本（`force` 可跳过缓存） |
| `update` | 真正更新一个插件：`name` 包名、`version` 目标版本、`confirm: true`；不带 `confirm` 只解释将要发生什么 |
| `remove` | 真正卸载一个插件：`name` 包名、`confirm: true`；不带 `confirm` 只解释后果。不能卸载自己，宿主判定不可移除的包会被拒绝 |
| `export` | 把全部插件导出成 Word/PDF：`format` 传 `docx`（默认）或 `pdf`、`confirm: true`；不带 `confirm` 只说明会写到哪里 |
| `versions` | 查一个包的已发布版本历史（`name` 包名）：当前版本、`latest`、预发布标记；用来挑一个旧版本回退 |
| `enable` | 启用一个插件：`name` 包名、`confirm: true`；停用后想再用它就靠这个（包文件没删，不用重装） |
| `disable` | 停用一个插件：`name` 包名、`confirm: true`；只从 profile 的选择里去掉，不删包文件，多半要重启才生效 |


## 斜杠命令与独立页

- `/plugin-catalog`：不打开面板也能查清单。`/plugin-catalog` 给总数、各大类计数与使用排行前三；`/plugin-catalog updates` 给可更新列表；`/plugin-catalog dsh-ppt` 给单个插件的详情（版本、状态、挂载项、使用）；`/plugin-catalog 浏览器与视觉` 给某一类。
- 面板席位（`sidebar.panellist`）是 DSH 未公开的扩展点，万一哪天挪走，命令与 `GET /dsh-plugin-catalog/page` 这两个入口仍然可用：前者在对话里出结果，后者是一整页可打印的清单。

## 边界

- **精编说明是构建时写好的**，覆盖制作这份插件时已知的插件；以后新装的插件仍会被扫描出来，显示版本与元数据描述，并自动摘 README 用法，只是没有精编的一句话「怎么用」。
- 挂载项来自 patch 文件，反映「声明了什么」，不等于运行时一定成功加载；README 节选是原文摘录，可能带作者自己的安装前提。
- 宿主进程若没有 `DSH_PROFILE_DIR`（桌面版常见），会回退到扫描 `$DSH_HOME/profiles/*`，挑出声明了本插件的那个 profile；都找不到时才只输出内置精编清单。
- **更新不是自己写一套安装器**：它转发到宿主的 `pluginManager.updateBundle()`，由那里负责卸载旧版本、装精确版本、`expected` 校验、失败回滚与重启语义。本插件不碰 `pnpm`，也不碰 profile 的 `package.json`。
- **导出不依赖任何第三方库**：`.docx` 是本插件自己按 OOXML 拼的（`docx.js`，含手写 ZIP），PDF 才借 DSH 安装目录里的 `@deepseek-ai/libreoffice-kit`。导出的文件只是快照，不改任何插件或 profile；重新导出即刷新。
- 导出只写桌面（或调用方显式指定的 `dir`）；下载路由只肯发桌面与旧的 `~/.dsh/exports/plugin-catalog/` 里的 `.docx` / `.pdf`，路径穿越一律 400。
- 因此能更新的只有 `pluginManager` 判定可更新的包（registry 安装的第三方 profile 依赖，且清单里有 semver 版本）：随装自带的、`link:`/`file:` 本地开发的、git 固定提交的，卡片上没有更新按钮——本插件自己是本地开发包，故不参与自我更新。
- 更新是写操作：路由只接受本机回环地址、要求 `confirm: true`，同一插件同时只允许一个更新在跑；面板里点了按钮还要再点一次「确认更新」。
- 装完多半要**重启 DSH** 才生效（宿主报告 `restart-required` 时面板会明说）；重启后版本号才会刷新。
- **卸载同样不是自己写一套删除器**：它转发到 `pluginManager.removeBundle()`，由宿主改 profile manifest、删包文件、处理在跑的 agent。可卸载性也由宿主给（`listBundles()` 的 `removable` / `optional` / `official` / `readOnlyReason`），面板不自己猜。
- 卸载**没有撤销按钮**（宿主的 `removeBundle` 只回滚失败的安装，不保留可一键恢复的备份）：要装回来得重新走安装。
- 本插件**不卸载自己**：那会连带删掉面板和 `plugin_catalog` 工具。要卸载它请到「设置 → 插件」。
- 面板没有直接跳到插件管理页的深链，只能用「复制包名」再手搜；安装与启停插件仍然走「设置 → 插件」或插件市场。
- **启用/停用转发到 `pluginManager.setBundleEnabled()`**：本插件不自己改 profile 的 `bundles` 数组。停用是「不选它」，包文件与依赖声明都还在；卸载才是删包。
- **回退用的是同一条安装通道**：`POST /update` 指定一个旧版本，宿主先卸当前版本、再装目标版本，装失败会回滚到原版本。回退与更新共用一把写锁，同一时刻只跑一个。
- **版本历史直接问 npm**（packument 里的 `versions` 与 `dist-tags`），不用宿主那个只列「比已安装更新」的接口；`link:` / git 包没有发布版本，版本历史是空的。
- **只有 registry 安装的包能回退**：本地 `link:`、git 固定提交的包没有可挑选的发布版本，面板不给版本列表。
- **新装插件的作用与用法怎么来（全自动）**：分两条路，都会自己跟上新包。①**面板现场起草**——任何没有精编说明的插件，宿主侧当场给它起草：先看斜杠命令，再看工具注册点（`tools.register({ name })` 与 `defineTool({ name: X_TOOL_NAME })` + `const X_TOOL_NAME = '...'` 两种写法都认），再看是不是界面类插件（只挂了 `dsh.client`、没有命令与工具，就写「装好后在 DSH 界面里找它的入口」），最后才退到 README 的用法/功能小节与描述；**作用**优先用包内 `locale/zh.json`，只写了英文描述时用中文 README 的第一段正文补一句中文；这条是即时的，装上就能看到，标「（自动起草，可润色）」。面板在 DSH 重新变为可见时会自动重读一次清单，不用手动点「刷新」。②**手册与导出**——生成脚本用同一套降级规则写进 `插件清单-生成脚本/plugin_catalog.json`；`auto: true` 的条目每次 `sync_catalog.py` 都会跟着包刷新（版本、作用、用法任一变化都会触发 `catalog.js` / `client.js` 重建与 Word 手册重生成，返回里的 `refreshed` 就是这些条目）；润色成固定文案就把该条目改成 `auto: false`。定时任务（每 2 小时）自动跑一遍并重出 PDF，所以新装的插件最迟两小时后也会进手册。
- 导出文档带页脚页码（`第 N 页`），由 `docx.js` 自己写 `footer1.xml` + `PAGE` 域，不依赖 Word 模板。
- **界面文案仍是中文**，没有做 i18n：DSH 目前没有把 UI 语言暴露给插件，半套翻译（外壳中文、正文另一种语言）比一致的中文更糟。真要双语，等宿主给出 locale 再一次性做。

- **使用统计只认能确定归属的调用**：DSH 的工具定义不带「这个工具属于哪个插件」的元数据，所以归属靠本插件内置的一份映射表（`catalog.js` 的 `TOOL_OWNERS` / `TOOL_PREFIXES`，源头是 `插件清单-生成脚本/tool_owners.json`）。映射不到的调用（内置的 `ops_bash` / `write` / `read` / `office_*` … 与还没登记的插件工具）记进「未归属」，**不摊给任何插件**——宁可少算，也不瞎猜。写这份表时实测覆盖率约 47%。
- **只统计工具调用**，不含斜杠命令、skill 调用、纯聊天轮次；数据来自本机 `$DSH_HOME/sessions` 的会话日志，清会话或换机器会归零，也不会上传任何地方。
- 统计有 10 分钟缓存（按会话文件的大小与修改时间增量重算），首次约 1 秒；面板页脚会写明「共 N 次调用、M 次可归属、数据截至几点」。
- 会话日志是 zstd 多帧追加文件，Node 的解压器只解第一帧，所以本插件自己按帧边界逐段解压后再逐行找 `tool/call` 事件；解不开的文件会被跳过并计入错误，不影响面板其它部分。

## 更新是怎么执行的

1. 面板点击 → `POST /dsh-plugin-catalog/update`，body `{ name, version, confirm: true }`。
2. 宿主校验：回环地址、`confirm`、包名与 semver 格式、该包在 profile 的声明里、同一插件没有在跑的更新。
3. 调 `ctx.inject(['pluginManager'])` 拿到的服务：`updateBundle(name, version, { requestId })`。
4. 回来的 `result.application` 决定提示：`applied`（已生效）、`restart-required`（重启后生效，带 `restartReason`）、`failed`（`error.code` 如 `incompatible-version` / `not-bundle` / `unexpected-package`）。失败时 profile 已被回滚到原版本。
5. 成功即清掉该包的更新缓存与 README 缓存，面板重读数据，版本号刷新。

## 卸载是怎么执行的

1. 面板点击「卸载」→ 确认条 → `POST /dsh-plugin-catalog/remove`，body `{ name, confirm: true }`。
2. 宿主校验：回环地址、`confirm`、包名格式（`@scope/name` 也认）、该包在 profile 的声明里。
3. 本地先拦三种必然不该发生的事：自己（`cannot-remove-self`）、官方内置包（`@deepseek-ai/…`）、宿主判定 `removable === false` 的包（`not-removable`，附原因：随装可选 / 官方内置 / 权限不允许 / 定位不到包目录）。
4. 调 `pluginManager.removeBundle(name)`：它改 profile 的 `package.json` 依赖与 `bundles` 声明、卸载包文件，并在有 agent 在跑时按 `busyPolicy` 处理。
5. 回来的 `application` 决定提示：`applied`（已生效）、`restart-required`（重启后彻底卸干净）、`failed`（`error.code` 如 `not-removable` / `unknown-plugin` / `operation-error`）。成功后清缓存并重读清单。

## 启用/停用与回退是怎么执行的

启用/停用：

1. 面板点「停用」→ 确认条 → `POST /dsh-plugin-catalog/toggle`，body `{ name, enabled: false, confirm: true }`。
2. 宿主先确认这是 profile 里已声明的包、且不是本插件自己（停掉自己就再也进不来了，直接拒绝）。
3. 调 `pluginManager.setBundleEnabled(name, false)`：宿主把它从 profile 的选择里移除、更新 manifest，包文件留在原处。
4. 结果按 `application` 回报：`restart-required` 时面板写「重启 DSH 后生效」，`applied` 时写「已即时生效」，失败给 `code` 与诊断。
5. 缓存里这个包的更新信息作废，随后重新读一遍 `listBundles()`，卡片上的「状态」立即跟着变。

回退到旧版本：

1. 点开卡片 →「查看全部版本」→ `GET /dsh-plugin-catalog/versions.json?name=<包名>`，拿到 npm 上全部已发布版本与 `dist-tags`。
2. 在某个旧版本后点「装此版本」→ 确认条（写清当前版本与目标版本、装失败会自动恢复）→ `POST /dsh-plugin-catalog/update`，body `{ name, version: <旧版本>, confirm: true }`。
3. 走的就是更新那条通道：`pluginManager.updateBundle(name, version)` 先卸当前版本、再装目标版本，失败回滚。
4. 结果行显示「已装回 v0.34.0（原 v0.36.0）」，重启 DSH 后生效。

## 使用统计是怎么算的

1. 宿主找出 `$DSH_HOME/sessions/*/*/session.*.jsonl(.zstd)` 这些会话日志（最多扫 400 个文件，按修改时间取最新的一批）。
2. 每个文件先看大小 + 修改时间：没变就直接用上次的计数（所以第二次几乎瞬间出结果）。
3. `.zstd` 文件按 magic `28 b5 2f fd` 切成帧、逐帧 `zstdDecompressSync`，拼成完整 JSONL 文本。
4. 逐行只看含 `tool/call` 的行，解析出 `data.name`，按工具名累加次数并记最后一次的时间戳。
5. 用 `TOOL_OWNERS`（精确名）→ `TOOL_PREFIXES`（`ops_` / `dsh_browser_` / `vision_` / `context_compression_` …，长的优先）把工具名归到包；归不到的进「未归属」。
6. 每个插件算出 `calls`、`share`（占全部可归属调用）、`shareAll`（占全部工具调用）、`lastAt`、`tools`；面板与工具共用这份结果。

## 导出是怎么做的

1. 面板点「一键导出到桌面」→ `POST /dsh-plugin-catalog/export`，body 带 `{ format, confirm: true }`（只接受本机回环）。
2. 有 `format: 'pdf'` 时，中间那份 `.docx` **只写进系统临时目录**（`os.tmpdir()/dsh-plugin-catalog-*`），交给 DSH 自带 LibreOffice 转成目标 `.pdf` 后整个临时目录删掉——桌面上只会出现你选的那一种文件，不会一次留下 Word + PDF 两份；转失败才把 Word 落到桌面兜底。目标名同秒重名时自动顺延（`…-2.pdf`），不互相覆盖。
2. 宿主先把「使用统计」（`usageSummary`，10 分钟缓存）与插件行（`joined()`）合到一起，保证表格里的次数与面板同源。
3. `exportModel()` 把这批数据排成块序列（标题、使用概览、按大类分组的表格、统计口径、未归属调用排行），
   `docx.js` 的 `buildDocx()` 直接生成 OOXML 并打包成 ZIP——不需要 Word，也不需要任何依赖。
4. 选 PDF 时再 `import()` DSH 安装目录里的 `libreoffice-kit`，`createConverter()` → `convert()` 转一次；
   目标 `.pdf` 必须不存在（kit 用 `wx` 打开），所以转换前会先删同名旧文件。
5. 结果里带文件名、完整路径、大小、页数与缺失字体；面板把这个路径直接显示出来（可复制），另给「下载一份」链接，走 `GET /export/download?file=`，只发导出目录里的文件。

## 维护（重要：只有一份数据源）

- 说明数据的唯一来源是 `插件清单-生成脚本/plugin_catalog.json`：`catalog.js` 与 `client.js` 的内置快照都由脚本生成，**不要手改**。
- 安装/升级/卸载插件后跑 `python 插件清单-生成脚本/sync_catalog.py`：自动补新插件、记版本变化、重建 `catalog.js` + `client.js`，并在有变化时重生成 Word 手册。
- 改 `index.js` / `client.js` 后需重启 DSH 才加载新代码（宿主与 client bundle 都不热更）。
- 分类名以 `plugin_catalog.json` 的 `categories` 为准（脚本会写进 `CATEGORIES`）。
- 使用统计的归属表是 `插件清单-生成脚本/tool_owners.json`：新增插件提供了工具后，在这里加精确名或前缀，再跑 `sync_catalog.py` 就会写进 `catalog.js`。表里没有的工具不会被硬塞给任何插件。
