# Polices locales

Deux polices pour tout le site depuis le 24 novembre 2026 : Inter Tight et IBM Plex Mono, licences SIL OFL 1.1
incluses. Bricolage Grotesque et Public Sans, polices de l'ancienne direction artistique, sont retirées (fichiers,
licences, `@font-face` et préchargements).

## Inter Tight et IBM Plex Mono

Inter Tight : téléchargée le 20 novembre 2026 depuis le dépôt `google/fonts` (TTF complet, licence SIL OFL 1.1), puis
réduite avec fontTools 4.55.3 (hors dépendances du site). Ces deux polices servent toutes les pages.

- `inter-tight-latin.woff2` (28 712 octets) : Inter Tight variable, axe `wght` limité à **300–500**
  (`fonttools varLib.instancer wght=300:500`). Origine :
  https://raw.githubusercontent.com/google/fonts/main/ofl/intertight/InterTight%5Bwght%5D.ttf
  (SHA-256 du TTF : `b81b73dcb64df3c230cabade7df6c5773bf863233f24c9ee51087519f1f88b6f`).
- `ibm-plex-mono-regular-latin1.woff2` (17 544 octets) : fichier **officiel d'IBM, non modifié**, du paquet npm
  `@ibm/plex-mono@2.5.0` (`npm pack @ibm/plex-mono@2.5.0`, chemin `fonts/split/woff2/IBMPlexMono-Regular-Latin1.woff2`,
  dépôt https://github.com/IBM/plex), graisse **400**, SHA-256
  `e8993d946649b9d01abb1ed06d574b19d8ea3e66b5c3948602db335c44c18e56`. Son `unicode-range` est celui du CSS officiel
  d'IBM (`IBMPlexMono-Regular.css`, sous-ensemble Latin1). Il n'a ni « → » ni « ↗ » : aucun texte rendu en Plex Mono
  n'en contient (les flèches sont en Inter Tight). Licence : `ibmplexmono-OFL.txt`, copie du `LICENSE.txt` du paquet
  (SIL OFL 1.1, nom réservé « Plex », d'où l'interdiction de livrer un sous-ensemble refait par nous).
- Licence d'Inter Tight : `intertight-OFL.txt` (https://raw.githubusercontent.com/google/fonts/main/ofl/intertight/OFL.txt).
  Elle ne déclare **aucun nom réservé** (« Reserved Font Name ») : le sous-ensemble d'Inter Tight fabriqué ici est permis
  par l'OFL et garde son nom.

Sous-ensemble d'Inter Tight seul (`pyftsubset --unicodes=… --layout-features=kern,liga,calt,ccmp,locl,mark,mkmk,tnum,case
--flavor=woff2 --no-hinting`) : `U+0020-007E, U+00A0-00FF, U+0131, U+0152-0153, U+02BC, U+02C6, U+02DA, U+02DC,
U+2009-200A, U+2010-2014, U+2018-201A, U+201C-201E, U+2022, U+2026, U+202F, U+2039-203A, U+20AC, U+2122, U+2190-2193,
U+2197, U+2212` (latin, latin-1, ponctuation française, « → », « ↗ », « ↑ », « € »). Les deux fichiers sont préchargés par chaque page (`font-display: optional`) ; leur somme, 46 256 octets, est le budget
de polices du site.
