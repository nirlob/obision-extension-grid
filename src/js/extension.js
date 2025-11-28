import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const GridOverlay = GObject.registerClass(
class GridOverlay extends St.Widget {
    _init(extension) {
        super._init({
            name: 'obision-grid-overlay',
            reactive: true,
            visible: false,
            layout_manager: new Clutter.GridLayout({ orientation: Clutter.Orientation.VERTICAL })
        });

        this._extension = extension;
        this._settings = extension._settings;
        this._cells = [];
        this._windows = [];
        
        this._buildGrid();
    }

    _buildGrid() {
        // Clear existing cells
        this.destroy_all_children();
        this._cells = [];

        const columns = this._settings.get_int('grid-columns');
        const rows = this._settings.get_int('grid-rows');
        const showCurrentLarge = this._settings.get_boolean('show-current-large');

        // Get active workspace windows
        const workspace = global.workspace_manager.get_active_workspace();
        this._windows = workspace.list_windows().filter(w => 
            !w.skip_taskbar && w.get_window_type() === Meta.WindowType.NORMAL
        );

        const focusWindow = global.display.focus_window;
        const layout = this.layout_manager;

        let cellIndex = 0;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                // First cell is large for current app if enabled
                const isLargeCell = showCurrentLarge && row === 0 && col === 0;
                const cellWidth = isLargeCell ? 2 : 1;
                const cellHeight = isLargeCell ? 2 : 1;

                if (cellIndex < this._windows.length) {
                    const window = this._windows[cellIndex];
                    const isFocused = window === focusWindow;
                    const cell = this._createCell(window, isLargeCell, isFocused);
                    
                    layout.attach(cell, col, row, cellWidth, cellHeight);
                    this._cells.push({ cell, window });
                }

                cellIndex++;
                
                // Skip next cell if large cell
                if (isLargeCell) {
                    col++;
                }
            }
        }
    }

    _createCell(window, isLarge, isFocused) {
        const cell = new St.Button({
            style_class: 'obision-grid-cell' + (isFocused ? ' obision-grid-cell-focused' : '') + (isLarge ? ' obision-grid-cell-large' : ''),
            x_expand: true,
            y_expand: true,
        });

        const box = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Window title
        const title = new St.Label({
            text: window.get_title() || 'Untitled',
            style_class: 'obision-grid-cell-title' + (isLarge ? ' obision-grid-cell-title-large' : ''),
        });
        title.clutter_text.set_line_wrap(true);
        title.clutter_text.set_ellipsize(3); // PANGO_ELLIPSIZE_END

        // App name
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        const appName = new St.Label({
            text: app ? app.get_name() : 'Unknown',
            style_class: 'obision-grid-cell-app' + (isLarge ? ' obision-grid-cell-app-large' : ''),
        });

        box.add_child(title);
        box.add_child(appName);

        cell.set_child(box);

        // Click handler to activate window
        cell.connect('clicked', () => {
            window.activate(global.get_current_time());
            this.hide();
        });

        return cell;
    }

    show() {
        this._buildGrid();
        super.show();
        global.stage.set_key_focus(this);
    }

    hide() {
        super.hide();
    }

    vfunc_key_press_event(event) {
        const symbol = event.get_key_symbol();
        
        if (symbol === Clutter.KEY_Escape) {
            this.hide();
            return Clutter.EVENT_STOP;
        }
        
        return Clutter.EVENT_PROPAGATE;
    }
});

export default class ObisionExtensionGrid extends Extension {
    enable() {
        this._settings = this.getSettings();
        
        // Create grid overlay
        this._gridOverlay = new GridOverlay(this);
        Main.layoutManager.addChrome(this._gridOverlay, {
            affectsStruts: false,
            trackFullscreen: true
        });

        // Position overlay to cover the whole screen
        this._gridOverlay.set_position(0, 0);
        this._gridOverlay.set_size(
            global.screen_width,
            global.screen_height
        );

        // Add keybinding to toggle grid
        Main.wm.addKeybinding(
            'toggle-grid',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            () => this._toggleGrid()
        );
        
        // Connect to settings changes
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._onSettingsChanged();
        });

        // Monitor for window changes
        this._windowAddedId = global.display.connect('window-created', () => {
            if (this._gridOverlay.visible) {
                this._gridOverlay._buildGrid();
            }
        });

        log('Obision Extension Grid enabled');
    }

    disable() {
        // Remove keybinding
        Main.wm.removeKeybinding('toggle-grid');

        // Disconnect signals
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._windowAddedId) {
            global.display.disconnect(this._windowAddedId);
            this._windowAddedId = null;
        }

        // Destroy overlay
        if (this._gridOverlay) {
            Main.layoutManager.removeChrome(this._gridOverlay);
            this._gridOverlay.destroy();
            this._gridOverlay = null;
        }
        
        this._settings = null;
        
        log('Obision Extension Grid disabled');
    }

    _toggleGrid() {
        if (this._gridOverlay.visible) {
            this._gridOverlay.hide();
        } else {
            this._gridOverlay.show();
        }
    }

    _onSettingsChanged() {
        // Rebuild grid when settings change
        if (this._gridOverlay && this._gridOverlay.visible) {
            this._gridOverlay._buildGrid();
        }
    }
}
