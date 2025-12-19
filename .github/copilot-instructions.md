# Obision One Win - GNOME Shell Extension

A Stage Manager-style window management extension for GNOME Shell with live thumbnail previews and side panel navigation.

## Architecture Overview

**Core Components:**
- `extension.js` - Main extension (~1966 lines) with three GObject classes:
  - `WindowThumbnail` (lines 41-439): Individual window preview with live clones, close button, context menu, and single/double-click handling
  - `StageManagerPanel` (lines 440-1151): Side panel container with scroll view, resize handle with grip dots, and theme detection
  - `ObisionExtGrid` (lines 1152-end): Main extension class extending `Extension`, managing lifecycle, window tracking, hot edge, and panel animations
- `prefs.js` - Adwaita preferences UI extending `ExtensionPreferences` with custom shortcut dialog
- `stylesheet.css` - Theme-aware styling with 9 GNOME accent color variants (blue, teal, green, yellow, orange, red, pink, purple, slate)

**Key Design Patterns:**
- **GObject Registration**: All custom UI components use `GObject.registerClass()` for proper GNOME Shell integration
- **Live Window Clones**: Use `Meta.WindowActor.get_compositor_private()` + `Clutter.Clone` for real-time thumbnail updates (NOT screenshots)
- **Signal-driven Updates**: Extension lifecycle driven by `window-created`, `notify::focus-window`, window `size-changed`, and actor `destroy` signals
- **Aspect Ratio Calculations**: Thumbnails maintain 16:10 ratio - dimension helper functions in lines 22-39 calculate sizes considering panel padding, resize handle, and margins
- **Window History Tracking**: `_windowHistory` array tracks last 10 focused windows for "go back" behavior on window close

## Critical Development Workflows

### Build & Deploy
```bash
npm run build               # Compile schemas + pack extension with gnome-extensions pack
npm install                 # Install devDependencies (eslint, prettier) for code quality
npm run install             # Install built extension to ~/.local/share/gnome-shell/extensions/
npm run deploy              # Build + install + show reload instructions
npm run update              # Build + install + reload (X11 only - uses scripts/reload.sh)
npm run enable              # Enable the extension after installation
npm run clean               # Remove build artifacts (builddir/, gschemas.compiled)
```

**Note**: The extension has NO runtime npm dependencies - only devDependencies for linting/formatting. The `pack` command creates `obision-ext-one-win@obision.com.shell-extension.zip` from root files (extension.js, prefs.js, metadata.json, stylesheet.css) plus schemas/ directory.

**IMPORTANT**: Extension UUID must match everywhere: `obision-ext-one-win@obision.com`
- `metadata.json`: `"uuid"` field
- `schemas/*.gschema.xml`: `<schema id="com.obision.ext.one-win">` (uses dot notation)
- `metadata.json`: `"settings-schema": "com.obision.ext.one-win"

### Testing Changes
- **X11**: `npm run reload` or `Alt+F2` → `r` → `Enter`
- **Wayland**: Must log out/in (GNOME Shell doesn't support hot reload on Wayland)
- **View Logs**: `npm run logs` or `journalctl -f -o cat /usr/bin/gnome-shell`
- Always test after modifying signal connections or GObject properties

### Schema Changes
After modifying `schemas/com.obision.ext.one-win.gschema.xml`:
1. Run `npm run compile-schemas` (or `glib-compile-schemas schemas/`)
2. Reinstall extension with `npm run install`
3. Restart GNOME Shell
4. GSettings keys are bound in `prefs.js` using `settings.bind()` for reactive UI

### Release Process
```bash
npm run release             # Automated version bump, git tag, and push
```
This script (`scripts/release.sh`) performs:
1. Increments minor version in `package.json` (e.g., 0.2.0 → 0.3.0)
2. Updates `metadata.json` version (concatenates major+minor, e.g., 03)
3. Updates `debian/changelog` with new entry
4. Commits changes, creates git tag `v0.3.0`, and pushes to remote
5. GitHub Actions workflow (`.github/workflows/release.yml`) triggers on `v*` tags, builds DEB package, and creates GitHub Release with auto-generated notes

### DEB Package Workflow
```bash
npm run deb-build           # Build DEB package locally (requires devscripts, equivs)
npm run deb-install         # Install DEB package with dependencies
npm run deb-uninstall       # Remove installed DEB package
npm run deb-clean           # Clean build artifacts
```

**Package Details:**
- Package name: `gnome-shell-extension-obision-one-win`
- Depends on: `gnome-shell (>= 48)`
- Built using `dpkg-buildpackage` from `debian/` directory
- GitHub Actions (`.github/workflows/release.yml`) auto-builds on version tags (v*)
- Releases include auto-generated installation instructions

## Project-Specific Conventions

### GJS/GNOME Shell Patterns
```javascript
// Import GNOME modules (NOT Node.js style - use gi:// and resource:// schemes)
import St from 'gi://St';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// GObject class registration (required for ALL UI components)
const MyWidget = GObject.registerClass(
class MyWidget extends St.Widget {
    _init(params) {
        super._init(params);
        // Initialize here
    }
});

