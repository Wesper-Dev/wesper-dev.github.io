# Diary / Kura — suivre le chemin d’un enregistrement

Un journal vocal, depuis le navigateur jusqu’aux rapports hebdomadaires.

## Deux hackathons, puis une continuation

Kura est un projet collectif de journal audio, développé au Google Cloud Partner Agentic AI Hackathon puis au One-Person Unicorn Vibe-a-thon à STATION F. Diary est ma continuation personnelle : approfondir le chemin entre l’enregistrement, le traitement audio, le stockage et les rapports.

## Relier les étapes

L’interface React et TypeScript enregistre la voix avec MediaRecorder au format WebM/Opus. Le backend FastAPI reçoit les fichiers ; FFmpeg les convertit en WAV mono à 16 kHz. Google Cloud Storage organise ensuite les enregistrements par utilisateur et par semaine.

Mon travail présenté ici porte sur cette intégration : faire circuler des données cohérentes entre les composants, du format produit par le navigateur à celui attendu pour le traitement, puis retrouver les enregistrements dans les rapports.

## Un choix d’analyse explicite

Le prototype transmet le choix d’analyse au backend par un en-tête d’opt-in conditionnel. Les rapports hebdomadaires disposent d’un export HTML. Le dépôt documente le lancement avec Docker Compose et une procédure de construction ARM64 pour Raspberry Pi 4.

## Résultat et limites

Diary reste une preuve de concept avec stockage cloud. La documentation distingue les données simulées des traitements réels ; l’identification locale sert à la démonstration. L’opt-in ne constitue pas une validation de conformité, et les rapports ne sont pas validés cliniquement. La procédure Raspberry Pi documente un chemin de déploiement, sans benchmark ni exploitation continue revendiqués.

## Liens et crédits

- [Dépôt Diary et instructions](https://github.com/Wesper-Dev/Diary)

Kura a été construit en équipe ; Diary en prolonge un périmètre personnel.
