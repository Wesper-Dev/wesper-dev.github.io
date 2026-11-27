# Arnaud Durand — portfolio

Portfolio FR/EN (direction artistique « L’arbre », sombre), publié sur GitHub Pages : https://wesper-dev.github.io/ (français : /fr/). Six projets, sept événements et trois récits par langue. Le workflow contrôle les pull requests et déploie les versions de main après un build réussi.

## Démarrer et vérifier

Node >=22.13, npm et Python 3 pour le contrôle de l’export.

```sh
npm ci
npm run dev
```

Le serveur de développement affiche son URL. Pour construire et examiner exactement les fichiers destinés à Pages :

```sh
npm run build
npm run check
npm run preview
```

Aperçu : http://127.0.0.1:4173/fr/ et http://127.0.0.1:4173/. `npm run preview -- --port <n>` change le port ; `npm run preview -- --lan` écoute sur toutes les interfaces et affiche l'adresse du réseau local (sans option, seul 127.0.0.1 répond).

`npm test` lance les tests du contrat (`tests/*.test.ts`, `node:test`) sur l'export construit : lancer d'abord `npm run build`. Le serveur statique local gère aussi la 404 et les redirections vers les répertoires. Arrêt avec Ctrl-C.

## Routes et export

Chaque langue possède un accueil, `/projects/`, `/hackathons/`, `/skills/`, les récits `/projects/droit-de-retard/`, `/projects/diary/`, `/projects/croix-rouge/` et la page de détail `/experiences/bnp-paribas/`. La liste unique des routes est `content/routes.json` : `normalize-export.mjs`, `check-export.py` (dans les deux sens : route sans page, page sans route, sitemap) et le sitemap la lisent ; les deux scripts acceptent `--dist <dossier>`. Les chemins français sont préfixés `/fr/` — l'onglet Compétences garde le segment `skills/` dans les deux langues, seul son libellé change.

Vinext exporte des fichiers `.html` sans slash terminal. `scripts/normalize-export.mjs` crée un vrai `index.html` pour chaque répertoire. `/missing` sert de source technique à la `404.html` bilingue ; cette page n’est pas dans le sitemap. Le navigateur peut ouvrir chaque route directement, sans repli sur une SPA ni serveur applicatif.

Seul **`dist/client/`** est un artefact statique public. `dist/server/` et les autres intermédiaires de compilation ne doivent pas être hébergés sur Pages.

## Indexation

Le build par défaut est un aperçu : `noindex, nofollow` et `Disallow: /`. Pour construire localement le même export indexable que celui publié par le workflow :

```sh
SITE_PUBLIC=1 npm run build
python3 scripts/check-export.py --public
```

Cette commande construit uniquement en local ; elle ne publie rien. Les canonical et hreflang ciblent `https://wesper-dev.github.io/`. Refaire `npm run build` pour revenir à l’aperçu non indexable. Ne pas déployer accidentellement celui-ci.

## Arbre de l’accueil (lot 1c)

L’accueil (`/` et `/fr/`) commence par le bloc de l’arbre, `components/tree/TreeHero.tsx` (composant serveur) : la phrase BNP de FAITS §7, son lien (`caseLink` de `content/experiences.ts`) et un repli HTML (`TreeFallback.tsx` : chaque expérience et les compétences qu’elle allume) sont dans le HTML exporté et se lisent sans JavaScript. L’îlot client `TreeIsland.tsx` vérifie WebGL2 après l’affichage, crée la toile puis charge à la demande `lib/tree/scene.ts`, seul fichier du site qui importe `three` (0.187.0, épinglé). Les données de l’arbre sont construites dans un Worker module (`lib/tree/build.worker.ts`), avec retour au fil principal si le Worker échoue. En cas de problème (pas de WebGL2, module non chargé, perte de contexte, cadence sous 28 i/s sur 45 images, erreur), le bloc revient au repli HTML ; le repli de cadence est mémorisé pour la session (`sessionStorage['arbre:repli']`). Les états sont exposés sur `[data-tree-hero]` (`data-tree-state`, `data-tree-reason`, `data-tree-profile`) et par l’événement `arbre:state`. Les textes d’interface sont dans `content/tree-ui.ts`.

