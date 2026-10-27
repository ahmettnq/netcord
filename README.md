# Netcord: Island Tennis (iOS)

Tennis on tiny floating miniature islands. Three clubs (clay, grass, hard), six rivals, timing-based swings, Core Haptics on every strike. Made by TNQ Nexus.

The game is a single HTML5 file (three.js, bundled, fully offline). This repo wraps it in a small native iOS shell and builds it on Codemagic, so no Mac is needed.

```
web/            game source (edit here)
  src/          game code, one file per system
  build/        three.js r186, pre-bundled (MIT License, see THREE_LICENSE.txt)
  build.py      builds web/src into one index.html
ios/
  project.yml   XcodeGen spec (Codemagic generates the Xcode project from it)
  Netcord/
    App/        Swift: app + scene delegate, web view host, haptics
    Resources/  www/index.html (built game), app icon, privacy manifest
    Info.plist
codemagic.yaml  cloud build: game, Xcode project, signing, .ipa, TestFlight
store/          App Store listing text, icon, screenshots
```

## One-time setup

Do these steps in order. Steps 1 to 3 happen in your browser on any computer.

### 1. Put this folder on GitHub
Create a new **private** repository (for example `ahmettnq/netcord`) and push this folder to it.

### 2. Register the app with Apple
1. developer.apple.com > Certificates, IDs & Profiles > Identifiers > **+** > App IDs > App.
   Description: `Netcord`. Bundle ID (explicit): `com.tnqnexus.netcord`. No extra capabilities are needed.
2. appstoreconnect.apple.com > Apps > **+** > New App.
   - Platform: iOS
   - Name: `Netcord: Island Tennis` (if it is taken, try `Netcord Tennis`)
   - Primary language: English (U.S.)
   - Bundle ID: `com.tnqnexus.netcord`
   - SKU: `netcord001`
3. Open the new app > App Information and copy the **Apple ID** (a number like `6712345678`).

### 3. Connect Codemagic
1. In Codemagic: Add application > GitHub > pick the repo > choose "codemagic.yaml".
2. Edit `codemagic.yaml` in the repo and replace the two `FILL IN` values:
   - `app_store_connect:` the name of the App Store Connect API key you already added for Hivelock (Team settings > Integrations > Developer Portal).
   - `APP_STORE_APPLE_ID:` the number from step 2.3.
3. Commit, then press **Start new build** on the `ios-release` workflow.

Codemagic builds the game into the app, generates the Xcode project, signs it with your Apple account, sets the build number, and uploads it to **TestFlight**. Install TestFlight on your iPhone and play the build there before you submit.

## Every update after that
1. Change the game in `web/src/`.
2. Bump `MARKETING_VERSION` in `ios/project.yml` when you ship a new version (1.0.1, 1.1.0, ...). Build numbers go up automatically.
3. Push to GitHub and start a build in Codemagic.

To try the game in a browser, run `python3 web/build.py` and open `web/dist/netcord.html`.

## Native bridges (for future changes)
Inside the app, the page talks to Swift through `window.webkit.messageHandlers`:

| Handler | Message | What it does |
|---|---|---|
| `haptic` | `{ i, s, d }` | Core Haptics strike: intensity, sharpness, ringing tail in seconds |
| `haptic` | `{ n: "success" }` | Notification haptic |
| `save` | JSON string | Saves progress to UserDefaults (injected back as `window.__NATIVE_SAVE`) |
| `speak` | text | Chair umpire voice through AVSpeechSynthesizer |

In a normal browser these are absent and the game falls back to `localStorage`, `navigator.vibrate` and the Web Speech API.

## App Store checklist
- **Agreements, Tax and Banking**: the Paid Apps Agreement must be active before a paid app can go on sale.
- **App Store Small Business Program**: enroll (free) so Apple keeps 15% instead of 30%.
- **Pricing**: see `store/listing.md`.
- **App Privacy**: "Data Not Collected". The game has no accounts, ads, analytics or network access.
- **Age rating**: answer None to every question. Result: 4+.
- **Category**: Games, with Sports and Casual as subcategories.
- **Screenshots**: `store/screenshots/` (6.9 inch display, landscape 2868 x 1320).
- **Privacy Policy URL**: host `store/privacy-policy.md` on tnqnexus.com and paste the link.
- **Review notes**: "Offline single-player game. No login, no in-app purchases, no ads, no data collection."
- Keep the description to features that are in the build (no "coming soon" items). That avoids the 2.1 and 5.6 rejections Hivelock ran into.

## Credits
All game code, 3D art, characters and sound are original work made for Netcord. 3D rendering by three.js (MIT License, © three.js authors).
