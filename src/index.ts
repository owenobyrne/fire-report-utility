import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { Client as FireBusinessApiClient, Components } from './types/fire-business-api';
import sha256 from 'sha256';
import OpenAPIClientAxios from 'openapi-client-axios';
import CreateCsvFile from './csv-format';
import Store from 'electron-store';

const store = new Store({
  migrations: {
    '1.0.0': store => {
      store.set('version', '1.0.0');
    }
  },
  defaults: {
    clientId: '',
    clientKey: '',
    refreshToken: '',
    savePath: app.getPath("downloads")
  }
});

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let accessToken = "";
let mainWindow : BrowserWindow;
let client : FireBusinessApiClient;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.

  mainWindow = new BrowserWindow({
    height: 1200,
    width: 1600,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      // In a sandbox
      sandbox: true,
      // Allow Ipc to/from sandbox
      contextIsolation: true,
      enableRemoteModule: false, // turn off remote
      // No insecure code.
      webSecurity: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const api = new OpenAPIClientAxios({ definition: 'fire-business-api-v1.yml' });



ipcMain.on("page-contents-loaded",async function (event, arg) {
  console.log("I'm told the page is loaded");
  
  var apiToken : Configuration = {
    clientId: store.get('clientId'),
    clientKey: store.get('clientKey'),
    refreshToken: store.get('refreshToken')
  };
 
  console.log(store.store);
  mainWindow.webContents.send("configs", apiToken); 
  client = await api.init<FireBusinessApiClient>();
  
});

var transactions:Components.Schemas.Transaction[] = [];

let getTransactions = function(fromDate: number, toDate: number, limit: number, offset: number, callback: Function) {
  // need to manually edit the type file to allow limit and offset. (Components.Parameters.LimitParam & Components.Parameters.OffsetParam & )
  client.getTransactionsFilteredById(
    {ican: 2150, dateRangeFrom: fromDate, dateRangeTo: toDate, limit: limit, offset: offset},
    null, 
    { headers: { "Authorization": "Bearer " + accessToken }}
  ).then(res => {
    var total = res.data.total;

    console.log(JSON.stringify(res.data.transactions));
    
    transactions.push(...res.data.transactions);

    mainWindow.webContents.send("progress-update", { total: res.data.total, progress: (offset + limit > total ? total : offset + limit) }); 
  
    if (offset + limit < total) {
      getTransactions(fromDate, toDate, limit, offset + limit, callback);
    } else {
      CreateCsvFile.generate(transactions, true, "filename.csv");
      callback();
    }


  });
}

ipcMain.on("save-configuration", function (event, arg) {
  let configs : Configuration = arg.configs;
  store.set({
    clientId: configs.clientId,
    clientKey: configs.clientKey,
    refreshToken: configs.refreshToken
  });
  mainWindow.webContents.send("configuration-saved", true);
});

//ipcMain.on will receive the “btnclick” info from renderprocess 
ipcMain.on("run-report", function (event, arg) {
  var fromDate = new Date(arg.fromDate + 'T00:00:00').getTime();
  var toDate = new Date(arg.toDate + 'T23:59:59').getTime();

  var nonce = Math.floor(new Date().getTime()/1000.0);
  var clientSecret = sha256(nonce + store.get('clientKey'));
  
  var offset = 0;
  var limit = 50;

  client.authenticate(null, {clientId: store.get('clientId'), clientSecret:  clientSecret, refreshToken: store.get('refreshToken'), nonce: nonce, grantType: "AccessToken"})
    .then(res => { 
        accessToken = res.data.accessToken; 

        getTransactions(fromDate, toDate, limit, offset, function() {
          var savePath:string = dialog.showSaveDialogSync({ 
            title: "Save Report As...", 
            defaultPath: path.join(store.get('savePath'), "fire-report-"+arg.fromDate.replace("-", ".")+"-"+arg.toDate.replace("-", ".")+".csv")
          });

          console.log(savePath);
        });
        

    });

});
