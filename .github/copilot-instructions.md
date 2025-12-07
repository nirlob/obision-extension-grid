# Obision One Win - GNOME Shell Extension

A Stage Manager-style window management extension for GNOME Shell with live thumbnail previews and side panel navigation.

## Architecture Overview

**Core Components:**
- `extension.js` - Main extension with two GObject classes:
  - `WindowThumbnail`: Individual window preview with live clones, close button, and context menu
  - `StageManagerPanel`: Side panel container managing thumbnails, resize handle, and layout
- `prefs.js` - Adwaita preferences UI extending `ExtensionPreferences`
- `stylesheet.css` - Theme-aware styling with light/dark variants

**Key Design Patterns:**
- **GObject Registration**: All custom UI components use `GObject.registerClass()` for GNOME Shell integration
- **Live Window Clones**: Use `Meta.WindowActor.get_texture()` for real-time thumbnail updates, not screenshots
- **Signal-driven Updates**: Extension lifecycle driven by `window-created`, `notify::focus-window`, and window destruction signals
- **Aspect Ratio Calculations**: Thumbnails maintain 16:10 ratio with padding considerations across components

## Critical Development Workflows

### Build & Deploy
```bash
npm run build               # Compile schemas + pack extension
npm run install-extension   # Install to ~/.local/share/gnome-shell/extensions/
npm run deploy              # Build + install + show reload instructions
npm run update              # Build + install + reload (X11 only)
```

**IMPORTANT**: Extension UUID in code must match `metadata.json`: `obision-extension-one-win@obision.com`

### Testing Changes
- **X11**: `./scripts/reload.sh` or Alt+F2 → `r`
- **Wayland**: Must log out/in (GNOME Shell doesn't support hot reload on Wayland)
- Always test after modifying signal connections or GObject properties

### Schema Changes
After modifying `schemas/*.gschema.xml`:
1. Run `glib-compile-schemas schemas/` (happens automatically in build)
2. Reinstall extension
3. GSettings keys are bound in `prefs.js` using `settings.bind()` for reactive UI

## Project-Specific Conventions

### GJS/GNOME Shell Patterns
```javascript
// Import GNOME modules (not Node.js style)
import St from 'gi://St';
import Meta from 'resource:///org/gnome/shell/ui/main.js';

// GObject class registration (required for UI components)
const MyWidget = GObject.registerClass(
class MyWidget extends St.Widget {
    _init(params) {
        super._init(params);
        // Initialize here
    }
});

// Never use 'this._super()' - use super.method() instead
```

### Window Management Specifics
- **Window Filtering**: Only show `Meta.WindowType.NORMAL` windows, exclude `skip_taskbar`
- **Coordinate System**: Account for panel heights via `_getDashPanelHeight()` - checks for Dash to Panel and other extensions
- **Animation Timing**: Use `Meta.later_add()` for post-layout operations, not `setTimeout()`
- **Memory Management**: Always disconnect signals in `destroy()` methods and clear Maps/Sets

### Dimension Calculations (Critical)
Functions in `extension.js` lines 22-39 calculate thumbnail sizes:
- `calculateThumbnailWidth()`: Panel width - resize handle - margins
- `calculateScreenshotWidth()`: Thumbnail width - panel padding (8px × 2)
- `calculateScreenshotHeight()`: Uses 16:10 aspect ratio constant

When modifying layout, maintain this calculation chain or thumbnails will clip/overflow.

## File-Specific Notes

### `extension.js` Structure
- Lines 1-39: Constants and dimension calculation utilities
- Lines 41-514: `WindowThumbnail` class (thumbnails with clones, close button, context menu)
- Lines 516-833: `StageManagerPanel` class (scroll container, resize handle, thumbnail management)
- Lines 835-1522: `ObisionExtensionGrid` extension class (lifecycle, signals, window tracking)

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

## Code Quality

```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix issues
npm run format        # Prettier formatting
```

ESLint configured for GJS globals (`log`, `logError`, `imports`).

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
```

ESLint configured for GJS globals (`log`, `logError`, `imports`). TypeScript checking enabled via `tsconfig.json` with `checkJs: true`.