Paramètres d’adresse : `?ascii` (rendu en caractères, aussi la touche A) fonctionne partout. `?atelier` (panneau des palettes, fonds et croissance), `palette=`, `fond=halo|foret|ciel`, `croissance=simple|naturelle` et `graine=` ne sont pris en compte que dans l’aperçu : `vite.config.ts` définit `__TREE_ATELIER__` et `__TREE_DIAG__` à faux quand `SITE_PUBLIC=1`, et le code correspondant disparaît de l’export public. Dans l’aperçu seulement, `window.__arbre` renvoie un instantané figé du diagnostic de la scène (état, points dessinés, sève, étiquettes, mémoire GPU, libération).

Redimensionnement : la taille de la toile, l’angle de champ, le cadrage et le plafond du rapport de pixels (DPR, 1,5 sur téléphone, 2 sur ordinateur) sont réappliqués à chaque changement de taille ou de résolution de l’écran. Le profil (téléphone ou ordinateur, donc le nombre de points et la croissance) reste celui du premier écran, au montage : il n’y a pas de régénération de l’arbre au redimensionnement.

Poids : le budget tout compris additionne le gzip -9 de l’îlot, de la scène et de leurs modules partagés, et du Worker, moins ce que charge déjà `/projects/` et moins l’atelier ; plafond 230 000 octets (îlot seul : 8 000). `PORTFOLIO_AUDIT=1 npm run build` permet de recouper avec `work/client-modules.json`.

Le composant de preuve du lot 1a (`client-proof`) a été retiré : la page BNP rend sa carte dans un paragraphe ordinaire, et les garanties de chargement à la demande portent désormais sur l’îlot et la scène de l’arbre (tests C4 et D11, contrôle `check-export.py` : un module chargé par `import()` ne doit être atteint statiquement par aucune page, et un document HTML, alias et 404 compris, ne charge ou ne précharge que ce dont le framework et ses propres composants client ont besoin).

## Accueil dans la nouvelle direction artistique (lot 2a)

L’accueil passe à la nouvelle DA sombre au lot 2a ; les autres pages le rejoignent au lot 4 (section suivante).
« Papier d’atelier », l’ancienne DA claire, n’existe plus.

- **Structure** (`components/portfolio-home.tsx`) : une seule racine `<div data-home lang>` qui porte en style en ligne
  les jetons de la palette (`--night`, `--bg2`, `--ink`, `--muted`, `--accent`, `--warm`) ; puis le lien d’évitement,
  l’en-tête `[data-site-header]` (nom et titre dans le `<h1>`, lien CV toujours visible, navigation dans un menu natif
  `popover` à 760 px et moins, sans JavaScript), `<main id="main">` avec le bloc de l’arbre `[data-tree-hero]` puis les
  sections `[data-home-section]` (projets, hackathons, à propos, contact), et le pied `[data-site-footer]`. Dans le
  bloc : la phrase BNP et son lien d’abord (`[data-tree-copy]`), puis la scène, avec le repli dessiné et l’îlot. La
  liste des expériences et les fiches (`components/tree/TreeUi.tsx`) sont rendues côté serveur, masquées (`hidden`,
  `inert`) jusqu’à l’état `ready`. Les textes viennent de `content/cards.ts` (fiches, FAITS §1–§5),
  `content/home-ui.ts` et `content/tree-ui.ts` (libellés d’interface à valider par Arnaud). Le fond de `<html>` et de
  `<body>` passe par la variable `--home-bg` posée par l’accueil seul.
