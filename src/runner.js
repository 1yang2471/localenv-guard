import { spawn } from "node:child_process";
import { canSafelyTerminateProcess, classifyProcess, findProtectedProcess, getSafeCurrentOwner } from "./protected-services.js";
import { findAvailablePort } from "./port-finder.js";
import { getPortOwners } from "./process-info.js";
import { killProcessTree } from "./killer.js";
import { inferRequestedPort } from "./port-error.js";
import { injectPort } from "./port-injection.js";
import { askChoice } from "./prompt.js";
import { resolveCommandInvocation } from "./command-resolver.js";
import { localizeClassification, localizeTermination, normalizeLocale, translate } from "./i18n.js";

export async function runGuardedCommand(initialArgs, options = {}) {
  const locale = normalizeLocale(options.locale);
  if (initialArgs.length === 0) {
    printUsage(locale);
    return 1;
  }

  let args = [...initialArgs];
  let env = { ...process.env };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await runOnce(args, env, locale);
    if (result.code === 0 || result.signal) {
      return result.code ?? 1;
    }

    const port = inferRequestedPort(args, env, result.output);
    if (!port || !/EADDRINUSE|address already in use|port .*already in use|That port is already in use/i.test(result.output)) {
      return result.code;
    }

    let decision;
    try {
      decision = await resolveConflict(port, args, env, options, locale);
    } catch (error) {
      console.log(translate(locale, "recoveryFailed", { message: formatRecoveryError(error, locale) }));
      return result.code;
    }
    if (decision.action === "abort") {
      return result.code;
    }
    args = decision.args;
    env = decision.env;
  }

  console.log(translate(locale, "retriesExhausted"));
  return 1;
}

function formatRecoveryError(error, locale) {
  const message = String(error?.message ?? "").trim();
  return message || translate(locale, "unknownRecoveryError");
}

async function runOnce(args, env, locale) {
  const [command, ...commandArgs] = args;
  const invocation = resolveCommandInvocation(command, commandArgs);
  let output = "";
  const child = spawn(invocation.command, invocation.args, {
    env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: false
  });

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(chunk);
  });

  return new Promise((resolve) => {
    child.on("error", (error) => {
      console.error(translate(locale, "startFailed", { message: error.message }));
      resolve({ code: 1, signal: null, output: `${output}\n${error.message}` });
    });
    child.on("close", (code, signal) => resolve({ code, signal, output }));
  });
}

async function resolveConflict(port, args, env, options, locale) {
  console.log(`\n${translate(locale, "portInUse", { port })}`);
  const owners = await getPortOwners(port);
  const protectedOwner = findProtectedProcess(owners);
  const owner = protectedOwner?.process ?? owners[0];

  if (!owner) {
    const nextPort = await findAvailablePort(port);
    console.log(translate(locale, "ownerUnavailable", { port: nextPort }));
    return { action: "retry", ...injectPort(args, env, nextPort) };
  }

  const classification = protectedOwner?.classification ?? classifyProcess(owner);
  printOwner(owner, classification, locale);

  if (classification.protected) {
    console.log(translate(locale, "safetyStop", { reason: localizeClassification(locale, classification) }));
    console.log(translate(locale, "manualHandling"));
    return { action: "abort", args, env };
  }

  const termination = canSafelyTerminateProcess(owner, classification);
  if (!termination.allowed) {
    console.log(translate(locale, "safetyFallback", { reason: localizeTermination(locale, termination) }));
  }

  const automaticChoice = selectConflictAction(options, termination.allowed);
  const choice = automaticChoice ?? await askChoice(
    translate(locale, "chooseAction"),
    buildConflictChoices(termination.allowed, locale),
    locale
  );

  if (choice === "p") {
    const nextPort = await findAvailablePort(port);
    console.log(translate(locale, "retryOnPort", { port: nextPort }));
    return { action: "retry", ...injectPort(args, env, nextPort) };
  }

  if (choice === "k") {
    const currentOwner = getSafeCurrentOwner(owner, await getPortOwners(port));
    if (!currentOwner) {
      console.log(translate(locale, "occupantChanged"));
      return { action: "abort", args, env };
    }
    await killProcessTree(currentOwner.pid);
    console.log(translate(locale, "processTerminated", { pid: currentOwner.pid }));
    return { action: "retry", args, env };
  }

  return { action: "abort", args, env };
}

export function buildConflictChoices(canTerminate, locale = "zh") {
  const choices = [
    { key: "p", label: translate(locale, "retryAvailablePort") }
  ];
  if (canTerminate) {
    choices.push({ key: "k", label: translate(locale, "terminateAndRetry") });
  }
  choices.push(
    { key: "d", label: translate(locale, "viewAndAbort") },
    { key: "q", label: translate(locale, "abort") }
  );
  return choices;
}

export function selectConflictAction(options = {}, canTerminate) {
  if (options.auto) {
    return "p";
  }
  if (options.autoPort) {
    return "p";
  }
  return null;
}

function printOwner(owner, classification, locale) {
  console.log(translate(locale, "owner", { pid: owner.pid, name: owner.name ?? "unknown" }));
  if (owner.command) {
    console.log(translate(locale, "command", { value: owner.command }));
  }
  if (owner.cwd) {
    console.log(translate(locale, "directory", { value: owner.cwd }));
  }
  if (owner.user) {
    console.log(translate(locale, "user", { value: owner.user }));
  }
  if (owner.runtime) {
    console.log(translate(locale, "runtime", { value: owner.runtime }));
  } else if (owner.startedAt) {
    console.log(translate(locale, "startedAt", { value: owner.startedAt }));
  }
  console.log(translate(locale, "assessment", { reason: localizeClassification(locale, classification) }));
}

function printUsage(locale) {
  console.log(translate(locale, "detailedUsage"));
}