// NEVER use 'this._super()' - always use super.method() instead
// Use log() for console output, logError() for errors - not console.log()
```

### Window Management Specifics
- **Window Filtering**: Only show `Meta.WindowType.NORMAL` windows, exclude `skip_taskbar`
- **Coordinate System**: Account for panel heights via `_getDashPanelHeight()` - checks for Dash to Panel and other extensions via `Main.layoutManager._trackedActors`
- **Animation Timing**: Use `GLib.timeout_add()` with `GLib.PRIORITY_DEFAULT` for delayed operations (NOT `setTimeout()`)
- **Clutter Animations**: Use `actor.ease()` for transitions, `Clutter.AnimationMode` for easing functions
- **Memory Management**: Always disconnect signals in `destroy()` methods, clear Maps/Sets, and remove timers with `GLib.source_remove()`

### Dimension Calculations (Critical)
Helper functions in lines 22-39 of `extension.js` calculate all sizes:
- `calculateThumbnailWidth(panelWidth, resizeHandleWidth)`: Panel width - resize handle - left/right margins
- `calculateScreenshotWidth(thumbnailWidth)`: Thumbnail width - panel padding (8px × 2)
- `calculateScreenshotHeight(screenshotWidth)`: Uses 16:10 aspect ratio constant (`THUMBNAIL_ASPECT_RATIO`)

**Layout Constants** (lines 12-21):
- `DEFAULT_PANEL_WIDTH = 200`, `MIN_PANEL_WIDTH = 150`, `MAX_PANEL_WIDTH = 700`
- `RESIZE_HANDLE_WIDTH = 8`, `SCREENSHOT_PANEL_PADDING = 8`
- `THUMBNAIL_MARGIN_LEFT = 16`, `THUMBNAIL_MARGIN_RIGHT = 20`

When modifying layout, maintain this calculation chain or thumbnails will clip/overflow.

## File-Specific Notes

### `extension.js` Structure
- Lines 1-39: Constants and dimension calculation utilities
- Lines 41-439: `WindowThumbnail` class (thumbnails with clones, close button, context menu)
- Lines 440-1151: `StageManagerPanel` class (scroll container, resize handle, thumbnail management)
- Lines 1152-1966: `ObisionExtGrid` extension class (lifecycle, signals, window tracking)

**Key Methods:**
- `_updateLayout()`: Refreshes thumbnail list, respects window focus history
- `_adjustActiveWindow()`: Positions focused window in remaining screen space
- `_createClone()`: Creates live window preview using compositor texture

### `prefs.js` Settings
Uses Adwaita widgets (`Adw.PreferencesPage`, `Adw.SwitchRow`, etc.). Settings auto-sync via:
```javascript
settings.bind('setting-key', widget, 'property', Gio.SettingsBindFlags.DEFAULT);
```

### `metadata.json` Compatibility
`shell-version` array defines supported GNOME versions. Currently: `["48", "49"]`

## Debugging

**Console Logging:**
```javascript
log(`Message`);           // Standard log
logError(error);          // Error logging
```

View logs: `journalctl -f -o cat /usr/bin/gnome-shell`

**Common Issues:**
- **Extension not loading**: Check UUID matches everywhere, verify `metadata.json` shell-version
- **Thumbnails not updating**: Clone creation failed - check `_createClone()` error handling
- **Layout glitches**: Likely coordinate calculation issue - log window geometries and panel dimensions
- **Settings not persisting**: Schema ID mismatch between `metadata.json` (`settings-schema`) and schema file

## Integration Points

- **GNOME Shell APIs**: `Main.layoutManager` for chrome actors, `Meta.later_add()` for deferred calls
- **Window Tracker**: `Shell.WindowTracker.get_default()` for app info/icons
- **Keyboard Shortcuts**: Registered via `Main.wm.addKeybinding()` with schema key `toggle-grid`
- **Third-party Extensions**: Detects Dash to Panel via chrome actor scanning in `_getDashPanelHeight()`

## Code Quality

```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix issues
npm run format        # Prettier formatting
npm run format:check  # Check formatting without modifying files
```

**Configuration Files:**
- `.eslintrc.json`: ESLint config with GJS globals (`log`, `logError`, `imports`, `global`, `ARGV`), uses `eslint:recommended` + `plugin:prettier/recommended`
- `.prettierrc.json`: Prettier config (2 spaces, single quotes, no trailing commas)
- `.eslintignore` / `.prettierignore`: Excludes node_modules/, builddir/, schemas/gschemas.compiled

**GJS-specific Linting Rules:**
- `no-unused-vars`: Warns only (allows `_` prefix for unused params)
- `no-console`: Disabled (use `log()` and `logError()` instead of console methods)
