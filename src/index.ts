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
    savePath: app.getPath("downloads"),
    betaAgreementDate: null
  }
});

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let accessToken = "";
let accessTokenExpiryDate: Date;
let mainWindow : BrowserWindow;
let _fireBusinessApiClient : FireBusinessApiClient;
let mAccounts : Components.Schemas.Account[] = [];
let mCopyOfAccounts : Components.Schemas.Account[] = [];
let mTransactions:Components.Schemas.Transaction[] = [];

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  Bugsnag.notify("Loaded");
  
  // Open the DevTools.
  if (isDev) { mainWindow.webContents.openDevTools(); }
};

// Create the Application's main menu
const template = [{
  label: "Fire Report Utility",
  submenu: [
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      { type: "separator" },
      { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
    ]}
];

if (process.platform == 'darwin') {
  // MacOS needs to have the copy/paste menu items, otherwise Cmd-C/Cmd-V don't work. 
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
} else {
  Menu.setApplicationMenu(null);
}


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

  mainWindow.webContents.send("configs", version, (store.get("betaAgreementDate") ? false : true ), apiToken);   
});


ipcMain.on("beta-agreement", function (event, arg) {
  store.set("betaAgreementDate", new Date().toISOString());
});


ipcMain.on("get-accounts", function (event, arg) {
  getClient()
    .then(client => {
    loadAccounts(client).then((res) => {
      console.log(typeof res.data);

      if ((res.data as Paths.GetAccounts.Responses.$200).accounts) {
        mAccounts = (res.data as Paths.GetAccounts.Responses.$200).accounts;
        mainWindow.webContents.send("accounts", mAccounts, store.get("selectedAccount"));   

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

const getTransactions = function(client: FireBusinessApiClient, ican: number, fromDate: number, toDate: number, limit: number, offset: number, callback: Function) {
  
  client.getTransactionsFilteredById(
    {ican: ican, dateRangeFrom: fromDate, dateRangeTo: toDate, limit: limit, offset: offset},
    null, 
    { headers: { "Authorization": "Bearer " + accessToken }}
  ).then(res => {
    let total = res.data.total;

    // this mTransacions is building up across all accounts, not being blanked between each one.
    mTransactions.push(...res.data.transactions);

    mainWindow.webContents.send("progress-update", { 
      total: res.data.total, 
      progress: (offset + limit > total ? total : offset + limit)
    }); 
  
    if (offset + limit < total) {
      getTransactions(client, ican, fromDate, toDate, limit, offset + limit, callback);
    } else {

      let csv:string = CreateCsvFile.generate(mTransactions, true, "filename.csv");
      callback(csv);
    }


  });

}

const saveFile = function(csv : string, filename: string) {
  fs.writeFileSync(path.join(app.getPath("userData"), "report.csv"), csv);
  const savePath:string = dialog.showSaveDialogSync({ 
    title: "Save Report As...", 
    defaultPath: path.join(store.get('savePath'), filename)
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

}

const getTransactionsForAllAccounts = function(client:FireBusinessApiClient, fromDate: number, toDate: number, limit: number, offset: number, callback: Function) { 

  let thisAccount: Components.Schemas.Account = mCopyOfAccounts.shift();
  getTransactions(client, thisAccount.ican, fromDate, toDate, limit, offset, function(csv: string) {

    mainWindow.webContents.send("progress-update-accounts", { 
      totalNumAccounts: mAccounts.length, 
      accountsProcessed: mAccounts.length - mCopyOfAccounts.length
    }); 

    if (mCopyOfAccounts.length > 0) {
      getTransactionsForAllAccounts(client, fromDate, toDate, limit, offset, callback);

    } else {
      callback(csv);
    }
    
  });
}

//ipcMain.on will receive the “btnclick” info from renderprocess 
ipcMain.on("run-report", function (event, arg) {
  // blank the array each time
  mTransactions = [];
  const fromDate = new Date(arg.fromDate + 'T00:00:00').getTime();
  const toDate = new Date(arg.toDate + 'T23:59:59').getTime();
  const offset = 0;
  const limit = 50;

  if (arg.ican == "all") {
    // report on all accounts
    // take a deep copy of the mAccounts. 
    mCopyOfAccounts = [...mAccounts];

    getClient().then(client => {
      getTransactionsForAllAccounts(client, fromDate, toDate, limit, offset, function(csv: string) {
        saveFile(csv, "fire-report-"+arg.fromDate.replace(/-/gi, "")+"-"+arg.toDate.replace(/-/gi, "")+".csv");
      });
    });

  } else {
    // single account
    store.set("selectedAccount", arg.ican);
    getClient().then(client => {
      getTransactions(client, arg.ican, fromDate, toDate, limit, offset, function(csv: string) {
        saveFile(csv, "fire-report-"+arg.fromDate.replace(/-/gi, "")+"-"+arg.toDate.replace(/-/gi, "")+".csv");
      });
    });
  }



});
