# Obision Extension Grid

A GNOME Shell extension for grid-based window management.

## Features

- **Grid Overlay**: Visual grid display of all open applications
- **Large Current App Cell**: Highlighted 2x2 cell for the focused application
- **Customizable Layout**: Configure grid dimensions (2-8 rows/columns)
- **Quick Window Switching**: Click any cell to activate that window
- **Keyboard Shortcut**: Toggle grid with `Super+G` (configurable)
- **Visual Feedback**: Hover effects and focus indicators
- **Preferences UI**: Full settings panel with Adwaita design

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/nirlob/obision-extension-grid.git
   cd obision-extension-grid
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
   gnome-extensions enable obision-extension-grid@obision.com
   ```

5. Restart GNOME Shell:
   - On X11: Press `Alt+F2`, type `r`, and press Enter
   - On Wayland: Log out and log back in

## Development

### Project Structure

```
obision-extension-grid/
├── src/
│   ├── js/
│   │   ├── extension.js     # Main extension code
│   │   └── prefs.js         # Preferences UI
│   └── css/
│       └── stylesheet.css   # Custom styles
├── schemas/                 # GSettings schemas
│   └── org.gnome.shell.extensions.obision-extension-grid.gschema.xml
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
gnome-extensions disable obision-extension-grid@obision.com
gnome-extensions enable obision-extension-grid@obision.com
```

View logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## Configuration

Open the extension preferences:
```bash
gnome-extensions prefs obision-extension-grid@obision.com
```

Available settings:
- **Grid Columns**: Number of columns (2-8)
- **Grid Rows**: Number of rows (2-8)
- **Highlight Current Application**: Show focused app in a 2x2 large cell
- **Show Window Titles**: Display titles in grid cells
- **Background Opacity**: Overlay background opacity (0-100%)
- **Toggle Grid Shortcut**: Keyboard shortcut (default: `Super+G`)

## Usage

1. Press `Super+G` to open the grid overlay
2. View all open applications distributed across the grid
3. The focused application appears in a larger, highlighted cell (if enabled)
4. Click any cell to switch to that application
5. Press `Escape` or click outside to close the grid
6. Customize layout and behavior in preferences

## Requirements

- GNOME Shell 45 or 46
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

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/nirlob/obision-extension-grid/issues).
