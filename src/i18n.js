const MESSAGES = {
  zh: {
    usage: "用法：leg [--lang zh|en] [--auto] <启动命令>\n      leg [--lang zh|en] doctor\n\n--lang  设置界面语言。\n--auto  自动处理可安全恢复的端口冲突。",
    detailedUsage: "LocalEnv-Guard\n\n用法：\n  leg [--lang zh|en] <任意启动命令>\n  leg [--lang zh|en] --auto <任意启动命令>\n  leg [--lang zh|en] doctor\n\n示例：\n  leg --lang en npm run dev\n  leg python manage.py runserver 127.0.0.1:8000\n",
    recoveryFailed: "自动恢复失败：{message}",
    unknownRecoveryError: "发生未知错误，请手动处理端口占用。",
    retriesExhausted: "已重试 3 次仍未恢复，已停止自动操作。",
    startFailed: "启动命令失败：{message}",
    portInUse: "leg 检测到端口 {port} 被占用。",
    ownerUnavailable: "未能读取占用进程详情，将保守切换到端口 {port} 后重试。",
    safetyStop: "安全熔断：{reason}",
    manualHandling: "请手动处理该服务，LocalEnv-Guard 不会终止它。",
    safetyFallback: "安全降级：{reason}",
    chooseAction: "请选择处理方式：",
    retryOnPort: "将使用端口 {port} 重试。",
    processTerminated: "已终止 PID {pid} 的进程树，正在重试。",
    occupantChanged: "占用进程已变化或不再符合安全终止条件，已停止终止操作。",
    owner: "占用者：PID {pid} / {name}",
    command: "命令：{value}",
    directory: "目录：{value}",
    user: "用户：{value}",
    runtime: "运行时长：{value}",
    startedAt: "启动时间：{value}",
    assessment: "判断：{reason}",
    retryAvailablePort: "换到可用端口并重试",
    terminateAndRetry: "终止占用进程树并重试",
    viewAndAbort: "查看详情后放弃",
    abort: "放弃",
    noListeners: "leg doctor：常见开发端口当前没有监听进程。",
    doctorNoBatch: "为避免误杀，doctor 不支持 --yes 批量自动清理。请逐项确认。",
    doctorPrompt: "是否清理 {port} 上的 {name}({pid})？",
    skip: "跳过",
    terminateTree: "终止进程树",
    invalidChoice: "请输入上面列出的选项字母。",
    manualAction: "手动处理",
    interactiveAction: "可交互清理"
  },
  en: {
    usage: "Usage: leg [--lang zh|en] [--auto] <start command>\n       leg [--lang zh|en] doctor\n\n--lang  Set the interface language.\n--auto  Automatically recover from safely recoverable port conflicts.",
    detailedUsage: "LocalEnv-Guard\n\nUsage:\n  leg [--lang zh|en] <start command>\n  leg [--lang zh|en] --auto <start command>\n  leg [--lang zh|en] doctor\n\nExamples:\n  leg --lang en npm run dev\n  leg python manage.py runserver 127.0.0.1:8000\n",
    recoveryFailed: "Automatic recovery failed: {message}",
    unknownRecoveryError: "An unknown error occurred. Handle the port conflict manually.",
    retriesExhausted: "Recovery stopped after 3 unsuccessful attempts.",
    startFailed: "Failed to start command: {message}",
    portInUse: "leg detected that port {port} is already in use.",
    ownerUnavailable: "The occupying process could not be identified. Retrying conservatively on port {port}.",
    safetyStop: "Safety stop: {reason}",
    manualHandling: "Handle this service manually. LocalEnv-Guard will not terminate it.",
    safetyFallback: "Safety fallback: {reason}",
    chooseAction: "Choose an action:",
    retryOnPort: "Retrying on port {port}.",
    processTerminated: "Terminated the process tree for PID {pid}; retrying.",
    occupantChanged: "The occupying process changed or no longer meets the safe-termination conditions. Termination was stopped.",
    owner: "Occupying process: PID {pid} / {name}",
    command: "Command: {value}",
    directory: "Directory: {value}",
    user: "User: {value}",
    runtime: "Runtime: {value}",
    startedAt: "Started: {value}",
    assessment: "Assessment: {reason}",
    retryAvailablePort: "Retry on an available port",
    terminateAndRetry: "Terminate the process tree and retry",
    viewAndAbort: "View details and abort",
    abort: "Abort",
    noListeners: "leg doctor: no listeners were found on common development ports.",
    doctorNoBatch: "To prevent accidental termination, doctor does not support batch cleanup with --yes. Confirm each process individually.",
    doctorPrompt: "Clean up {name} ({pid}) on port {port}?",
    skip: "Skip",
    terminateTree: "Terminate process tree",
    invalidChoice: "Enter one of the option letters listed above.",
    manualAction: "Manual handling required",
    interactiveAction: "Interactive cleanup available"
  }
};

export function normalizeLocale(locale) {
  return String(locale ?? "").toLowerCase() === "en" ? "en" : "zh";
}

export function translate(locale, key, values = {}) {
  const template = MESSAGES[normalizeLocale(locale)][key];
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}

export function localizeClassification(locale, classification) {
  if (normalizeLocale(locale) !== "en") {
    return classification.reason;
  }
  if (classification.protected) {
    return `${classification.serviceName} is a protected database, middleware, or system service. LocalEnv-Guard will not offer automatic termination.`;
  }
  return "The process is not on the protected-service list.";
}

export function localizeTermination(locale, termination) {
  if (normalizeLocale(locale) !== "en") {
    return termination.reason;
  }
  return termination.allowed
    ? "Recognized as an explicit local development server command."
    : "This process cannot be confirmed as a local development server, so termination is unavailable to prevent accidental termination.";
}
