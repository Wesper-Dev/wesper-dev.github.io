# Arnaud Durand — portfolio

Portfolio FR/EN « Papier d’atelier », publié sur GitHub Pages : https://wesper-dev.github.io/ (français : /fr/). Six projets, sept événements et trois récits par langue. Le workflow contrôle les pull requests et déploie les versions de main après un build réussi.

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

Aperçu : http://127.0.0.1:4173/fr/ et http://127.0.0.1:4173/. Le serveur statique local gère aussi la 404 et les redirections vers les répertoires. Arrêt avec Ctrl-C.

## Routes et export

Chaque langue possède un accueil, `/projects/`, `/hackathons/` et les récits `/projects/droit-de-retard/`, `/projects/diary/`, `/projects/croix-rouge/`. Les chemins français sont préfixés `/fr/`.

Vinext exporte des fichiers `.html` sans slash terminal. `scripts/normalize-export.mjs` crée un vrai `index.html` pour chaque répertoire. `/missing` sert de source technique à la `404.html` bilingue ; cette page n’est pas dans le sitemap. Le navigateur peut ouvrir chaque route directement, sans repli sur une SPA ni serveur applicatif.

Seul **`dist/client/`** est un artefact statique public. `dist/server/` et les autres intermédiaires de compilation ne doivent pas être hébergés sur Pages.

## Indexation

Le build par défaut est un aperçu : `noindex, nofollow` et `Disallow: /`. Pour construire localement le même export indexable que celui publié par le workflow :

```sh
SITE_PUBLIC=1 npm run build
python3 scripts/check-export.py --public
```

Cette commande construit uniquement en local ; elle ne publie rien. Les canonical et hreflang ciblent `https://wesper-dev.github.io/`. Refaire `npm run build` pour revenir à l’aperçu non indexable. Ne pas déployer accidentellement celui-ci.

## Ajouter ou modifier du contenu

- `content/projects.json` : six fiches bilingues, rôle, statut, dépôt et éventuel récit. Les tags sont stockés dans chaque langue (`fr.tags`, `en.tags`) ; conserver les noms techniques et traduire les libellés éditoriaux. Les aperçus d’accueil consomment ces fiches.
- `content/hackathons.json` : événements, date connue, contexte/contribution/résultat FR/EN. `project` mène au récit local ; `link` est une destination publique facultative et explicitement libellée. Ne pas ajouter une source privée comme lien de navigation par défaut.
- `content/stories/{en,fr}/` : récits Markdown. Sous-ensemble pris en charge : titre `#`, sections `##`, paragraphes, listes de liens HTTPS et code en ligne. Aucun HTML brut. Modifier les deux langues ensemble.
- `content/home.ts` : présentation, parcours, engagements et libellés. `content/indexes.json` : introductions des index.
- `components/` : présentation ; les quatre composants de page partagent navigation, contact et pied de page via `site-shell.tsx`.
- `lib/metadata.ts` : métadonnées par route. `public/og.jpg` : carte typographique générale ; `public/images/droit-de-retard-social.jpg` est la carte 1200 × 630 du récit Droit de Retard. La capture complète reste affichée dans la page.
- `public/fonts/` : polices WOFF2 auto-hébergées, sources et licences SIL OFL.

Modèle de fiche projet : identifiant stable, nom, date réellement connue (ou null), dépôt, statut, contribution personnelle, résumé FR/EN, tags, crédits et liens publics. Garder la preuve et son niveau de vérification dans le dossier privé de travail, puis copier uniquement les faits sélectionnés. Ne pas transformer une hypothèse en fait.

Pour un nouveau récit, créer les deux Markdown, les importer dans `lib/stories.ts`, ajouter ses deux fichiers de route et mettre à jour la liste des routes de `normalize-export.mjs` et `check-export.py`. Les routes explicites actuelles rendent le périmètre de publication facile à examiner.

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
