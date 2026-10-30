# Releasing Kitty

One-time setup
1. Create a GitHub repository (public is simplest; private repos need a token inside the app) and push this project.
2. In `package.json` set `build.publish[0].owner` and `repo` to that repository.
3. (Optional, recommended) Add a code-signing certificate, otherwise Windows SmartScreen warns on install.
   For friends-only builds: click "More info" then "Run anyway".

Local installer build (no publishing): `npm run dist`  ->  `release/Kitty Setup x.y.z.exe`

Shipping an update
1. Bump `version` in `package.json` (for example 0.0.2).
2. `git tag v0.0.2 && git push --tags`
3. GitHub Actions builds and publishes the release. Installed copies download it in the background and show
   **Restart & update** in the ••• menu (a green dot appears on the button).
