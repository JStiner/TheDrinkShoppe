
# The Drink Shoppe 🍹

A tablet-friendly drink menu for our **Ninja Thirsti kitchen bar**.

This project generates drink combinations using selectable bases and syrups.  
It is designed to run **offline on a tablet** and can be installed like an app using a PWA.

Live site:

https://jstiner.github.io/TheDrinkShoppe

---

# Features

• Base + syrup drink generator  
• Favorites toggle  
• Hide drinks you don't like  
• Syrup filtering  
• Lotus drink filter  
• Tablet‑optimized interface  
• Offline capable  
• Local Admin menu editor  

---

# How to Use

1. Select a **Base**
2. Optionally filter by **Flavor**
3. Select **Syrups**
4. Mark drinks as **Favorites**
5. Hide drinks you don't want to see

Drinks will automatically generate based on your selections.

---

# Admin Menu

The **Admin** button opens the menu editor.

You can:

• Add new syrups  
• Add new bases  
• Toggle items on/off  
• Edit vibe words used in drink names  

Changes are stored locally on the device.

---

# File Structure

```
index.html      Main drink menu UI
admin.html      Admin settings page
app.js          Drink generator logic
admin.js        Admin editor logic
menu.json       Default menu configuration
manifest.json   PWA install configuration
sw.js           Offline service worker
icons/          App icons
```

---

# Editing the Menu

Default drink data is stored in:

```
menu.json
```

You can either edit that file manually or use the **Admin page** in the app.

---

# Install on a Tablet (Offline Mode)

1. Open the site in Chrome
2. Tap **Add to Home Screen**
3. Launch it like a normal app

After the first load the menu will work **without internet.**

---

# Project Goal

This is a fun home project to build a **digital drink menu for our kitchen Drink Shoppe** so anyone in the house can quickly mix new Ninja Thirsti drinks.

---

# Future Ideas

• Random drink button  
• Drink photos  
• Sync favorites across devices  
• Voice ordering for kids 😄
