// Fitness 42 text of communities: FAITS §6.3 › À propos (formulation of 5 October); the rest is reused by reference.
// Audit of lot 5 (U7): only the fields read by a component (portfolio-home.tsx, site-shell.tsx) or by
// scripts/export-copy.mjs are kept; a text that no page renders is not stored here.
import projects from './projects.json' with {type:'json'};
import { projectName } from './project-name.ts';
export type Locale = 'en' | 'fr';
export const home = {
  en: {
    nav: ['Projects', 'Hackathons', 'Skills'], selected: 'A few things I’ve built', selectedNote: 'Ideas explored in teams, then taken a little further.',
    projects: projects.filter(p=>p.story).map(p=>({name:projectName(p,'en'),category:p.en.tags.join(' · '),text:p.en.summary,role:p.en.role,id:p.id})),
    hackTitle:'Good company. New problems.', hackIntro:'Hackathons are a way for me to meet people and explore unfamiliar ground. Some ideas become longer projects; others remain experiments.',
    aboutTitle:'There’s more to it than code.',
    aboutIntro:'I enjoy learning with other people. That takes different forms: organising a developer talk, coaching a training session, or listening to a debate that changes how I see a problem.',
    communities:[{name:'GDG on Campus 42 Paris',tag:'Organise & share',text:'I co-organise the chapter: two events of 100+ attendees, including a talk on Gemini with Laurent Picard from Google (July 2026).',url:'https://gdg.community.dev/gdg-on-campus-42-paris-paris-france/'},{name:'Fitness 42',tag:'Train & encourage',text:'Coach for 3+ years: 50+ sessions, 20+ of them solo-led, 15–20 participants each.',url:''},{name:'CITOY.ENS',tag:'Listen & question',text:'Conferences and debates. I attend talks and have suggested speakers to the association.',url:'https://citoyens-website.cdn.dgnum.eu/'}],
    endTitle:'Something worth building?', endText:'I’m looking for a permanent role in applied AI or AI platforms, and I’m open to freelance work. I also like collaborating on projects, open source especially, and I’m always up for a hackathon. Native French, fluent English, Spanish (B1).', mail:'Let’s talk', footer:'Made in Paris.', skip:'Skip to content'
  },
  fr: {
    nav:['Projets','Hackathons','Compétences'], selected:'Quelques projets en chemin',selectedNote:'Des idées explorées en équipe, puis prolongées.',
    projects: projects.filter(p=>p.story).map(p=>({name:projectName(p,'fr'),category:p.fr.tags.join(' · '),text:p.fr.summary,role:p.fr.role,id:p.id})),
    hackTitle:'Des rencontres. Des problèmes nouveaux.',hackIntro:'Les hackathons me permettent de rencontrer des gens et d’explorer des terrains inconnus. Certaines idées deviennent des projets au long cours ; d’autres restent des expériences.',aboutTitle:'Il n’y a pas que le code.',aboutIntro:'J’aime apprendre avec les autres. Cela peut prendre la forme d’un événement développeur, d’une séance de coaching ou d’un débat qui change ma façon de regarder un problème.',
    communities:[{name:'GDG on Campus 42 Paris',tag:'Organiser et partager',text:'Je co-organise le chapitre : deux événements de plus de 100 personnes, dont un talk sur Gemini avec Laurent Picard, de Google (juillet 2026).',url:'https://gdg.community.dev/gdg-on-campus-42-paris-paris-france/'},{name:'Fitness 42',tag:'S’entraîner et encourager',text:'Coach depuis plus de 3 ans : plus de 50 séances, dont plus de 20 menées seul, 15 à 20 personnes par séance.',url:''},{name:'CITOY.ENS',tag:'Écouter et questionner',text:'Des conférences et des débats. J’assiste aux rencontres et j’ai proposé des intervenants à l’association.',url:'https://citoyens-website.cdn.dgnum.eu/'}],
    endTitle:'Une idée à construire ?',endText:'Je cherche un CDI en IA appliquée ou en plateforme IA, et je reste ouvert aux missions freelance. J’aime aussi collaborer sur des projets, open source en particulier, et je réponds présent aux hackathons. Français langue maternelle ; anglais courant ; espagnol B1.',mail:'Parlons-en',footer:'Fait à Paris.',skip:'Aller au contenu'
  }
};
