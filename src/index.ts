import { app, Menu, BrowserWindow, ipcMain, dialog, shell } from 'electron';
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

let accessToken = "";
let accessTokenExpiryDate: Date;
let mainWindow : BrowserWindow;
let _fireBusinessApiClient : FireBusinessApiClient;
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

// Create the Application's main menu
const template = [{
  label: "Edit",
  submenu: [
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
    ]}
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));

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

const initialiseApiClient = function() {
  return api.init<FireBusinessApiClient>();
}

const loadAccounts = function(client: FireBusinessApiClient) {
  return client.getAccounts(null, null,  { headers: { "Authorization": "Bearer " + accessToken }});
}


const api = new OpenAPIClientAxios({ definition: path.join(__dirname, "static/fire-business-api-v1.yml") });

const getClient = function() {
  console.log("Getting client....");
  console.log(store.get("clientId"));

  return new Promise<FireBusinessApiClient>((resolve, reject) => {
    // do we have a client already?
    if (_fireBusinessApiClient != null) {
      // check the expiry on the accessToken
      if (new Date() > accessTokenExpiryDate) {
        getAccessToken(_fireBusinessApiClient).then(result => { 
          resolve(_fireBusinessApiClient); 
        });

      }

      resolve(_fireBusinessApiClient);

    } else if (store.get("clientId").length == 36) {
      // if we have client API tokens, initialise a new client.
      initialiseApiClient().then((client : FireBusinessApiClient) => { 
        // console.log(client);
        _fireBusinessApiClient = client;
        resolve(_fireBusinessApiClient);
      });

    } else {
      // what we doing here dude?
      reject(new Error("No Client available - have you set the API Token?"));
    }
  });
}

const getAccessToken = function(client: FireBusinessApiClient) {
  return new Promise<string>((resolve, reject) => {
    const nonce = Math.floor(new Date().getTime()/1000.0);
    const clientSecret = sha256(nonce + store.get('clientKey'));

    client.authenticate(null, {clientId: store.get('clientId'), clientSecret:  clientSecret, refreshToken: store.get('refreshToken'), nonce: nonce, grantType: "AccessToken"}).then(gatres => { 
      // console.log(gatres);
      accessToken = gatres.data.accessToken;
      accessTokenExpiryDate = new Date(gatres.data.expiry);
      resolve("ok");
    });
  });
}

// try to initialise a new client - don't worry if we don't have API tokens. 
getClient()
  .then(client => { 
    getAccessToken(client).then(result => {});
  }).catch(err => {
    // no problems here. 
  });


ipcMain.on("page-contents-loaded", function (event, arg) {
  
  const apiToken : Configuration = {
    clientId: store.get('clientId'),
    clientKey: store.get('clientKey'),
    refreshToken: store.get('refreshToken')
  };
 
  if (isDev) { console.log(JSON.stringify(store.store)); }

  mainWindow.webContents.send("configs", version, apiToken);   
});



const getTransactions = function(ican: number, fromDate: number, toDate: number, limit: number, offset: number, callback: Function) {
  getClient()
    .then(client => {

    client.getTransactionsFilteredById(
      {ican: ican, dateRangeFrom: fromDate, dateRangeTo: toDate, limit: limit, offset: offset},
      null, 
      { headers: { "Authorization": "Bearer " + accessToken }}
    ).then(res => {
      const total = res.data.total;
      
      transactions.push(...res.data.transactions);

      mainWindow.webContents.send("progress-update", { total: res.data.total, progress: (offset + limit > total ? total : offset + limit) }); 
    
      if (offset + limit < total) {
        getTransactions(ican, fromDate, toDate, limit, offset + limit, callback);
      } else {
        const csv = CreateCsvFile.generate(transactions, true, "filename.csv");
        callback(csv);
      }


    });
  })
  .catch(err => {
    // notify the UI
  });
}

ipcMain.on("get-accounts", function (event, arg) {
  getClient()
    .then(client => {
    loadAccounts(client).then((res) => {
      console.log(typeof res.data);

      if ((res.data as Paths.GetAccounts.Responses.$200).accounts) {
        accounts = (res.data as Paths.GetAccounts.Responses.$200).accounts;
        mainWindow.webContents.send("accounts", accounts, store.get("selectedAccount"));   

      } 
    
    }).catch((err) => {
        // error
        console.error(err);
      
    });
  })
  .catch(err => {
    // notify the UI
  });
});



ipcMain.on("save-configuration", function (event, arg) {
  const configs : Configuration = arg.configs;
  store.set({
    clientId: configs.clientId,
    clientKey: configs.clientKey,
    refreshToken: configs.refreshToken
  });

  getClient()
    .then(client => { 
      getAccessToken(client).then(result => {
        mainWindow.webContents.send("configuration-saved", true);
      });
    })
    .catch(err => {
      // notify the UI
    });

});

//ipcMain.on will receive the “btnclick” info from renderprocess 
ipcMain.on("run-report", function (event, arg) {
  // blank the array each time
  transactions = [];

  store.set("selectedAccount", arg.ican);

  const fromDate = new Date(arg.fromDate + 'T00:00:00').getTime();
  const toDate = new Date(arg.toDate + 'T23:59:59').getTime();
  
  const offset = 0;
  const limit = 50;

  getTransactions(arg.ican, fromDate, toDate, limit, offset, function(csv : string) {
    fs.writeFileSync(path.join(app.getPath("userData"), "report.csv"), csv);
    const savePath:string = dialog.showSaveDialogSync({ 
      title: "Save Report As...", 
      defaultPath: path.join(store.get('savePath'), "fire-report-"+arg.fromDate.replace(/-/gi, "")+"-"+arg.toDate.replace(/-/gi, "")+".csv")
    });

    if (savePath != undefined) {
      // save this directory as the default going foward
      store.set("savePath", path.dirname(savePath));

      try {
        fs.copyFileSync(
          path.join(app.getPath("userData"), "report.csv"), 
          savePath
        );
      } catch (err) {
        console.log(err);
      }

      fs.rmSync(path.join(app.getPath("userData"), "report.csv"));

      shell.showItemInFolder(savePath);
    }

  });
  

});
