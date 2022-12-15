import {
    contextBridge,
    ipcRenderer
} from 'electron';

console.log("in the preload...");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        send: (channel : string, data : any) => {
            // whitelist channels
            let validChannels = ["page-contents-loaded", "run-report", "save-configuration", "get-accounts", "beta-agreement", "stop-report"];
            if (validChannels.includes(channel)) {
                console.log(`Sending a message to ${channel}...`);
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel : string, func : Function) => {
            let validChannels = ["configs", "run-report-finished", "progress-update", "progress-update-accounts", "configuration-saved", "accounts"];
            if (validChannels.includes(channel)) {
                console.log(`Setting up a listener on ${channel}`);
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
);