- **Polices** : Inter Tight (variable 300–500) et IBM Plex Mono (400), auto-hébergées dans `public/fonts/`
  (`inter-tight-latin.woff2`, `ibm-plex-mono-regular-latin1.woff2`, licences `intertight-OFL.txt` et `ibmplexmono-OFL.txt`,
  provenance et sous-ensemble dans `public/fonts/README.md`). L’accueil précharge ces deux fichiers, et eux seuls
  (`font-display: optional`, donc aucun décalage à l’arrivée des polices) ; ses mises en page racine
  (`app/(home)/layout.tsx`, `app/(home-fr)/layout.tsx`) ne préchargent rien d’autre. Depuis le lot 4, les autres pages
  préchargent les deux mêmes fichiers (`app/(en)/layout.tsx`, `app/fr/layout.tsx`) ; Bricolage Grotesque et Public Sans
  sont retirées du site.
- **Atelier des palettes** (aperçu seulement) : `/fr/?atelier` ou `/?atelier` ouvre le panneau (palettes, fonds Halo,
  Forêt, Ciel, croissance sur ordinateur, ASCII ; libellés dans `content/atelier.ts`). Un clic sur une palette recolore
  toute la page et l’inscrit dans l’adresse (`?atelier&palette=ardoise`) : la même adresse, rechargée ou ouverte sur un
  autre appareil, redonne la même palette. Rien de l’atelier n’existe dans l’export public.
- **Essai sur téléphone** : `npm run build` puis `npm run preview -- --lan`, sur le même Wi-Fi que le Mac ; ouvrir
  l’adresse réseau affichée, suivie de `/fr/?atelier`.
- **Choix de la palette** : `DEFAULT_PALETTE` vaut `foret` depuis le lot 4 (favorite provisoire). Pour en changer, modifier
  cette seule constante de `content/palettes.ts` (`sous-bois`, `ardoise` ou `foret`) : l’accueil et toutes les pages
  intérieures suivent. Reconstruire, relancer `npm test` (contrastes E10) et les contrôles d’export dans les deux modes,
  puis régénérer l’image de partage (`node scripts/share-image.mjs`, puis `npm run build`).

## Pages intérieures dans la nouvelle direction artistique (lot 4)

Projets, hackathons, compétences, les trois récits, les trois pages d’expérience et la 404 reprennent les jetons, les
polices, l’en-tête et le pied de l’accueil (`components/site-shell.tsx` : `SiteHeader` et `SiteFooter` servent aussi
l’accueil). Chaque page a une racine `<div data-site-page>` ; les jetons de la palette par défaut sont écrits sur `:root`
par un `<style>` de la page, avec `--home-bg` pour le fond de `<html>` et `<body>`. Toutes les règles de ces pages sont
dans `app/globals.css`, sous `[data-site-page]`, sans couleur littérale. Le texte des pages est celui de `a040fb0`
(`tests/q3-contenu.test.ts`). Les captures sur fond clair (droit-de-retard) sont posées dans un cadre aux couleurs de la
palette, sans filtre. `<meta name="theme-color">` vaut le fond de la palette sur toutes les pages.

**Images de partage** : `public/og-arbre-en.jpg` et `public/og-arbre-fr.jpg` (1200 × 630), une par langue,
capture de l’arbre de l’accueil de la langue avec, à gauche, le nom et le titre de l’en-tête (Inter Tight et IBM Plex
Mono, centrés sur la hauteur de l’arbre). Produites par `node scripts/share-image.mjs` depuis `site/` (palette et graine
par défaut, fond Halo, mouvement réduit, DPR 1, sans autre texte ni étiquette ; le script échoue sans les polices du
site et n’écrit qu’après les deux captures ; sert `dist/client` sur un port libre, jamais 4173 ; Playwright cherché dans
`LOT4_OUTILS`, `NODE_PATH` puis `../tmp/refonte-arbre/outils/node_modules`). Deux passages donnent les mêmes octets sur cette machine.

## Ajouter ou modifier du contenu

