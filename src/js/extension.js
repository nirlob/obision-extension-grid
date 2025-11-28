import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const PANEL_WIDTH = 450;
const THUMBNAIL_HEIGHT = 280;
const THUMBNAIL_SPACING = 12;
const PANEL_PADDING = 16;

// Window thumbnail in the side panel
const WindowThumbnail = GObject.registerClass(
class WindowThumbnail extends St.Button {
    _init(window, stageManager) {
        super._init({
            style_class: 'stage-manager-thumbnail',
            x_expand: false,
        });

        this._window = window;
        this._stageManager = stageManager;
        
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'stage-manager-thumbnail-box',
        });

        // Window clone container with fixed dimensions
        this._cloneContainer = new St.Widget({
            style_class: 'stage-manager-clone-container',
            layout_manager: new Clutter.BinLayout(),
            height: THUMBNAIL_HEIGHT,
            width: PANEL_WIDTH - PANEL_PADDING * 2 - 24,
            clip_to_allocation: true,
        });

        // Create window clone
        this._createClone();

        // Info box with icon and labels
        const infoBox = new St.BoxLayout({
            style_class: 'stage-manager-info-box',
            x_align: Clutter.ActorAlign.START,
        });

        // App icon
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        if (app) {
            const icon = app.create_icon_texture(24);
            if (icon) {
                icon.style_class = 'stage-manager-app-icon';
                infoBox.add_child(icon);
            }
        }

        // Labels box
        const labelsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });

        // Window title
        this._titleLabel = new St.Label({
            text: window.get_title() || 'Untitled',
            style_class: 'stage-manager-window-title',
        });
        this._titleLabel.clutter_text.set_ellipsize(3);

        // App name
        this._appLabel = new St.Label({
            text: app ? app.get_name() : 'Unknown',
            style_class: 'stage-manager-app-name',
        });
        this._appLabel.clutter_text.set_ellipsize(3);

        labelsBox.add_child(this._titleLabel);
        labelsBox.add_child(this._appLabel);
        infoBox.add_child(labelsBox);

        box.add_child(this._cloneContainer);
        box.add_child(infoBox);
        this.set_child(box);

        // Click to activate window
        this.connect('clicked', () => {
            this._window.activate(global.get_current_time());
        });

        // Update on title changes
        this._notifyTitleId = window.connect('notify::title', () => {
            this._titleLabel.text = window.get_title() || 'Untitled';
        });
    }

    _createClone() {
        const windowActor = this._window.get_compositor_private();
        if (!windowActor) return;

        const clone = new Clutter.Clone({
            source: windowActor,
        });

        // Container dimensions
        const containerWidth = PANEL_WIDTH - PANEL_PADDING * 2 - 24;
        const containerHeight = THUMBNAIL_HEIGHT;
        
        // Force the clone to fill the entire container
        // This is more reliable than using set_scale()
        clone.set_size(containerWidth, containerHeight);
        clone.set_position(0, 0);
        
        this._cloneContainer.add_child(clone);
        this._clone = clone;
    }

    destroy() {
        if (this._notifyTitleId) {
            this._window.disconnect(this._notifyTitleId);
            this._notifyTitleId = null;
        }
        super.destroy();
    }
});

// Side panel with window thumbnails
const StageManagerPanel = GObject.registerClass(
class StageManagerPanel extends St.BoxLayout {
    _init(extension) {
        super._init({
            name: 'stage-manager-panel',
            vertical: true,
            style_class: 'stage-manager-panel',
            width: PANEL_WIDTH,
            y_align: Clutter.ActorAlign.START,
        });

        this._extension = extension;
        this._settings = extension._settings;
        this._thumbnails = [];

        // Scroll view for thumbnails
        this._scrollView = new St.ScrollView({
            style_class: 'stage-manager-scroll',
            y_expand: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
        });

        this._thumbnailBox = new St.BoxLayout({
            vertical: true,
            style_class: 'stage-manager-thumbnail-container',
        });

        this._scrollView.add_child(this._thumbnailBox);
        this.add_child(this._scrollView);
    }

    updateThumbnails() {
        // Clear existing thumbnails
        this._thumbnailBox.destroy_all_children();
        this._thumbnails = [];

        const workspace = global.workspace_manager.get_active_workspace();
        const windows = workspace.list_windows().filter(w =>
            !w.skip_taskbar && w.get_window_type() === Meta.WindowType.NORMAL
        );

        const focusWindow = global.display.focus_window;

        // Add thumbnails for all windows (including active one)
        windows.forEach(window => {
            const thumbnail = new WindowThumbnail(window, this._extension);
            // Mark active window
            if (window === focusWindow) {
                thumbnail.add_style_class_name('stage-manager-thumbnail-active');
            }
            this._thumbnailBox.add_child(thumbnail);
            this._thumbnails.push(thumbnail);
        });
    }

    destroy() {
        this._thumbnails = [];
        super.destroy();
    }
});

