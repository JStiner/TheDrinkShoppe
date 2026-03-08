The Drink Shoppe Editable App Package

Files:
- index.html      Layout and styles only
- app.js          App logic
- menu.json       Editable bases, categories, columns, and syrups
- recipes.json    Editable featured drink presets
- manifest.json   PWA manifest
- sw.js           Service worker
- icons/          App icons

How to edit:
1. Open menu.json
   - Change syrup order
   - Add/remove syrups
   - Add/remove bases
   - Rename labels
   - Change column titles/categories

2. Open recipes.json
   - Add or remove featured preset recipes

Notes:
- This package is offline-safe and has no external calls.
- If you package it into an Android app, these JSON files will be bundled into the app.
- To change menu data later, replace the JSON files and rebuild/repackage the app, unless your app builder supports external/updatable assets.