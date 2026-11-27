import routes from '../content/routes.json';
import { jobTitle } from '../content/experiences';
import type { Locale } from '../content/home';
import { skills } from '../content/skills';
// Single schema.org Person shared by the homes, the skills pages and the story pages (contract lot 6a, V3):
// one @id, one canonical url (the origin, in both languages).
export const ORIGIN = routes.origin;
export const PERSON_ID = ORIGIN + '/#arnaud-durand';
export const PERSON_URL = ORIGIN + '/';
// Inline-safe JSON-LD: `<` is escaped so that the payload can never close its <script> element.
export const jsonLdHtml = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });
// Contact links shared by the home page and the JSON-LD Person.
export const MAIL = 'mailto:arnaud.durand97@gmail.com';
export const GITHUB = 'https://github.com/Wesper-Dev';
export const LINKEDIN = 'https://www.linkedin.com/in/arnaud-durand42/';
// Spoken languages, named in the page's language, in the order of the contact sentence (content/home.ts, endText).
const LANGUAGES: Record<Locale, string[]> = { en: ['French', 'English', 'Spanish'], fr: ['français', 'anglais', 'espagnol'] };
// Full Person, identical on the home and the skills page of one language (lot 6a, X5): email is the bare address.
export const personNode = (locale: Locale) => ({
  '@type': 'Person', '@id': PERSON_ID, name: 'Arnaud Durand', url: PERSON_URL, jobTitle: jobTitle[locale],
  email: MAIL.replace(/^mailto:/, ''),
  knowsLanguage: LANGUAGES[locale].map((name) => ({ '@type': 'Language', name })),
  knowsAbout: skills[locale].groups.flatMap((g) => g.items.map((i) => i.name)),
  sameAs: [GITHUB, LINKEDIN],
});
// Reduced Person, the author of the story pages (X1).
export const personRef = { '@type': 'Person', '@id': PERSON_ID, name: 'Arnaud Durand', url: PERSON_URL };
