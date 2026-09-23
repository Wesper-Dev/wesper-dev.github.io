import projects from './projects.json' with {type:'json'};
export type Locale = 'en' | 'fr';
export const home = {
  en: {
    nav: ['Projects', 'Hackathons', 'Skills', 'About'], contact: 'Say hello',
    eyebrow: 'Arnaud Durand · Paris, France', title: 'Curious by nature.', titleEnd: 'Building, together.',
    intro: "I build AI tools and the systems that keep them running: LLM observability for a bank’s internal tools, sandboxed execution of agent tools, agents tested offline.",
    role: 'AI Platform / Applied AI Engineer', availability: 'Looking for a permanent role after 16 October 2026',
    selected: 'A few things I’ve built', selectedNote: 'Ideas explored in teams, then taken a little further.',
    code: 'Explore the repository', screenshot: 'Droit de Retard · demo interface from the public repository',
    projects: projects.filter(p=>p.story).map(p=>({name:p.name,category:p.en.tags.join(' · '),text:p.en.summary,role:p.en.role,url:p.repo,id:p.id})),
    foundation:'And underneath, a systems foundation.',
    foundationText:'Projects from École 42 Paris: processes, concurrency and the small details that make software work.',
    systems:[{name:'Minishell',text:'A shell in C · pipes, redirections & processes'},{name:'Inception',text:'Docker infrastructure · NGINX, WordPress & MariaDB'}],
    hackTitle:'Good company. New problems.', hackIntro:'Hackathons are a way for me to meet people and explore unfamiliar ground. Some ideas become longer projects; others remain experiments.',
    hackMore:'A selection of team experiments',
    aboutTitle:'There’s more to it than code.',
    aboutIntro:'I enjoy learning with other people. That takes different forms: organising a developer talk, coaching a training session, or listening to a debate that changes how I see a problem.',
    communities:[{name:'GDG on Campus 42 Paris',tag:'Organise & share',text:'I co-organise the chapter and help bring developers together around technology.',url:'https://gdg.community.dev/gdg-on-campus-42-paris-paris-france/'},{name:'Fitness 42',tag:'Train & encourage',text:'3+ years leading and coaching. Another place to learn and progress together.',url:''},{name:'CITOY.ENS',tag:'Listen & question',text:'Conferences and debates. I attend talks and have suggested speakers to the association.',url:'https://citoyens-website.cdn.dgnum.eu/'}],
    path:'Along the way', experiences:[['2026','BPCE','AI platform internship · the sandbox of an internal agent runtime'],['2025–2026','BNP Paribas','Data Scientist internship · 75+ containers, LLM observability, a React app'],['2019–2026','École 42 Paris','Learning through software projects']],
    endTitle:'Something worth building?', endText:'I’m looking for a permanent role in applied AI or AI platforms, and I’m open to freelance work. I also like collaborating on projects, open source especially, and I’m always up for a hackathon. French native; English fluent; Spanish B1.', mail:'Let’s talk', footer:'Made in Paris.', skip:'Skip to content'
  },
  fr: {
    nav:['Projets','Hackathons','Compétences','À propos'], contact:'Échangeons',
    eyebrow:'Arnaud Durand · Paris, France', title:'Curieux, naturellement.', titleEnd:'Construire, ensemble.',
    intro:'Je construis des outils IA et les systèmes qui les font tourner : observabilité LLM des outils internes d’une banque, exécution isolée d’outils d’agents, agents testés hors ligne.',
    role:'AI Platform / Applied AI Engineer', availability:'À la recherche d’un CDI après le 16 octobre 2026',
    selected:'Quelques projets en chemin',selectedNote:'Des idées explorées en équipe, puis prolongées.',
    code:'Explorer le dépôt', screenshot:'Droit de Retard · interface de démonstration du dépôt public',
    projects: projects.filter(p=>p.story).map(p=>({name:p.name,category:p.fr.tags.join(' · '),text:p.fr.summary,role:p.fr.role,url:p.repo,id:p.id})),
    foundation:'Et sous le capot, un socle systèmes.',foundationText:'Des projets d’École 42 Paris : les processus, la concurrence et les détails qui font fonctionner un logiciel.',
    systems:[{name:'Minishell',text:'Un shell en C · pipes, redirections et processus'},{name:'Inception',text:'Infrastructure Docker · NGINX, WordPress et MariaDB'}],
    hackTitle:'Des rencontres. Des problèmes nouveaux.',hackIntro:'Les hackathons me permettent de rencontrer des gens et d’explorer des terrains inconnus. Certaines idées deviennent des projets au long cours ; d’autres restent des expériences.',hackMore:'Quelques explorations en équipe',
    aboutTitle:'Il n’y a pas que le code.',aboutIntro:'J’aime apprendre avec les autres. Cela peut prendre la forme d’un événement développeur, d’une séance de coaching ou d’un débat qui change ma façon de regarder un problème.',
    communities:[{name:'GDG on Campus 42 Paris',tag:'Organiser et partager',text:'Je co-organise le chapitre pour réunir des développeurs autour de la technologie.',url:'https://gdg.community.dev/gdg-on-campus-42-paris-paris-france/'},{name:'Fitness 42',tag:'S’entraîner et encourager',text:'3+ ans d’animation et de coaching. Une autre façon d’apprendre et de progresser ensemble.',url:''},{name:'CITOY.ENS',tag:'Écouter et questionner',text:'Des conférences et des débats. J’assiste aux rencontres et j’ai proposé des intervenants à l’association.',url:'https://citoyens-website.cdn.dgnum.eu/'}],
    path:'Au fil du parcours',experiences:[['2026','BPCE','Stage plateforme IA · la sandbox d’un runtime d’agents interne'],['2025–2026','BNP Paribas','Stage Data Scientist · plus de 75 conteneurs, observabilité LLM, une application React'],['2019–2026','École 42 Paris','Apprendre par les projets logiciels']],
    endTitle:'Une idée à construire ?',endText:'Je cherche un CDI en IA appliquée ou plateforme IA, et je reste ouvert aux missions freelance. J’aime aussi collaborer sur des projets, open source en particulier, et je réponds présent aux hackathons. Français langue maternelle ; anglais courant ; espagnol B1.',mail:'Parlons-en',footer:'Fait à Paris.',skip:'Aller au contenu'
  }
};
