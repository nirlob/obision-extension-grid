# Obision One Win

A GNOME Shell extension for grid-based window management.

## Features

- **Stage Manager Mode**: macOS-inspired window management
- **Side Panel**: Live thumbnails of inactive windows
- **Active Window Area**: Main workspace for the focused application
- **Real-time Window Clones**: Thumbnail previews update live
- **Quick Switching**: Click any thumbnail to activate that window
- **Keyboard Shortcut**: Toggle Stage Manager with `Super+G` (configurable)
- **Customizable**: Adjust panel width, thumbnail size, and position
- **Auto-minimize**: Optionally minimize inactive windows
- **Preferences UI**: Complete settings panel with Adwaita design

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/nirlob/obision-extension-one-win.git
   cd obision-extension-one-win
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and install the extension:
   ```bash
   chmod +x build.sh
   ./build.sh
   npm run install
   ```

4. Enable the extension:
   ```bash
   gnome-extensions enable obision-extension-one-win@obision.com
   ```

5. Restart GNOME Shell:
   - On X11: Press `Alt+F2`, type `r`, and press Enter
   - On Wayland: Log out and log back in

## Development

### Project Structure

```
obision-extension-one-win/
├── src/
│   ├── js/
│   │   ├── extension.js     # Main extension code
│   │   └── prefs.js         # Preferences UI
│   └── css/
│       └── stylesheet.css   # Custom styles
├── schemas/                 # GSettings schemas
│   └── org.gnome.shell.extensions.obision-extension-one-win.gschema.xml
├── metadata.json           # Extension metadata
├── package.json            # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── .eslintrc.json          # ESLint configuration
└── build.sh               # Build script
```

### Building

Compile the extension:
```bash
npm run build
```

### Linting & Formatting

Run ESLint to check code quality:
```bash
npm run lint
```

Fix linting issues automatically:
```bash
npm run lint:fix
```

Format code with Prettier:
```bash
npm run format
```

Check formatting:
```bash
npm run format:check
```

### Quick Deploy

Build, install, and enable in one command:
```bash
npm run deploy
```

### Testing

After making changes, reload the extension:
```bash
gnome-extensions disable obision-extension-one-win@obision.com
gnome-extensions enable obision-extension-one-win@obision.com
```

View logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## Configuration

Open the extension preferences:
```bash
gnome-extensions prefs obision-extension-one-win@obision.com
```

Available settings:
- **Panel Width**: Width of the side panel (200-500px)
- **Thumbnail Height**: Height of window thumbnails (100-300px)
- **Panel Position**: Display panel on left or right side
- **Auto-minimize**: Minimize windows not shown in panel
- **Show App Names**: Display application names below thumbnails
- **Toggle Shortcut**: Keyboard shortcut (default: `Super+G`)

## Usage

1. Press `Super+G` to activate Stage Manager mode
2. The side panel appears showing thumbnails of all inactive windows
3. The focused window is displayed in the main area
4. Click any thumbnail to switch to that window
5. Press `Super+G` again to deactivate and return to normal mode
6. Customize panel size, position, and behavior in preferences

**Tips:**
- Thumbnails update in real-time showing window contents
- Inactive windows are automatically minimized (configurable)
- The active window is resized to make room for the panel
- All window positions are restored when Stage Manager is disabled

## Requirements

- GNOME Shell 48 or later
- GLib 2.0
- GTK 4.0

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting: `npm run lint`
5. Submit a pull request

## License

GPL-3.0

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/nirlob/obision-extension-one-win/issues).
