# LinAlg-Übungsstunde

Interaktive Anwendungen zur linearen Algebra, gedacht für die Demonstration am Beamer.

| Anwendung | Thema |
|---|---|
| Foto: Crop, Pan & Zoom | Lineare Abbildungen auf einem Bild |
| Neuronale Netzwerke | Handschrifterkennung als Matrix-Vektor-Produkte |
| GPS | Position aus Abständen zu Satelliten (3D) |
| Robotik: Transformationen | Transformationsketten eines Roboterarms |
| Massenfluss | Bilanzgleichungen in einem Rohrnetz |
| LR-Zerlegung: Federn | Zwei Federn unter Last, gelöst über A = L·R |
| Basiswechsel | Ein Vektor in der Standardbasis ε und in einer eigenen Basis B |

## Starten

1. Projekt holen: `git clone` oder auf GitHub **Code → Download ZIP** und die ZIP-Datei entpacken.
2. **`index.html` doppelklicken.**

Das funktioniert auf macOS und Windows in Chrome, Edge, Firefox und Safari. Es braucht keine Installation und kein Internet.

## Online über GitHub Pages

Damit die App ohne Herunterladen über einen Link läuft:

1. Auf GitHub im Repository **Settings → Pages** öffnen.
2. Bei **Source** «Deploy from a branch» wählen, Branch `main`, Ordner `/ (root)`, speichern.
3. Nach etwa einer Minute ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar.

Für private Repositories ist GitHub Pages nur mit einem kostenpflichtigen GitHub-Konto verfügbar.

## Optional: lokaler Server

Nicht nötig, aber möglich, falls Python installiert ist. Im Projektordner:

- macOS: `python3 -m http.server 8765`
- Windows: `py -m http.server 8765`

Danach im Browser `http://127.0.0.1:8765/` öffnen. Beenden mit Ctrl + C.

## Gut zu wissen

- **Einstellungen** (Regler, Nightmode, zuletzt gewählte Anwendung) speichert der Browser lokal. Doppelklick, lokaler Server und GitHub Pages gelten dabei als verschiedene Orte und haben je eigene Einstellungen. Jede Anwendung hat einen Knopf **Zurücksetzen**.
- **Vollbild am Beamer:** Windows F11, macOS Ctrl + Cmd + F.

## Aufbau

```
index.html          Seite mit allen Anwendungen
mass-flow.js        Massenfluss
lr-building.js      LR-Zerlegung: Federn
basis-change.js     Basiswechsel
vendor/three/       three.js r164 (MIT-Lizenz) für die 3D-Ansicht, siehe vendor/three/README.md
```

## Lizenz

MIT-Lizenz, © 2026 Martin Maligec, siehe [LICENSE](LICENSE). Der Code darf frei heruntergeladen, verwendet, verändert und weitergegeben werden, solange der Lizenzhinweis erhalten bleibt.

three.js im Ordner `vendor/three/` steht unter der MIT-Lizenz der Three.js Authors.