- `content/projects.json` : six fiches bilingues, rôle, statut, dépôt et éventuel récit. Les tags sont stockés dans chaque langue (`fr.tags`, `en.tags`) ; conserver les noms techniques et traduire les libellés éditoriaux. Les aperçus d’accueil consomment ces fiches.
- `content/hackathons.json` : événements, date connue, contexte/contribution/résultat FR/EN. `project` mène au récit local ; `link` est une destination publique facultative et explicitement libellée. Ne pas ajouter une source privée comme lien de navigation par défaut.
- `content/stories/{en,fr}/` : récits Markdown. Sous-ensemble pris en charge : titre `#`, sections `##`, paragraphes, listes de liens HTTPS et code en ligne. Aucun HTML brut. Modifier les deux langues ensemble.
- `content/skills.ts` : l'onglet Compétences. **Même liste que le CV** (`deliverables/cv/source/facts.py`, `SKILLS`) : la modifier des deux côtés à la fois, sinon le site et le CV se contredisent. Chaque entrée porte sa preuve et, quand elle existe, un lien vers la page ou le dépôt qui l'atteste ; pas de niveau affiché.
- `public/cv/` : les deux CV publics sans téléphone, français et anglais (`arnaud-durand-cv-platform-{fr,en}.pdf`, URL inchangées au lot 5, Q-R8). Depuis le lot 5, ils sont produits par la famille « public » de `deliverables/cv/source/familles.py` (titre « Ingénieur logiciel » / « Software Engineer », résumé, aucun logo) et diffèrent des CV de candidature. `deliverables/cv/source/build.sh` les régénère, les copie ici et dans `deliverables/cv/`, puis lance `verifier_cv.py` et `scripts/check_pdf_extraction.py`. Les tests `tests/t1-cv-pdf.test.ts` les lisent avec Poppler (`pdftotext`, `pdfinfo`, `pdfimages`), que la CI installe avant `npm test`.
- `content/home.ts` : présentation, parcours, engagements et libellés. `content/indexes.json` : introductions des index.
- `components/` : présentation ; les quatre composants de page partagent navigation, contact et pied de page via `site-shell.tsx`.
- `lib/metadata.ts` : métadonnées par route. `public/og-arbre-en.jpg` et `public/og-arbre-fr.jpg` : images de partage par défaut, une par langue (voir plus haut) ; `public/images/droit-de-retard-social.jpg` est la carte 1200 × 630 du récit Droit de Retard. La capture complète reste affichée dans la page.
- `public/fonts/` : polices WOFF2 auto-hébergées, sources et licences SIL OFL.

Modèle de fiche projet : identifiant stable, nom, date réellement connue (ou null), dépôt, statut, contribution personnelle, résumé FR/EN, tags, crédits et liens publics. Garder la preuve et son niveau de vérification dans le dossier privé de travail, puis copier uniquement les faits sélectionnés. Ne pas transformer une hypothèse en fait.

Pour un nouveau récit, créer les deux Markdown, les importer dans `lib/stories.ts`, ajouter ses deux fichiers de route et son chemin dans `content/routes.json`. Les pages de détail des expériences sont des routes dynamiques (`app/(en)/experiences/[slug]/`, `app/fr/experiences/[slug]/`) alimentées par `content/experiences.ts` : ajouter l'entrée de données et son chemin au manifeste. Le manifeste explicite rend le périmètre de publication facile à examiner.

## Ressources et maintenance

La capture Droit de Retard provient du dépôt public, chemin `docs/images/interface.png`, relevée le 12 septembre 2026. Légende, crédit et accès à l’original sont affichés. Ses dimensions réelles sont fixées ; les images du récit sont chargées à la demande. Pas de photographie tierce ni capture inventée. La carte de partage typographique n’est chargée que par les lecteurs de métadonnées, pas dans les pages.

`PORTFOLIO_AUDIT=1 npm run build` écrit l’inventaire des modules client dans `work/client-modules.json`, jamais dans l’export. Les dépendances et le lockfile sont conservés ; React 19.2.8 corrige l’avis Server Functions identifié. Réexaminer l’audit npm avant toute évolution vers un serveur ou traitement d’entrées arbitraires.

