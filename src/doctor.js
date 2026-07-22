import { canSafelyTerminateProcess, classifyProcess } from "./protected-services.js";
import { getPortOwners } from "./process-info.js";
import { killProcessTree } from "./killer.js";
import { askChoice } from "./prompt.js";
import { localizeTermination, normalizeLocale, translate } from "./i18n.js";

export const DEFAULT_DOCTOR_PORTS = [
  3000, 3001, 4173, 4200, 4321, 5000, 5173, 5174, 5432, 6379, 8000, 8080, 9229
];

export function buildDoctorRows(entries, locale = "zh") {
  const resolvedLocale = normalizeLocale(locale);
  return entries.map((entry) => {
    const classification = classifyProcess(entry.process);
    const termination = canSafelyTerminateProcess(entry.process, classification);
    return {
      port: entry.port,
      pid: entry.process.pid,
      name: entry.process.name ?? "unknown",
      command: entry.process.command ?? "",
      cwd: entry.process.cwd ?? "",
      protected: classification.protected,
      terminable: termination.allowed,
      reason: localizeTermination(resolvedLocale, termination),
      action: translate(resolvedLocale, termination.allowed ? "interactiveAction" : "manualAction")
    };
  });
}

export async function runDoctor({ ports = DEFAULT_DOCTOR_PORTS, yes = false, locale = "zh" } = {}) {
  const resolvedLocale = normalizeLocale(locale);
  const entries = [];
  for (const port of ports) {
    const owners = await getPortOwners(port);
    for (const owner of owners) {
      entries.push({ port, process: owner });
    }
  }

  const rows = buildDoctorRows(entries, resolvedLocale);
  if (rows.length === 0) {
    console.log(translate(resolvedLocale, "noListeners"));
    return 0;
  }

  console.table(rows.map(({ port, pid, name, action, reason }) => ({ port, pid, name, action, reason })));

  if (yes) {
    console.log(translate(resolvedLocale, "doctorNoBatch"));
  }

  for (const row of rows.filter((item) => item.terminable)) {
    const choice = await askChoice(
      translate(resolvedLocale, "doctorPrompt", row),
      [
        { key: "s", label: translate(resolvedLocale, "skip") },
        { key: "k", label: translate(resolvedLocale, "terminateTree") }
      ],
      resolvedLocale
    );
    if (choice === "k") {
      await killProcessTree(row.pid);
    }
  }

  return 0;
}