export default class ObisionExtensionGrid extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._active = false;
        this._originalFrames = new Map();
        
        // Create stage manager panel
        this._panel = new StageManagerPanel(this);
        Main.layoutManager.addChrome(this._panel, {
            affectsStruts: false,
            trackFullscreen: false,
        });
        this._panel.hide();

        // Position panel on the left
        this._updatePanelPosition();

        // Add keybinding to toggle stage manager
        Main.wm.addKeybinding(
            'toggle-grid',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            () => this._toggleStageManager()
        );
        
        // Monitor for window changes
        this._windowCreatedId = global.display.connect('window-created', (display, window) => {
            if (this._active) {
                this._onWindowAdded(window);
            }
        });

        this._windowFocusId = global.display.connect('notify::focus-window', () => {
            if (this._active) {
                this._updateLayout();
            }
        });

        // Monitor size changes
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this._updatePanelPosition();
            if (this._active) {
                this._updateLayout();
            }
        });

        // Activate Stage Manager automatically on startup
        this._activateStageManager();

        log('Obision Extension Grid enabled');
    }

    disable() {
        // Disable stage manager if active
        if (this._active) {
            this._deactivateStageManager();
        }

        // Remove keybinding
        Main.wm.removeKeybinding('toggle-grid');

        // Disconnect signals
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._windowFocusId) {
            global.display.disconnect(this._windowFocusId);
            this._windowFocusId = null;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        // Destroy panel
        if (this._panel) {
            Main.layoutManager.removeChrome(this._panel);
            this._panel.destroy();
            this._panel = null;
        }
        
        this._settings = null;
        
        log('Obision Extension Grid disabled');
    }

    _toggleStageManager() {
        if (this._active) {
            this._deactivateStageManager();
        } else {
            this._activateStageManager();
        }
    }

    _activateStageManager() {
        this._active = true;
        this._updatePanelPosition(); // Recalculate panel position with dash height
        this._panel.show();
        this._updateLayout();
    }

    _deactivateStageManager() {
        this._active = false;
        this._panel.hide();
        this._restoreWindowFrames();
    }

    _updatePanelPosition() {
        const monitor = Main.layoutManager.primaryMonitor;
        const panelHeight = this._getDashPanelHeight();
        
        // Position panel below top dash/panel
        this._panel.set_position(monitor.x, monitor.y + panelHeight.top);
        // Adjust height to fit between top and bottom panels
        this._panel.set_height(monitor.height - panelHeight.top - panelHeight.bottom);
    }

    _updateLayout() {
        if (!this._active) return;

        // Update thumbnails in panel
        this._panel.updateThumbnails();

        // Resize and reposition active window
        const focusWindow = global.display.focus_window;
        if (focusWindow && !focusWindow.skip_taskbar && 
            focusWindow.get_window_type() === Meta.WindowType.NORMAL) {
            this._adjustActiveWindow(focusWindow);
        }

        // Minimize or hide other windows (optional based on settings)
        const workspace = global.workspace_manager.get_active_workspace();
        const windows = workspace.list_windows();
        
        windows.forEach(window => {
            if (window !== focusWindow && !window.skip_taskbar &&
                window.get_window_type() === Meta.WindowType.NORMAL) {
                // Keep them on workspace but not visible in main area
                window.minimize();
            }
        });
    }

    _adjustActiveWindow(window) {
        const monitor = Main.layoutManager.primaryMonitor;
        const panelWidth = PANEL_WIDTH; // No extra margin
        
        // Save original frame if not already saved
        if (!this._originalFrames.has(window)) {
            this._originalFrames.set(window, window.get_frame_rect());
        }

        // Detect dash/panel height (top or bottom)
        const panelHeight = this._getDashPanelHeight();
        
        // Calculate new frame for active window
        const newX = monitor.x + panelWidth;
        const newY = monitor.y + panelHeight.top;
        const newWidth = monitor.width - panelWidth;
        const newHeight = monitor.height - panelHeight.top - panelHeight.bottom;

        // Move and resize window
        window.unmaximize(Meta.MaximizeFlags.BOTH);
        window.move_resize_frame(false, newX, newY, newWidth, newHeight);
    }

    _restoreWindowFrames() {
        // Restore all windows to their original positions
        this._originalFrames.forEach((frame, window) => {
            try {
                window.move_resize_frame(false, frame.x, frame.y, frame.width, frame.height);
                if (window.minimized) {
                    window.unminimize();
                }
            } catch (e) {
                // Window might be destroyed
            }
        });
        this._originalFrames.clear();
    }

    _onWindowAdded(window) {
        if (!window.skip_taskbar && window.get_window_type() === Meta.WindowType.NORMAL) {
            this._updateLayout();
        }
    }

    _getDashPanelHeight() {
        const result = { top: 0, bottom: 0 };
        const monitor = Main.layoutManager.primaryMonitor;
        
        // Search through all chrome actors to find panels
        // This works for Dash to Panel and other panel extensions
        Main.layoutManager._trackedActors.forEach(obj => {
            const actor = obj.actor;
            if (!actor || !actor.visible) return;
            
            const height = actor.height;
            const y = actor.y;
            const width = actor.width;
            
            // Look for wide actors that span most of the screen (likely panels)
            // Panels are typically at least 80% of screen width and have reasonable height
            const isWideEnough = width >= monitor.width * 0.8;
            const hasReasonableHeight = height > 20 && height < 200;
            
            if (isWideEnough && hasReasonableHeight) {
                log(`[Stage Manager] Panel-like actor found: ${actor.name}, y=${y}, height=${height}, width=${width}`);
                
                // Determine if panel is at top or bottom based on position
                if (y <= monitor.y + 50) {
                    result.top = Math.max(result.top, height);
                } else if (y >= monitor.y + monitor.height - height - 50) {
                    result.bottom = Math.max(result.bottom, height);
                }
            }
        });
        
        log(`[Stage Manager] Final panel heights - top: ${result.top}, bottom: ${result.bottom}`);
        return result;
    }
}
