// Refige les textes du lot 6a (v8-textes-figes.test.ts) : copie site/content/faq.json dans tests/fixtures/faq-lot6.json
// (en gardant le _lisezMoi de la fixture) et site/public/llms.txt dans tests/fixtures/llms-lot6.txt. À lancer seulement
// après un changement de texte voulu et validé par Arnaud ; le diff des fixtures montre alors l'avant → après.
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-textes-lot6.ts
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { FAQ_FILE, FAQ_FIXTURE, LLMS_FILE, LLMS_FIXTURE } from '../helpers-6.ts';

for (const f of [FAQ_FILE, LLMS_FILE]) if (!existsSync(f)) {
  console.error(`absent : ${f}`);
  process.exit(2);
}
const old = existsSync(FAQ_FIXTURE) ? (JSON.parse(readFileSync(FAQ_FIXTURE, 'utf8')) as Record<string, unknown>) : {};
const cur = JSON.parse(readFileSync(FAQ_FILE, 'utf8')) as Record<string, unknown>;
const out = { _lisezMoi: old._lisezMoi, ...Object.fromEntries(Object.entries(cur).filter(([k]) => !k.startsWith('_'))) };
writeFileSync(FAQ_FIXTURE, JSON.stringify(out, null, 1) + '\n');
copyFileSync(LLMS_FILE, LLMS_FIXTURE);
console.log(`écrit : ${FAQ_FIXTURE}\nécrit : ${LLMS_FIXTURE}`);
