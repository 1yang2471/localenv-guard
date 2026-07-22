# LocalEnv-Guard

[English README](README.en.md)

LocalEnv-Guard 是一个跨平台本地开发守卫 CLI，命令简称 `leg`。它包装你的真实启动命令，在出现 `EADDRINUSE` 或常见端口占用报错时，自动分析占用进程，并让你选择换端口重试、终止普通开发进程树后重试，或放弃。

## 核心特性

- `leg <任意启动命令>`：按原样启动 npm、Python、Node、Django 等开发命令。
- 自动识别端口冲突：支持 Node `EADDRINUSE`、通用 `address already in use`、Django 常见端口占用提示。
- 占用者画像：展示 PID、进程名、命令行、用户、运行时间等能获取到的信息。
- 安全熔断：MySQL、PostgreSQL、Redis、MongoDB、Nginx、Apache、Docker、SSH 等保护服务，以及 root/系统账户和 Windows 核心服务宿主，均不会被自动终止，也不会推荐终止。
- 保守终止策略：只有命令行能明确识别为 Vite、Next dev、Django runserver、Flask 等本地开发服务器时，才提供终止选项；未知进程只能换端口或手动处理。
- 终止前复核：用户确认终止后，leg 会重新确认相同 PID 仍监听该端口、命令画像与启动时间未变化且仍是明确开发服务；任何变化都会停止终止。
- 扩展开发识别：支持 Astro、Nuxt、SvelteKit、Angular、Remix、Gatsby、Storybook、Rails、Laravel、Phoenix、Go、Rust、.NET、Spring Boot 等明确开发命令；数据库、中间件、容器运行时和系统服务优先熔断。
- 智能换端口：自动寻找下一个可用端口，并通过 `PORT` 环境变量及常见 `--port` / `--port=` / Django `runserver host:port` 参数注入重试。
- `--auto` 零交互模式：明确开发进程自动清理并原端口重试；未知进程自动换端口，保护服务始终中断。
- 中英文界面：默认中文；使用 `--lang zh` 或 `--lang en` 切换，或通过 `LEG_LANG=en` 设置英文默认值。命令行参数优先于环境变量。
- 进程树清理：Windows 优先使用 `taskkill /T /F`，受限环境回退到原生进程快照；macOS/Linux 递归清理子进程并在必要时升级到 `SIGKILL`。
- `leg doctor`：扫描常见开发端口，列出占用情况，并只对明确识别的本地开发服务器提供交互式清理。

## 安装与运行

当前原型零 npm 依赖，Node.js 18.18 或更高版本即可。

```powershell
cd D:\workspace\本地环境守卫
node .\bin\leg.js node -e "console.log('hello')"
```

Windows 如果遇到 `npm.ps1` 执行策略限制，可直接使用：

```powershell
npm.cmd test
```

开发期也可以创建本地命令链接：

```powershell
npm.cmd link
leg doctor
```

## 使用示例

```bash
leg npm run dev
leg python manage.py runserver 127.0.0.1:8000
leg node server.js --port 3000
leg --auto npm run dev
leg --lang en npm run dev
LEG_LANG=en leg doctor
leg doctor
```

当端口冲突发生时，`leg` 会显示类似信息：

```text
leg 检测到端口 5173 被占用。
占用者：PID 12345 / node
命令：vite --host 0.0.0.0 --port 5173
判断：未命中保护服务名单。
请选择处理方式：
p) 换到可用端口并重试  k) 终止占用进程树并重试  d) 查看详情后放弃  q) 放弃
```

如果占用者是保护服务：

```text
安全熔断：PostgreSQL 属于数据库/中间件/系统级服务，LocalEnv-Guard 不提供自动终止选项。
请手动处理该服务，LocalEnv-Guard 不会终止它。
```

## 技术栈选择

本项目选择 Node.js 原生 ESM，而不是 Go/Rust/Python，主要因为目标用户最常遇到端口冲突的场景就是前端和 Node 开发服务器。Node CLI 的全局安装、子进程包装、TTY 交互和环境变量注入都很自然；同时本原型不引入第三方依赖，降低开源用户安装失败概率。

## 当前实现边界

- 这是可运行原型，不是最终稳定版。
- macOS/Linux 端口占用查询依赖 `lsof`，进程树查询优先用 `pgrep`。
- Windows 端口占用查询优先使用 PowerShell `Get-NetTCPConnection` 与 `Get-CimInstance`，拿不到结果时回退到 `netstat -ano` 和 `Get-Process`。
- `PORT` 环境变量能覆盖多数开发服务器；对特殊框架可能还需要补充适配器。
- 对 `npm run <script>`，leg 会追加 npm 标准的 `-- --port <新端口>` 参数，以覆写 Vite/Next 等脚本转发的端口选项。
- 终止已识别的本地开发进程仍需要用户交互确认，默认不做静默杀进程；无法确认身份的进程不会显示终止选项。

## 项目结构

```text
bin/leg.js                 CLI 入口
src/runner.js              命令执行、错误拦截、重试编排
src/port-error.js          端口解析和命令端口推断
src/port-injection.js      新端口注入
src/process-info.js        跨平台端口占用者查询
src/command-resolver.js    Windows 下解析 npm.cmd/node.exe 等真实可执行文件
src/protected-services.js  保护服务识别
src/killer.js              跨平台进程树终止
src/doctor.js              全局体检
test/*.test.js             行为回归测试
docs/安全性自测报告.md       安全红线说明
```

## 测试

```bash
node --test
```

Windows 上可用下面一条命令执行核心自动化验收。它会自行创建端口占用和临时子进程，并在结束时清理；无需手动开两个终端或终止系统进程。

```powershell
npm.cmd run test:acceptance
```

该验收覆盖未知进程避让并换端口、Windows npm 启动、`--port` 和 Django `runserver` 参数覆写、进程树清理，以及保护服务熔断。

语言支持由 CLI 参数和环境变量共同控制：

```powershell
# 本次命令使用英文，优先级高于 LEG_LANG
node .\bin\leg.js --lang en --auto npm run dev

# 将当前 PowerShell 会话的默认界面语言设为英文
$env:LEG_LANG = "en"
node .\bin\leg.js doctor
```

发布前还应执行：

```bash
npm ci --ignore-scripts
npm run pack:check
```

GitHub Actions 会在 Windows、macOS、Linux 和 Node.js 18/20/22 上执行同一套检查。
