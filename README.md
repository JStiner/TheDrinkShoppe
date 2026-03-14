# The Drink Shoppe 🍹

A tablet-friendly drink builder for our **Ninja Thirsti kitchen bar**.

The app generates drink combinations from selectable bases and syrups
and runs entirely **client-side in the browser**. It can be installed on
a tablet like an app using a **Progressive Web App (PWA)**.

Live site:

https://jstiner.github.io/TheDrinkShoppe

------------------------------------------------------------------------

# Features

• Drink generator using **bases + syrups**\
• **Up to 3 syrup selections** using chip controls\
• **Favorites toggle** to quickly show saved drinks\
• **Save My Drink** to store custom favorites\
• Ability to **hide drinks** you don't want displayed\
• **Lotus energy drink toggle**\
• **Tablet-optimized interface**\
• **Offline support (PWA)**\
• **Local Admin menu editor**

All preferences and saved drinks are stored using **localStorage** so
the app works without a backend.

------------------------------------------------------------------------

# How the Drink Builder Works

1.  Select a **Base**
2.  Optionally enable **Lotus**
3.  Select up to **3 Syrups**
4.  Drinks that match your syrup selections are **pinned to the top**
5.  Use **Save My Drink** to store favorites
6.  Toggle **Favorites** to view only your saved drinks

Drink names are generated using **vibe words + base name**.

Example:

    🥤 Tropical Sprite
    🍹 Sunset + Island Red Bull
    🍹 Cosmic + Electric + Sunset Lemonade ⚡

------------------------------------------------------------------------

# Saved Drinks

The **Save My Drink** feature lets you store custom combinations.

Saved drinks:

• Only appear when the **Favorites toggle is ON**\
• Can be **removed from the favorites list**\
• Persist on the device using **localStorage**

This allows each tablet to maintain its own favorite drinks.

------------------------------------------------------------------------

# Admin Menu

The **Admin** button opens a local menu editor.

From the admin page you can:

• Add new **bases**\
• Add new **syrups**\
• Enable / disable menu items\
• Edit **vibe words** used in drink names

Changes are stored in **localStorage** so you can customize the menu
without editing code.

If invalid menu data is detected, the app **automatically falls back to
the default `menu.json`**.

------------------------------------------------------------------------

# File Structure

    index.html      Main drink menu interface
    admin.html      Admin configuration page

    app.js          Drink generator logic
    admin.js        Menu editor logic

    menu.json       Default menu configuration
    recipes.json    Optional recipe presets

    manifest.json   PWA install configuration
    sw.js           Offline service worker

    Icons/          PWA icons

------------------------------------------------------------------------

# Editing the Menu

The default drink menu is defined in:

    menu.json

You can modify this file directly or use the **Admin page** in the app.

Local edits override the default menu using **localStorage**.

------------------------------------------------------------------------

# Install on a Tablet (Offline Mode)

1.  Open the site in Chrome or Edge
2.  Tap **Add to Home Screen**
3.  Launch it like a normal app

After the first load the Drink Shoppe works **fully offline**.

------------------------------------------------------------------------

# Tech Stack

The Drink Shoppe runs completely client-side:

• HTML\
• JavaScript\
• JSON configuration\
• localStorage persistence\
• Service Worker for offline support\
• GitHub Pages hosting

No server or database required.

------------------------------------------------------------------------

# Project Goal

This project is a fun home build to create a **digital drink menu for
our kitchen Drink Shoppe** so anyone in the house can quickly create new
Ninja Thirsti drinks.

------------------------------------------------------------------------

# Future Ideas

• Random drink button\
• Drink photos\
• Cloud sync for favorites\
• Multi-tablet menu sync\
• Party mode drink generator\
• Kid-friendly UI mode
