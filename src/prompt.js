import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { translate } from "./i18n.js";

export async function askChoice(question, choices, locale = "zh") {
  if (!input.isTTY) {
    return choices[0].key;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const suffix = choices.map((choice) => `${choice.key}) ${choice.label}`).join("  ");
    while (true) {
      const answer = (await rl.question(`${question}\n${suffix}\n> `)).trim().toLowerCase();
      const match = choices.find((choice) => choice.key === answer);
      if (match) {
        return match.key;
      }
      console.log(translate(locale, "invalidChoice"));
    }
  } finally {
    rl.close();
  }
}
