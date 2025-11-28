import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ObisionExtensionGridPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'view-grid-symbolic',
        });
        window.add(page);

        // Grid Layout Group
        const layoutGroup = new Adw.PreferencesGroup({
            title: 'Grid Layout',
            description: 'Configure the grid dimensions',
        });
        page.add(layoutGroup);

        // Grid Columns
        const columnsRow = new Adw.SpinRow({
            title: 'Grid Columns',
            subtitle: 'Number of columns in the grid',
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 8,
                step_increment: 1,
            }),
        });
        layoutGroup.add(columnsRow);
        settings.bind(
            'grid-columns',
            columnsRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Grid Rows
        const rowsRow = new Adw.SpinRow({
            title: 'Grid Rows',
            subtitle: 'Number of rows in the grid',
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 8,
                step_increment: 1,
            }),
        });
        layoutGroup.add(rowsRow);
        settings.bind(
            'grid-rows',
            rowsRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Display Options Group
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display Options',
            description: 'Configure how the grid is displayed',
        });
        page.add(displayGroup);

        // Show Current App Large
        const showLargeRow = new Adw.SwitchRow({
            title: 'Highlight Current Application',
            subtitle: 'Show the focused application in a larger cell',
        });
        displayGroup.add(showLargeRow);
        settings.bind(
            'show-current-large',
            showLargeRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Show Window Titles
        const showTitlesRow = new Adw.SwitchRow({
            title: 'Show Window Titles',
            subtitle: 'Display window titles in grid cells',
        });
        displayGroup.add(showTitlesRow);
        settings.bind(
            'show-titles',
            showTitlesRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Grid Opacity
        const opacityRow = new Adw.SpinRow({
            title: 'Background Opacity',
            subtitle: 'Opacity of the grid overlay background (0-100%)',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 5,
            }),
        });
        displayGroup.add(opacityRow);
        settings.bind(
            'grid-opacity',
            opacityRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Keyboard Shortcuts Group
        const shortcutsGroup = new Adw.PreferencesGroup({
            title: 'Keyboard Shortcuts',
            description: 'Configure keyboard shortcuts',
        });
        page.add(shortcutsGroup);

        // Toggle Grid Shortcut
        const shortcutRow = new Adw.ActionRow({
            title: 'Toggle Grid Overlay',
            subtitle: settings.get_strv('toggle-grid')[0] || 'Not set',
        });
        
        const shortcutButton = new Gtk.Button({
            label: 'Set Shortcut',
            valign: Gtk.Align.CENTER,
        });
        shortcutButton.connect('clicked', () => {
            this._showShortcutDialog(window, settings, shortcutRow);
        });
        shortcutRow.add_suffix(shortcutButton);
        shortcutsGroup.add(shortcutRow);
    }

    _showShortcutDialog(window, settings, row) {
        const dialog = new Adw.MessageDialog({
            heading: 'Set Keyboard Shortcut',
            body: 'Press the key combination you want to use',
            transient_for: window,
            modal: true,
        });

        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('clear', 'Clear');
        dialog.set_response_appearance('clear', Adw.ResponseAppearance.DESTRUCTIVE);

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (controller, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            
            if (keyval && mask) {
                const shortcut = Gtk.accelerator_name(keyval, mask);
                settings.set_strv('toggle-grid', [shortcut]);
                row.subtitle = shortcut;
                dialog.close();
                return true;
            }
            return false;
        });
        dialog.add_controller(controller);

        dialog.connect('response', (dialog, response) => {
            if (response === 'clear') {
                settings.set_strv('toggle-grid', ['<Super>g']);
                row.subtitle = '<Super>g';
            }
            dialog.close();
        });

        dialog.present();
    }
}
