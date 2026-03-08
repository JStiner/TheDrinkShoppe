This fixes two problems:
1. Admin button now opens admin.html directly via inline onclick.
2. app.js validates and auto-recovers from broken old localStorage menu overrides.

Replace these repo files:
- index.html
- admin.html
- app.js
- admin.js
- menu.json
- manifest.json
- sw.js
- icons/icon-192.png
- icons/icon-512.png

After upload, hard refresh or open in an incognito tab.
If the page still looks broken, clear site data for your GitHub Pages URL once.