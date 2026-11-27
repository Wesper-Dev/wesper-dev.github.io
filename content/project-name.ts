// Round W (contrat-relecture-w.md, W2): a project's name in the page language. projects.json may give `fr.name` or
// `en.name` ("French Red Cross" on the English pages); otherwise the shared `name`.
export type Lang = 'fr' | 'en';
export function projectName(p: { name: string; fr: object; en: object }, l: Lang): string {
  return (p[l] as { name?: string }).name ?? p.name;
}
