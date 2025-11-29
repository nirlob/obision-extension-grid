import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const DEFAULT_PANEL_WIDTH = 200;
const MIN_PANEL_WIDTH = 150;
const MAX_PANEL_WIDTH = 700;
const THUMBNAIL_ASPECT_RATIO = 16 / 9; // Width to height ratio
const THUMBNAIL_SPACING = 12;
const PANEL_PADDING = 16;
const RESIZE_HANDLE_WIDTH = 12;

// Calculate thumbnail height based on width
function calculateThumbnailHeight(panelWidth) {
    const thumbnailWidth = panelWidth - PANEL_PADDING * 2 - 24;
    return Math.round(thumbnailWidth / THUMBNAIL_ASPECT_RATIO);
}

// Window thumbnail in the side panel
const WindowThumbnail = GObject.registerClass(
class WindowThumbnail extends St.Widget {
    _init(window, stageManager, panelWidth) {
        super._init({
            style_class: 'stage-manager-thumbnail',
            x_expand: false,
            reactive: true,
            can_focus: false,
            track_hover: true,
        });

        this._window = window;
        this._stageManager = stageManager;
        this._panelWidth = panelWidth;
        
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'stage-manager-thumbnail-box',
        });

        // Window clone container with dynamic dimensions
        const thumbnailWidth = panelWidth - PANEL_PADDING * 2 - 24;
        const thumbnailHeight = calculateThumbnailHeight(panelWidth);
        
        this._cloneContainer = new St.Widget({
            style_class: 'stage-manager-clone-container',
            layout_manager: new Clutter.FixedLayout(),
            height: thumbnailHeight,
            width: thumbnailWidth,
            clip_to_allocation: true,
        });

        // Create window clone first (will be behind)
        this._createClone();
        
        // Bottom panel (semi-transparent overlay at bottom of thumbnail)
        // Add this AFTER the clone so it appears on top
        this._bottomPanel = new St.BoxLayout({
            style_class: 'stage-manager-thumbnail-bottom-panel',
            vertical: false,
            width: thumbnailWidth,
            height: 48,
        });
        
        // App icon inside bottom panel
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        if (app) {
            const icon = app.create_icon_texture(24);
            if (icon) {
                icon.style_class = 'stage-manager-app-icon';
                this._bottomPanel.add_child(icon);
            }
        }
        
        // App name inside bottom panel
        this._appLabel = new St.Label({
            text: app ? app.get_name() : 'Unknown',
            style_class: 'stage-manager-app-name',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._appLabel.clutter_text.set_ellipsize(3);
        this._bottomPanel.add_child(this._appLabel);
        
        // Position at the bottom manually (FixedLayout doesn't respect y_align)
        this._bottomPanel.set_position(0, thumbnailHeight - 48);
        this._cloneContainer.add_child(this._bottomPanel);

        // Close button (using the same style as GNOME window controls)
        const closeIcon = new St.Icon({
            icon_name: 'window-close-symbolic',
            icon_size: 14,
            style_class: 'stage-manager-close-icon',
        });
        
        this._closeButton = new St.Button({
            style_class: 'stage-manager-close-button',
            child: closeIcon,
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        
        // Position close button at top-left
        this._closeButton.set_position(6, 6);

        // Prevent click from propagating to the thumbnail
        this._closeButton.connect('button-press-event', () => {
            return Clutter.EVENT_STOP;
        });

        this._closeButton.connect('clicked', () => {
            try {
                this._window.delete(global.get_current_time());
            } catch (e) {
                log(`Error closing window: ${e}`);
            }
            return Clutter.EVENT_STOP;
        });

        this._cloneContainer.add_child(this._closeButton);

        box.add_child(this._cloneContainer);
        this.add_child(box);

        // Click to activate window
        this.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                this._window.activate(global.get_current_time());
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _createClone() {
        try {
            const windowActor = this._window.get_compositor_private();
            if (!windowActor) return;

            const clone = new Clutter.Clone({
                source: windowActor,
            });

            // Container dimensions
            const containerWidth = this._panelWidth - PANEL_PADDING * 2 - 24;
            const containerHeight = calculateThumbnailHeight(this._panelWidth);
            
            // Get frame rect (visible window without shadows)
            const frameRect = this._window.get_frame_rect();
            const bufferRect = this._window.get_buffer_rect();
            
            // Calculate shadow/decoration offsets
            const shadowLeft = Math.abs(frameRect.x - bufferRect.x);
            const shadowTop = Math.abs(frameRect.y - bufferRect.y);
            
            // Use frame rect dimensions (visible window)
            const windowWidth = frameRect.width;
            const windowHeight = frameRect.height;
            
            // Calculate scale to fit container while maintaining aspect ratio
            const scaleX = containerWidth / windowWidth;
            const scaleY = containerHeight / windowHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // Apply scale
            clone.set_scale(scale, scale);
            
            // Calculate position to center the visible window content
            const scaledWidth = windowWidth * scale;
            const scaledHeight = windowHeight * scale;
            
            // Position considering shadow offsets
            const x = (containerWidth - scaledWidth) / 2 - (shadowLeft * scale);
            const y = (containerHeight - scaledHeight) / 2 - (shadowTop * scale);
            
            clone.set_position(x, y);
            
            this._cloneContainer.add_child(clone);
            this._clone = clone;
        } catch (e) {
            log(`Error creating window clone: ${e}`);
        }
    }

    updateSize(panelWidth) {
        try {
            this._panelWidth = panelWidth;
            const containerWidth = panelWidth - PANEL_PADDING * 2 - 24;
            const containerHeight = calculateThumbnailHeight(panelWidth);
            
            if (this._cloneContainer) {
                this._cloneContainer.set_width(containerWidth);
                this._cloneContainer.set_height(containerHeight);
            }
            
            // Update bottom panel position and size
            if (this._bottomPanel) {
                this._bottomPanel.set_width(containerWidth);
                this._bottomPanel.set_position(0, containerHeight - 48);
            }
            
            if (this._clone) {
                const windowActor = this._window.get_compositor_private();
                if (windowActor) {
                    // Get both rects for proper positioning
                    const frameRect = this._window.get_frame_rect();
                    const bufferRect = this._window.get_buffer_rect();
                    
                    // Calculate shadow offsets
                    const shadowLeft = Math.abs(frameRect.x - bufferRect.x);
                    const shadowTop = Math.abs(frameRect.y - bufferRect.y);
                    
                    // Use frame rect dimensions (visible window)
                    const windowWidth = frameRect.width;
                    const windowHeight = frameRect.height;
                    
                    // Recalculate scale
                    const scaleX = containerWidth / windowWidth;
                    const scaleY = containerHeight / windowHeight;
                    const scale = Math.min(scaleX, scaleY);
                    
                    this._clone.set_scale(scale, scale);
                    
                    // Recenter considering shadows
                    const scaledWidth = windowWidth * scale;
                    const scaledHeight = windowHeight * scale;
                    const x = (containerWidth - scaledWidth) / 2 - (shadowLeft * scale);
                    const y = (containerHeight - scaledHeight) / 2 - (shadowTop * scale);
                    this._clone.set_position(x, y);
                }
            }
        } catch (e) {
            log(`Error updating thumbnail size: ${e}`);
        }
    }

    destroy() {
        try {
            if (this._closeButton) {
                this._closeButton.destroy();
                this._closeButton = null;
            }
            if (this._clone) {
                this._clone = null;
            }
        } catch (e) {
            log(`Error destroying thumbnail: ${e}`);
        }
        super.destroy();
    }
});

// Side panel with window thumbnails
const StageManagerPanel = GObject.registerClass(
class StageManagerPanel extends St.BoxLayout {
    _init(extension) {
        const panelWidth = extension._settings.get_int('panel-width');
        const resizeHandleWidth = extension._settings.get_int('resize-handle-width');
        
        super._init({
            name: 'stage-manager-panel',
            vertical: false,
            style_class: 'stage-manager-panel',
            width: panelWidth,
            y_align: Clutter.ActorAlign.START,
        });

        this._extension = extension;
        this._settings = extension._settings;
        this._thumbnails = [];
        this._panelWidth = panelWidth;
        this._resizeHandleWidth = resizeHandleWidth;

        // Listen for resize handle width changes
        this._resizeHandleWidthChangedId = this._settings.connect('changed::resize-handle-width', () => {
            this._resizeHandleWidth = this._settings.get_int('resize-handle-width');
            if (this._resizeHandle) {
                this._resizeHandle.set_width(this._resizeHandleWidth);
            }
        });

        // Main content box
        this._contentBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'stage-manager-content',
        });

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
        this._contentBox.add_child(this._scrollView);
        this.add_child(this._contentBox);

        // Resize handle - make it more usable
        this._resizeHandle = new St.Widget({
            style_class: 'stage-manager-resize-handle',
            reactive: true,
            track_hover: true,
            width: this._resizeHandleWidth,
            x_expand: false,
        });
        this.add_child(this._resizeHandle);

        // Resize functionality
        this._setupResizing();
    }

    _setupResizing() {
        this._dragging = false;
        this._dragStartX = 0;
        this._dragStartWidth = 0;

        // Change cursor on hover
        this._resizeHandle.connect('enter-event', () => {
            try {
                global.display.set_cursor(Meta.Cursor.CROSSHAIR);
            } catch (e) {
                log(`Error setting cursor: ${e}`);
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._resizeHandle.connect('leave-event', () => {
            if (!this._dragging) {
                try {
                    global.display.set_cursor(Meta.Cursor.DEFAULT);
                } catch (e) {
                    log(`Error resetting cursor: ${e}`);
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._resizeHandle.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                try {
                    this._dragging = true;
                    [this._dragStartX] = event.get_coords();
                    this._dragStartWidth = this._panelWidth;
                    
                    global.display.set_cursor(Meta.Cursor.CROSSHAIR);
                    
                    // Simple capture without grab
                    global.stage.set_key_focus(this._resizeHandle);
                } catch (e) {
                    log(`Error in button-press: ${e}`);
                    this._dragging = false;
                }
                
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Listen to motion on global stage when dragging
        this._stageMotionId = global.stage.connect('motion-event', (actor, event) => {
            if (this._dragging) {
                const [currentX] = event.get_coords();
                const deltaX = currentX - this._dragStartX;
                const newWidth = Math.min(MAX_PANEL_WIDTH, 
                                         Math.max(MIN_PANEL_WIDTH, 
                                                 this._dragStartWidth + deltaX));
                
                this.setPanelWidth(newWidth);
                
                // Update active window size in real-time during drag
                if (this._extension && this._extension._active && this._extension._updateLayout) {
                    this._extension._updateLayout();
                }
                
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Listen to button release on global stage
        this._stageButtonId = global.stage.connect('button-release-event', (actor, event) => {
            if (event.get_button() === 1 && this._dragging) {
                this._dragging = false;
                
                try {
                    global.display.set_cursor(Meta.Cursor.DEFAULT);
                } catch (e) {
                    log(`Error resetting cursor on release: ${e}`);
                }
                
                try {
                    // Save the new width to settings
                    if (this._settings) {
                        this._settings.set_int('panel-width', this._panelWidth);
                    }
                    
                    // Force final layout update to ensure window is properly positioned
                    if (this._extension && this._extension._active) {
                        const focusWindow = global.display.focus_window;
                        if (focusWindow && !focusWindow.skip_taskbar && 
                            focusWindow.get_window_type() === Meta.WindowType.NORMAL &&
                            focusWindow.get_maximized() === 0) {
                            this._extension._adjustActiveWindow(focusWindow);
                        }
                    }
                } catch (e) {
                    log(`Error in button-release: ${e}`);
                }
                
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    setPanelWidth(width) {
        this._panelWidth = width;
        this.set_width(width);
        
        // Update all thumbnails
        this._thumbnails.forEach(thumbnail => {
            thumbnail.updateSize(width);
        });
    }

    updateThumbnails() {
        try {
            // Clear existing thumbnails
            this._thumbnailBox.destroy_all_children();
            this._thumbnails = [];

            const workspace = global.workspace_manager.get_active_workspace();
            if (!workspace) return;

            const windows = workspace.list_windows().filter(w =>
                w && !w.skip_taskbar && w.get_window_type() === Meta.WindowType.NORMAL
            );

            const focusWindow = global.display.focus_window;

            // Add thumbnails for all windows (including active one)
            windows.forEach(window => {
                try {
                    const thumbnail = new WindowThumbnail(window, this._extension, this._panelWidth);
                    // Mark active window
                    if (window === focusWindow) {
                        thumbnail.add_style_class_name('stage-manager-thumbnail-active');
                    }
                    this._thumbnailBox.add_child(thumbnail);
                    this._thumbnails.push(thumbnail);
                } catch (e) {
                    log(`Error creating thumbnail for window: ${e}`);
                }
            });
        } catch (e) {
            log(`Error updating thumbnails: ${e}`);
        }
    }

    destroy() {
        try {
            // Disconnect settings listener
            if (this._resizeHandleWidthChangedId) {
                this._settings.disconnect(this._resizeHandleWidthChangedId);
                this._resizeHandleWidthChangedId = null;
            }
            
            // Disconnect stage handlers
            if (this._stageMotionId) {
                global.stage.disconnect(this._stageMotionId);
                this._stageMotionId = null;
            }
            
            if (this._stageButtonId) {
                global.stage.disconnect(this._stageButtonId);
                this._stageButtonId = null;
            }
            
            this._dragging = false;
            this._extension = null;
            this._settings = null;
            this._thumbnails = [];
            
            if (this._resizeHandle) {
                this._resizeHandle = null;
            }
        } catch (e) {
            log(`Error destroying panel: ${e}`);
        }
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

        // Monitor all windows for size changes
        this._windowSizeChangedIds = [];
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.meta_window;
            if (metaWindow) {
                const id = metaWindow.connect('size-changed', () => {
                    if (this._active) {
                        this._updateLayout();
                    }
                });
                this._windowSizeChangedIds.push({ window: metaWindow, id: id });
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
        try {
            // Disable stage manager if active
            if (this._active) {
                this._deactivateStageManager();
            }

            // Remove keybinding
            try {
                Main.wm.removeKeybinding('toggle-grid');
            } catch (e) {
                log(`Error removing keybinding: ${e}`);
            }

            // Disconnect signals
            if (this._windowCreatedId) {
                try {
                    global.display.disconnect(this._windowCreatedId);
                } catch (e) {
                    log(`Error disconnecting window-created: ${e}`);
                }
                this._windowCreatedId = null;
            }

            if (this._windowFocusId) {
                try {
                    global.display.disconnect(this._windowFocusId);
                } catch (e) {
                    log(`Error disconnecting focus-window: ${e}`);
                }
                this._windowFocusId = null;
            }

            if (this._windowSizeChangedIds) {
                this._windowSizeChangedIds.forEach(({ window, id }) => {
                    try {
                        if (window) {
                            window.disconnect(id);
                        }
                    } catch (e) {
                        log(`Error disconnecting window size-changed: ${e}`);
                    }
                });
                this._windowSizeChangedIds = [];
            }

            if (this._monitorsChangedId) {
                try {
                    Main.layoutManager.disconnect(this._monitorsChangedId);
                } catch (e) {
                    log(`Error disconnecting monitors-changed: ${e}`);
                }
                this._monitorsChangedId = null;
            }

            // Destroy panel
            if (this._panel) {
                try {
                    Main.layoutManager.removeChrome(this._panel);
                    this._panel.destroy();
                } catch (e) {
                    log(`Error destroying panel: ${e}`);
                }
                this._panel = null;
            }
            
            this._settings = null;
            this._originalFrames = null;
            
            log('Obision Extension Grid disabled');
        } catch (e) {
            log(`Critical error in disable: ${e}`);
        }
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
        try {
            if (!this._panel) return;
            
            const monitor = Main.layoutManager.primaryMonitor;
            if (!monitor) return;
            
            const panelHeight = this._getDashPanelHeight();
            
            // Position panel below top dash/panel
            this._panel.set_position(monitor.x, monitor.y + panelHeight.top);
            // Adjust height to fit between top and bottom panels
            this._panel.set_height(monitor.height - panelHeight.top - panelHeight.bottom);
        } catch (e) {
            log(`Error updating panel position: ${e}`);
        }
    }

    _showPanelAnimated() {
        if (!this._panel || this._panel.visible) return;
        
        try {
            const monitor = Main.layoutManager.primaryMonitor;
            if (!monitor) return;
            
            const panelHeight = this._getDashPanelHeight();
            const normalX = monitor.x;
            const hiddenX = normalX - this._panel._panelWidth - this._panel._resizeHandleWidth;
            
            // Start hidden to the left
            this._panel.set_position(hiddenX, monitor.y + panelHeight.top);
            this._panel.show();
            
            // Slide in from left (same animation as unmaximize)
            this._panel.ease({
                x: normalX,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        } catch (e) {
            log(`Error showing panel: ${e}`);
        }
    }

    _hidePanelAnimated() {
        if (!this._panel || !this._panel.visible) return;
        
        try {
            const monitor = Main.layoutManager.primaryMonitor;
            if (!monitor) return;
            
            const hiddenX = monitor.x - this._panel._panelWidth - this._panel._resizeHandleWidth;
            
            // Slide out to the left (same animation as maximize)
            this._panel.ease({
                x: hiddenX,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._panel) {
                        this._panel.hide();
                    }
                },
            });
        } catch (e) {
            log(`Error hiding panel: ${e}`);
        }
    }

    _updateLayout() {
        if (!this._active) return;

        try {
            const focusWindow = global.display.focus_window;
            
            // Check if window is maximized (either horizontally, vertically, or both)
            if (focusWindow && focusWindow.get_maximized() !== 0) {
                this._hidePanelAnimated();
                return;
            } else {
                this._showPanelAnimated();
            }

            // Update thumbnails in panel
            if (this._panel) {
                this._panel.updateThumbnails();
            }

            // Resize and reposition active window
            if (focusWindow && !focusWindow.skip_taskbar && 
                focusWindow.get_window_type() === Meta.WindowType.NORMAL) {
                this._adjustActiveWindow(focusWindow);
            }

            // Minimize or hide other windows (optional based on settings)
            const workspace = global.workspace_manager.get_active_workspace();
            if (!workspace) return;
            
            const windows = workspace.list_windows();
            
            windows.forEach(window => {
                try {
                    if (window !== focusWindow && !window.skip_taskbar &&
                        window.get_window_type() === Meta.WindowType.NORMAL) {
                        // Keep them on workspace but not visible in main area
                        window.minimize();
                    }
                } catch (e) {
                    log(`Error minimizing window: ${e}`);
                }
            });
        } catch (e) {
            log(`Error updating layout: ${e}`);
        }
    }

    _adjustActiveWindow(window) {
        try {
            const monitor = Main.layoutManager.primaryMonitor;
            if (!monitor || !this._panel) return;
            
            // Include resize handle width in total panel width
            const totalPanelWidth = this._panel._panelWidth + this._panel._resizeHandleWidth;
            
            // Save original frame if not already saved
            if (!this._originalFrames.has(window)) {
                this._originalFrames.set(window, window.get_frame_rect());
            }

            // Detect dash/panel height (top or bottom)
            const panelHeight = this._getDashPanelHeight();
            
            // Calculate new frame for active window
            const newX = monitor.x + totalPanelWidth;
            const newY = monitor.y + panelHeight.top;
            const newWidth = monitor.width - totalPanelWidth;
            const newHeight = monitor.height - panelHeight.top - panelHeight.bottom;

            // Move and resize window
            window.unmaximize(Meta.MaximizeFlags.BOTH);
            window.move_resize_frame(false, newX, newY, newWidth, newHeight);
        } catch (e) {
            log(`Error adjusting active window: ${e}`);
        }
    }

    _restoreWindowFrames() {
        try {
            // Restore all windows to their original positions
            this._originalFrames.forEach((frame, window) => {
                try {
                    // Check if window still exists by trying to get its frame
                    if (window) {
                        window.get_frame_rect(); // This will throw if window is destroyed
                        window.move_resize_frame(false, frame.x, frame.y, frame.width, frame.height);
                        if (window.minimized) {
                            window.unminimize();
                        }
                    }
                } catch (e) {
                    // Window is likely destroyed, ignore
                }
            });
            this._originalFrames.clear();
        } catch (e) {
            log(`Error in restoreWindowFrames: ${e}`);
        }
    }

    _onWindowAdded(window) {
        if (!window.skip_taskbar && window.get_window_type() === Meta.WindowType.NORMAL) {
            // Add size-changed listener to new window
            const id = window.connect('size-changed', () => {
                if (this._active) {
                    this._updateLayout();
                }
            });
            
            if (!this._windowSizeChangedIds) {
                this._windowSizeChangedIds = [];
            }
            this._windowSizeChangedIds.push({ window: window, id: id });
            
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
