# Droit de Retard — garder les décisions explicites

Un prototype local-first qui prépare un brouillon de réclamation aérienne à partir de documents de voyage.

## Le problème

Un billet ne suffit pas à raconter un trajet perturbé. Il faut retrouver les informations utiles, demander ce qui manque et comprendre ce que les documents permettent réellement d’établir. Le projet explore cette chaîne : lire une pièce, construire un dossier et préparer une réponse, tout en gardant visibles les étapes du raisonnement logiciel.

## Une idée collective, puis une continuation personnelle

Droit de Retard prolonge un projet réalisé en équipe au Paris Gemma 4 Hackathon. Le dépôt d’origine et la vidéo de soumission documentent ce travail collectif. La version présentée ici est ma continuation personnelle, centrée sur la validation des appels d’outils, les tests de régression et les contrôles d’intégration continue.

## Ce que fait le modèle, ce que fait le code

Gemma intervient dans la lecture du document et la rédaction. Les règles de qualification et les calculs restent en Python. Pour les outils, le programme utilise une liste autorisée et recalcule les arguments attendus avant d’accepter une demande du modèle. Un appel absent ou rejeté peut déclencher un chemin de repli explicite.

La recherche de sources et la disponibilité du réseau sont également prises en compte. La trace expose les étapes et les éventuels modes dégradés. « Local-first » décrit cette organisation autour de l’exécution locale ; cela ne signifie pas que toute fonction du projet ignore le réseau, puisque la recherche de sources peut l’utiliser.

## Vérifier un périmètre concret

Les tests de régression rendent les comportements attendus inspectables. Le dépôt contient une documentation d’évaluation, des commandes de reproduction et des exemples de sortie. Je préfère renvoyer à cette évaluation versionnée plutôt que figer un nombre de tests dans ce récit : le périmètre peut évoluer avec le code.

## Où en est le projet ?

Il s’agit d’un prototype informatif, pas d’un service de représentation des passagers. Une lettre générée ne garantit aucune indemnisation. La capture montre une interface de démonstration ; elle ne constitue pas une mesure de performance ni la preuve d’un déploiement en production.

Ce projet relie mon intérêt pour l’IA à mon socle systèmes : rendre les transitions, les validations et les erreurs assez explicites pour pouvoir les examiner.

## Liens et crédits

- [Dépôt personnel](https://github.com/Wesper-Dev/droit-de-retard)
- [Projet collectif d’origine](https://github.com/Claken/Paris-Gemma-4-Hackaton)
- [Évaluation documentée](https://github.com/Wesper-Dev/droit-de-retard/blob/main/docs/EVALUATION.md)
- [Vidéo de l’équipe](https://www.youtube.com/watch?v=tOn7xXNZ6s0)

Le dépôt conserve l’historique du travail collectif et des contributions assistées par des outils IA.
