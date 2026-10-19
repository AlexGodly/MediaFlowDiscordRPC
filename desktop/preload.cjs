'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const methods=['getState','saveConfig','setMode','updateManual','savePreset','applyPreset','deletePreset','getBrowsers','getPwas','openEdition','installPwa','openExtensions','selectImage','openExternal','setStartup','checkUpdates','getDiagnostics','resetSettings','pause','resume','restartBridge'];
const bridge={};
for(const name of methods)bridge[name]=(...args)=>ipcRenderer.invoke('studio:'+name,...args);
bridge.subscribe=callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('studio:state',listener);return()=>ipcRenderer.removeListener('studio:state',listener);};
contextBridge.exposeInMainWorld('studio',Object.freeze(bridge));
