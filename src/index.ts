import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { Client as FireBusinessApiClient, Components, Paths } from './types/fire-business-api';
import sha256 from 'sha256';
import { OpenAPIClientAxios, AxiosResponse } from 'openapi-client-axios';
import CreateCsvFile from './csv-format';
import Store from 'electron-store';
import updater from 'update-electron-app';
import isDev from 'electron-is-dev';
import Bugsnag from '@bugsnag/js'
import { version } from './../package.json';

Bugsnag.start({
  apiKey: '1019927431ee232b19a6834177aa5273',
  appVersion: version
})

updater();

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
    selectedAccount: null,
    savePath: app.getPath("downloads")
  }
});

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let accessToken :string = "";
let mainWindow : BrowserWindow;
let client : FireBusinessApiClient;
let accounts : Components.Schemas.Account[] = [];
let transactions:Components.Schemas.Transaction[] = [];

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.

  mainWindow = new BrowserWindow({
    height: 600,
    width: 400,
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

  Bugsnag.notify("Loaded");
  
  // Open the DevTools.
  if (isDev) { mainWindow.webContents.openDevTools(); }
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

var initialiseApiClient = function() {
  return api.init<FireBusinessApiClient>();
}

var getAccessToken = function() {
  var nonce = Math.floor(new Date().getTime()/1000.0);
  var clientSecret = sha256(nonce + store.get('clientKey'));

  return client.authenticate(null, {clientId: store.get('clientId'), clientSecret:  clientSecret, refreshToken: store.get('refreshToken'), nonce: nonce, grantType: "AccessToken"});
};

var loadAccounts = function() {
  return client.getAccounts(null, null,  { headers: { "Authorization": "Bearer " + accessToken }});
}


const api = new OpenAPIClientAxios({ definition: path.join(__dirname, "static/fire-business-api-v1.yml") });

if (store.get("clientId").length == 36) {
  initialiseApiClient().then((c : FireBusinessApiClient) => { 
    console.log(c);
    client = c;

    getAccessToken().then(gatres => { 
      console.log(gatres);
      accessToken = gatres.data.accessToken;
    });

  });
}

ipcMain.on("page-contents-loaded", function (event, arg) {
  
  var apiToken : Configuration = {
    clientId: store.get('clientId'),
    clientKey: store.get('clientKey'),
    refreshToken: store.get('refreshToken')
  };
 
  if (isDev) { console.log(JSON.stringify(store.store)); }

  mainWindow.webContents.send("configs", apiToken);   
});



let getTransactions = function(ican: number, fromDate: number, toDate: number, limit: number, offset: number, callback: Function) {
  client.getTransactionsFilteredById(
    {ican: ican, dateRangeFrom: fromDate, dateRangeTo: toDate, limit: limit, offset: offset},
    null, 
    { headers: { "Authorization": "Bearer " + accessToken }}
  ).then(res => {
    var total = res.data.total;
    
    transactions.push(...res.data.transactions);

    mainWindow.webContents.send("progress-update", { total: res.data.total, progress: (offset + limit > total ? total : offset + limit) }); 
  
    if (offset + limit < total) {
      getTransactions(ican, fromDate, toDate, limit, offset + limit, callback);
    } else {
      var csv = CreateCsvFile.generate(transactions, true, "filename.csv");
      callback(csv);
    }


  });
}

ipcMain.on("get-accounts", function (event, arg) {
  loadAccounts().then((res) => {
    console.log(typeof res.data);

    if ((res.data as Paths.GetAccounts.Responses.$200).accounts) {
      accounts = (res.data as Paths.GetAccounts.Responses.$200).accounts;
      mainWindow.webContents.send("accounts", accounts, store.get("selectedAccount"));   

    } 
   
  }).catch((err) => {
      // error
      console.error(err);
    
  })
});



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
  // blank the array each time
  transactions = [];

  store.set("selectedAccount", arg.ican);

  var fromDate = new Date(arg.fromDate + 'T00:00:00').getTime();
  var toDate = new Date(arg.toDate + 'T23:59:59').getTime();
  
  var offset = 0;
  var limit = 50;

  getTransactions(arg.ican, fromDate, toDate, limit, offset, function(csv : string) {
    fs.writeFileSync(path.join(app.getPath("userData"), "report.csv"), csv);
    var savePath:string = dialog.showSaveDialogSync({ 
      title: "Save Report As...", 
      defaultPath: path.join(store.get('savePath'), "fire-report-"+arg.fromDate.replace("-", ".")+"-"+arg.toDate.replace("-", ".")+".csv")
    });

    if (savePath != undefined) {
      // save this directory as the default going foward
      store.set("savePath", path.dirname(savePath));

      fs.copyFileSync(
        path.join(app.getPath("userData"), "report.csv"), 
        savePath
      );

      fs.rmSync(path.join(app.getPath("userData"), "report.csv"));
    }

  });
  

});
