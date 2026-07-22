# LocalEnv-Guard

[中文说明](README.md)

LocalEnv-Guard is a cross-platform CLI for handling local development port conflicts safely. Its command is `leg`. It wraps your real start command, detects common `EADDRINUSE` errors, identifies the occupying process, and either retries on a free port, safely terminates a confirmed development-server process tree, or stops.

## Safety First

- Protected services such as MySQL, PostgreSQL, Redis, Docker, SSH, system service hosts, and privileged-account processes are never offered automatic termination.
- An unknown or insufficiently identified process is never offered termination. `--auto` always moves to a free port instead and never terminates a process.
- Only explicitly recognized local development-server commands can be terminated, and protected-service classification always wins.
- Before termination, leg rechecks that the same PID still listens on the port and that its command and available start-time identity have not changed. Any uncertainty stops termination.
- `leg doctor` reports common development ports and requires confirmation for each eligible cleanup. It does not support bulk cleanup with `--yes`.

## Language

The default interface language is Chinese. Select English for one command with `--lang en`, or set `LEG_LANG=en` for the current shell. `--lang` takes precedence over `LEG_LANG`.

```powershell
node .\bin\leg.js --lang en --auto npm run dev
$env:LEG_LANG = "en"
node .\bin\leg.js doctor
```

Use `--lang zh` to force Chinese.

## Install and Run

The project currently has no runtime npm dependencies and requires Node.js 18.18 or later.

```powershell
cd D:\workspace\本地环境守卫
node .\bin\leg.js --lang en node -e "console.log('hello')"
```

For development, you can create a local command link:

```powershell
npm.cmd link
leg --lang en doctor
```

## Examples

```bash
leg npm run dev
leg --lang en npm run dev
leg --auto npm run dev
leg python manage.py runserver 127.0.0.1:8000
LEG_LANG=en leg doctor
```

## Verification

```powershell
npm.cmd run test:ci
npm.cmd run pack:check
```

The GitHub Actions workflow runs the same checks on Windows, macOS, and Linux with Node.js 18, 20, and 22. All nine jobs must pass before release.

## Current Boundaries

- Each new commit must pass the remote nine-job CI matrix before it can be treated as release-ready.
- macOS/Linux process inspection depends on `lsof` and `pgrep`.
- Some frameworks may require a dedicated port-injection adapter.
- Child-process output remains the child program's own language; `leg` translates its own help, prompts, diagnostic labels, and recovery messages.
