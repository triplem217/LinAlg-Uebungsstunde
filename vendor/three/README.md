# three.js r164

Quelle: <https://github.com/mrdoob/three.js> (MIT-Lizenz, Copyright 2010–2024 Three.js Authors).

Die Dateien sind **klassische Skripte** statt ES-Module, damit `index.html` auch per Doppelklick (`file://`) startet. Browser blockieren ES-Module, die direkt von der Festplatte geladen werden.

| Datei | Original | Änderung |
|---|---|---|
| `three.global.js` | `build/three.module.js` | in eine Funktion eingeschlossen, `export { … }` durch `window.THREE = { … }` ersetzt |
| `addons/controls/OrbitControls.global.js` | `examples/jsm/controls/OrbitControls.js` | Import aus `window.THREE`, Export als `window.THREE.OrbitControls` |

Sonst ist der Code unverändert. Bei einem Update dieselben zwei Änderungen an den neuen Originaldateien vornehmen.
