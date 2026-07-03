<p align="center">
  <img src="assets/icon.png" width="112" alt="MyScreenPets app icon">
</p>

# MyScreenPets

<p>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-32.0-47848F?style=flat-square&logo=electron&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js&logoColor=white">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Sonoma+-000000?style=flat-square&logo=apple&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-374151?style=flat-square">
</p>

**MyScreenPets** is a desktop companion application for macOS built with Electron. Choose your favorite animated pets (like Pokémon) to roam freely on your screen, keep you company while you work, and react to your mouse cursor without interrupting your workflow.

## Available for macOS

<table>
  <tr>
    <td width="96">
      <img src="assets/icon.png" width="72" alt="MyScreenPets">
    </td>
    <td>
      <strong>MyScreenPets</strong><br>
      Interactive desktop pets right on your screen. Fully transparent click-through windows, smart boundary bouncing, and fun cursor interactions.<br><br>
      <a href="https://github.com/GreyPikachu/MyScreenPets/releases">
        <img src="https://img.shields.io/badge/Download_for_macOS-000000?style=for-the-badge&logo=apple&logoColor=white" height="32" alt="Download for macOS">
      </a>
    </td>
  </tr>
</table>

## Showcase

<p align="center">
  <img src="assets/videos/selection.gif" width="72%" alt="Pet Selection">
</p>
<br>
<p align="center">
  <img src="assets/videos/editing.gif" width="48%" alt="Pet Customization">
  &nbsp;
  <img src="assets/videos/interaction.gif" width="48%" alt="Pet Interaction">
</p>

## What's Inside

**Multiple Characters**

- Choose from built-in characters (Pikachu, Gengar, Rayquaza, etc.).
- Easily add your own: just drag and drop any `.gif` file into the app.
- Built-in script to download a massive database (1600+ animated Pokémon sprites).

**Deep Customization**

- **Size & Opacity:** Make your characters giant or turn them into semi-transparent ghosts.
- **Movement Styles:** Choose how they move (bouncing, sliding, or free-flying).
- **Trails:** Add beautiful particle effects (stars, hearts, music notes) that follow your pet.

**Interactivity**

- Smart cursor interaction: pets can look at your mouse, run away from it, or ignore it.
- Feeding system: right-click anywhere on the screen to drop food, and your pets will rush to eat it!
- Perfect edge bouncing tailored for macOS window boundaries and the menu bar.

**Technical Features**

- Transparent click-through windows (mouse events pass through empty space).
- Optimized rendering via Electron IPC and native macOS API calls.
- Runs above all windows without stealing focus, so you can keep working undisturbed.

## Tech Stack

<div align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white">
  <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white">
</div>

## Architecture Overview

```mermaid
flowchart LR
    App["Electron Main (index.js)"] --> IPC["IPC Communication"]
    IPC --> PetWindow["Pet Window (renderer.js)"]
    IPC --> MenuWindow["Settings Menu (menu.html)"]
    PetWindow --> Engine["Sprite Engine (sprite-engine.js)"]
    PetWindow --> Movement["Movement Logic (movement.js)"]
    Engine --> Screen["Mac Desktop"]
    Movement --> Boundaries["Screen Boundaries"]
```

## Getting Started (For Developers)

1. Clone the repository:
   ```bash
   git clone https://github.com/GreyPikachu/MyScreenPets.git
   ```
2. Navigate to the project directory:
   ```bash
   cd MyScreenPets
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the app:
   ```bash
   npm start
   ```
   *(You can also build a native `.dmg` for macOS by running `npm run build:mac`)*

## Downloading Bonus GIFs

You can download a database of 1600+ Pokémon sprites using the included script:
```bash
node scripts/download-gifs.js
```
The sprites will be saved to the `pokemon-gifs` folder, from where you can easily import them into the app.

## License

This project is licensed under the [MIT License](LICENSE).