Le contrôle accepte `--private-patterns /chemin/vers/liste.json` pour ajouter une liste privée de motifs interdits. Cette liste reste hors des sources publiques.

## Publication et restauration

Le workflow `.github/workflows/pages.yml` construit et contrôle chaque pull request vers `main`. Un push sur `main` ou un lancement manuel depuis cette branche publie uniquement `dist/client/`, après validation du build. Les actions officielles sont épinglées par commit ; leurs versions sont indiquées en commentaire. Le dépôt utilise GitHub Pages avec GitHub Actions comme source.

Pour une mise à jour : modifier les données FR/EN, ouvrir une branche et une pull request, examiner les contrôles et l’aperçu local, puis fusionner après validation. Pour reproduire le contrôle public en local :

```sh
npm ci --ignore-scripts
SITE_PUBLIC=1 npm run build
npm test
npx tsc --noEmit
python3 scripts/check-export.py --public
```

En cas de régression, annuler le commit concerné avec `git revert` et pousser sur `main` : le workflow reconstruit la version restaurée. Ne pas réécrire l’historique avec un force push. Pour interrompre complètement la diffusion, désactiver Pages dans les paramètres du dépôt.

Les données de carrière privées, CV et intermédiaires de build restent exclus du dépôt. Aucun secret n’est nécessaire au site statique.

## Exemple : ajouter un hackathon

Ajouter un objet à `content/hackathons.json` sans modifier les composants, en reprenant le schéma ci-dessous. Remplacer les exemples par des faits vérifiés ; laisser `date` à `null` si elle est inconnue. `project` doit être un identifiant de récit existant ou `null`. `link` est un lien public facultatif, jamais une pièce privée.

```json
{
  "id": "example-event",
  "name": "Nom de l’événement",
  "date": null,
  "project": null,
  "fr": {
    "context": "Sujet exploré",
    "contribution": "Contribution personnelle vérifiée",
    "outcome": "Résultat et limites"
  },
  "en": {
    "context": "Topic explored",
    "contribution": "Verified personal contribution",
    "outcome": "Result and limitations"
  },
  "link": null
}
```

Pour les projets, partir d’une fiche existante dans `content/projects.json` : conserver `role`, `status`, `summary` et `tags` dans les deux langues, créditer l’origine collective et utiliser `year: null` lorsque l’année est inconnue. Les dates ne doivent pas être déduites d’un intitulé ou inventées.

Pour une nouvelle image : conserver l’original hors de l’export, dimensionner pour l’usage réel, choisir JPEG/WebP pour une photographie ou capture adaptée et vérifier visuellement la compression. La carte générale de partage reste en 1200 × 630 et sous 300 ko ; reporter tout changement de nom/dimensions dans `lib/metadata.ts`. Renseigner l’alternative textuelle et le crédit avant de publier.

## HTTPS et en-têtes de sécurité

HTTPS est activé sur GitHub Pages. Au relevé du 14 septembre 2026, les réponses du site ne portent pas les en-têtes HTTP `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` ni `X-Frame-Options` ; `Access-Control-Allow-Origin: *` est émis par la plateforme. Ces en-têtes de réponse ne sont pas configurables depuis les fichiers de ce dépôt : un contrôle complet demanderait un proxy/CDN configurable ou un autre hébergement. Voir [HTTPS sur Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https) et la [demande de prise en charge des en-têtes](https://github.com/orgs/community/discussions/54257).

Le contenu est statique et public, sans authentification, formulaire de saisie ni script tiers ; CORS ne donne ici accès qu’aux fichiers déjà publics. Cette architecture réduit l’exposition, sans constituer une garantie générale de sécurité. Aucun changement d’hébergement n’est prévu pour ce seul motif. Certaines protections, dont une partie de CSP, peuvent aussi être définies en HTML avec leurs limites ; une [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) devra être conçue et testée avec les scripts du site avant ajout. Cette note documente les limites observées, elle ne remplace pas la maintenance des dépendances.
