# Local installs (mods that are not on Nexus)

Install a mod from a file on the device: your own build, a private mod, a
patch you made. It goes through the same pipeline as a Nexus download, so
extraction, the Data merge, plugin activation, enable/disable and uninstall
are the existing code, and no Nexus account or API key is needed.

**Status:** backend and frontend written and tested (typecheck, all JS suites,
the Python suite and the production bundle). **Nothing here has run on a
device yet.**

## User flow

1. Copy a `.zip`, `.7z`, `.rar`, or a bare `.esm` / `.esp` / `.esl` into
   `~/local-mods/` in the Deck user's home. It is created (owned by you, not
   root) the first time the list is opened, and it is deliberately not under
   `~/homebrew`, which Decky makes root-owned. The backend reports the exact
   path as `dir` from `list_local_mods`.
2. Open the **Local** tab (or **Local mods →** in the Quick Access panel), pick
   the game from the dropdown at the top, and press **Install** on the file.
   Only the Data-folder (Bethesda-style) games are offered for now.
3. It appears in **My Mods** like any other mod and can be disabled, re-enabled
   and uninstalled there.

The file in `local-mods/` is copied, never moved, so a mod can be reinstalled
after an uninstall or a game reset.

## How it works

`install_local_mod` does three things around the existing `install_mod`:

1. **Stage.** The file is copied into the download cache
   (`_archive_cache_path`), where `_download_archive` already returns early for
   "a completed prefetch". A bare plugin is wrapped in a zip first, because a
   plugin at an archive root is already recognised as the Data payload
   ("bare loose files ... the archive root IS the Data payload").
2. **Install** with a stand-in id. `_local_mod_ids(name)` returns
   `(-(crc32 & 0x3FFFFFFF) - 1, 1)`: stable per name, and negative so it can
   never collide with a real Nexus id. The one place that demanded an API key
   (`_install_mod_inner`) now waives it for a negative id. A Nexus install
   with a positive id still needs the key (tested).
3. **Re-mark the record.** After success the install record gets
   `source: "local"`, `mod_id: 0`, `local_file: <name>`. `check_updates` only
   tracks records with a truthy `mod_id`, so a local mod is never looked up on
   Nexus (tested: the Nexus lookup is patched to fail if it is reached).

Only a bare file name from `local-mods/` is accepted: no separators, no
leading dot, and only the extensions above. The frontend picks from
`list_local_mods`, so anything else was not offered by this plugin and is
refused.

## Backend API

- `list_local_mods() -> {ok, dir, files: [{file_name, size, modified}]}`;
  creates the folder so there is somewhere to drop files.
- `install_local_mod(game_domain, file_name, mod_name, mod_version,
  install_dir, mods_subdir, install_mode, app_id, plugins_subpath,
  plugins_style, payload_choice, flat_extensions, process_name) -> install_mod result`.
  Same result shape as `install_mod`, including `needs_choice` / `needs_fomod`.

Tests: `TestLocalInstall` in `tests/test_backend.py`.

## Frontend

- `src/LocalPage.tsx`: the **Local** tab. A game dropdown (games with
  `installMode === "dataDir"`), the folder path, the files with an Install
  button each, and Refresh. An archive that needs a folder choice reuses
  `PayloadChoiceModal`; a FOMOD wizard archive is refused with a message.
- `src/api.ts`: `listLocalMods` and `installLocalMod`. Arguments are
  positional; the four after `mods_subdir` are `...modeParams(game)`.
- `src/Tabs.tsx`, `src/navRules.ts`, `src/index.tsx`, `tests/nav.test.mjs`:
  tab, page id, route, and the per-tab navigation checks. A "Local mods →"
  button in the Quick Access panel for Data-folder games.

## Still to do

- **Manual QA on a device.** Only code and tests have run.
- **Starfield plugin activation is unverified.** `games.ts` still carries the
  TODO that Starfield may not read `Plugins.txt` on its own (community history
  says it needed the `StarfieldCustom.ini` workaround or a "Plugins.txt
  Enabler" mod). A local `.esm` install writes `Plugins.txt` the same way a
  Nexus one does, so it inherits that uncertainty. Check on the device that
  the game actually loads the plugin.
- **Other install modes.** `install_local_mod` does not carry the UE4SS,
  Witcher, Cyberpunk, pak-patch or ReShade layout settings, so the page only
  offers Data-folder games. Adding one means passing its extra arguments.
- **A URL source** (a private release asset) would be a second staging step in
  front of the same install; not started.
- Local mods have no update checks, endorsements or Nexus page link, by
  design. The My Mods row does not yet say "Local" instead of showing a blank
  page link.
