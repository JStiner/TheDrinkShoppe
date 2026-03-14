
<p align="center">
  <img src="Logo/brand-preview.png" alt="The Drink Shoppe Logo" width="500">
</p>

<h1 align="center">The Drink Shoppe 🍹</h1>

<p align="center">
A tablet-friendly drink generator for Ninja Thirsti using Torani syrups and Lotus energy concentrates.
</p>

<p align="center">
  <a href="https://jstiner.github.io/TheDrinkShoppe">Live Demo</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Hosted-GitHub%20Pages-blue">
  <img src="https://img.shields.io/badge/App-PWA-green">
  <img src="https://img.shields.io/badge/Platform-Tablet%20Friendly-orange">
</p>

---

A tablet-friendly drink menu for our **Ninja Thirsti kitchen bar**.

This project generates drink combinations using selectable bases and syrups.  
It is designed to run **offline on a tablet** and can be installed like an app using a **Progressive Web App (PWA)**.

Live site:

https://jstiner.github.io/TheDrinkShoppe

---

# Features

• Base + syrup drink generator  
• Favorites toggle  
• Hide drinks you don't like  
• Syrup filtering  
• Lotus drink filter  
• Tablet-optimized interface  
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

# Syrups Used

The Drink Shoppe is designed around **Torani flavored syrups**.

Torani syrups are widely available and come in both **regular and sugar-free varieties**, making them ideal for experimenting with a large range of drink combinations.

They can typically be found at:

- Amazon  
- Walmart  
- Target  
- Restaurant supply stores  
- Coffee shop suppliers  

Because Torani has a very large flavor catalog, new flavors can easily be added to the drink generator by updating `menu.json` or using the **Admin menu editor**.

Other syrup brands may work as well, but Torani was the primary reference used when designing the flavor tags and combinations.

---

# Lotus Energy Concentrates

The Drink Shoppe also supports **Lotus Plant Power energy concentrates**, which can be added to drinks for a plant-based energy boost.

Lotus concentrates are commonly used in coffee stands and specialty drink shops to create customizable energy drinks by combining the concentrate with flavored syrups and carbonated bases.

You can view the available concentrates here:

https://lotusplantpower.com/collections/lotus-energy-concentrates

Common Lotus flavors include:

• White Lotus – neutral flavor that mixes with almost anything  
• Pink Lotus – tart cherry and raspberry profile  
• Blue Lotus – blueberry and açaí profile  
• Purple Lotus – elderberry and dark berry profile  
• Red Lotus – cherry-forward energy base  
• Gold Lotus – coffee fruit / cascara based blend  

In **The Drink Shoppe**, Lotus options can be enabled or disabled through the **Admin menu**, allowing different drink combinations to be generated based on the selected Lotus flavor.

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

# Screenshots

Example drink builder interface running on a kitchen tablet.

```
docs/screenshot.png
```

(Add a screenshot later to improve repo visibility.)

---

# Project Goal

This is a fun home project to build a **digital drink menu for our kitchen Drink Shoppe** so anyone in the house can quickly mix new Ninja Thirsti drinks.

---

# Future Ideas

• Random drink button  
• Drink photos  
• Sync favorites across devices  
• Voice ordering for kids 😄

---

# Keywords

ninja thirsti drinks  
ninja thirsti recipes  
torani syrup drink ideas  
lotus energy drink recipes  
drink generator app  
tablet drink menu  
home soda bar  
