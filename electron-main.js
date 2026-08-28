const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 950,
        minHeight: 650,
        title: "AttendEase - Offline Attendance Management System",
        icon: path.join(__dirname, 'www', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: false,
        show: false
    });

    // Load the web app from www folder
    mainWindow.loadFile(path.join(__dirname, 'www', 'index.html'));

    // Show window smoothly when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Create desktop application menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reload App',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                { type: 'separator' },
                {
                    label: 'Exit AttendEase',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'togglefullscreen', label: 'Toggle Full Screen', accelerator: 'F11' },
                { role: 'resetZoom', label: 'Actual Size' },
                { role: 'zoomIn', label: 'Zoom In' },
                { role: 'zoomOut', label: 'Zoom Out' },
                { type: 'separator' },
                { role: 'toggleDevTools', label: 'Developer Tools' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About AttendEase',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About AttendEase',
                            message: 'AttendEase v1.0.0',
                            detail: 'Offline Attendance Management System\nSupports Windows Desktop & Android Mobile.',
                            buttons: ['OK']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
