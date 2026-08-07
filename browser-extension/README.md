# 2FŨKOI — Silence pendant la dictée

Petite extension Chrome qui **coupe le son des autres onglets pendant que la
dictée vocale de 2FŨKOI écoute**, et le rétablit dès qu'elle s'arrête.

## Pourquoi une extension et pas du code dans l'app

Une page web ne peut pas agir sur un autre onglet : c'est une frontière du bac
à sable du navigateur, sans exception. Seule une extension a accès à
`chrome.tabs` (et donc à `{ muted: true }`). L'app se contente d'émettre un
`window.postMessage` à chaque début/fin d'écoute ; sans extension installée,
ce message ne fait rien du tout.

## Installation (une seule fois)

1. Chrome → `chrome://extensions`
2. Activer **Mode développeur** (interrupteur en haut à droite)
3. **Charger l'extension non empaquetée** → choisir ce dossier
   (`browser-extension/`)

C'est tout — aucun identifiant à recopier dans l'app. Le lien se fait par un
content script injecté sur `todo.hugues.app` (et `localhost` pour le dev), pas
par l'ID de l'extension, qui change à chaque réinstallation.

## Ce qu'elle fait exactement

- Au démarrage de l'écoute : coupe **les onglets qui émettent réellement du
  son** (`audible: true`) et qui ne sont **pas déjà coupés à la main**
  (`muted: false`), sauf l'onglet 2FŨKOI lui-même.
- À l'arrêt : rétablit **uniquement** ces onglets-là. Un onglet que tu avais
  coupé toi-même avant reste coupé.
- Délai de 700 ms avant de rétablir : passer du titre aux notes puis à une
  sous-tâche enchaîne un arrêt et un démarrage immédiats, sans ça la musique
  repartirait une demi-seconde entre chaque champ.
- Filets de sécurité, pour ne jamais laisser un onglet muet orphelin :
  rétablissement automatique après 5 min (`chrome.alarms`), sur `pagehide` de
  l'onglet 2FŨKOI, et au démarrage du navigateur.

## Limite connue

Ça ne couvre que **les onglets de ce navigateur**. Couper Spotify, une autre
app, ou le volume système est hors de portée d'une extension — il faudrait un
utilitaire natif macOS (Hammerspoon, Keyboard Maestro, BetterTouchTool…)
déclenché autrement.
