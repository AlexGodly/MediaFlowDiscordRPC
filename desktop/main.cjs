'use strict';
const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,dialog,shell,Notification}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net'),crypto=require('node:crypto'),os=require('node:os');
const {spawn,execFile}=require('node:child_process');
const {EDITIONS,DEFAULTS,merge,compile,parseWire}=require('./core.cjs');
const {Catalog,MAX_BYTES}=require('./catalog.cjs');
const PORT=17372,APP='MediaFlow Presence Studio';
let window=null,tray=null,server=null,exiting=false,config=merge(DEFAULTS,{}),active=null,diagnostics=[],recent=[],bridgeStatus='Not started',configFile='';
let discord=null,catalog=null,lastExtensionContact=0,selectionPolicy='active';
function log(message){const line=new Date().toLocaleTimeString()+' · '+message;diagnostics.unshift(line);diagnostics=diagnostics.slice(0,120);notify();}
function load(){configFile=path.join(app.getPath('userData'),'presence-studio.json');try{config=merge(DEFAULTS,JSON.parse(fs.readFileSync(configFile,'utf8')));}catch{config=merge(DEFAULTS,{});}}
function save(){try{fs.mkdirSync(path.dirname(configFile),{recursive:true});fs.writeFileSync(configFile,JSON.stringify(config,null,2),'utf8');}catch(e){log('Could not save settings: '+e.message);}}
function isValidId(s){return /^\d{15,25}$/.test(String(s||'').trim());}
function currentEntry(){if(config.mode==='manual')return {...config.manual,edition:config.manual.edition||'personal',view:'details'};return active;}
function rendered(){return compile(currentEntry(),config);}
function state(){return {version:'20.507',config,editions:EDITIONS,active,preview:rendered(),recent,catalogSummary:catalog?catalog.meta:{personal:null,plus:null},discord:{connected:!!discord&&discord.ready,status:discord?discord.status:'Starting',error:discord?.error||''},bridge:{status:bridgeStatus,port:PORT,extensionConnected:Date.now()-lastExtensionContact<20000,lastContact:lastExtensionContact},diagnostics:diagnostics.slice(0,75)};}
function notify(){if(window&&!window.isDestroyed())window.webContents.send('studio:state',state());refreshTray();}
function applyPresence(){if(discord)discord.setActivity(rendered());notify();}
function setConfig(partial){const oldId=config.applicationId,oldMode=config.mode;config=merge(config,partial);if(oldMode!=='manual'&&config.mode==='manual')config.manual.startedAt=Date.now();save();if(discord&&oldId!==config.applicationId){discord.socket?.destroy();discord.disconnect('Discord Application ID updated — reconnecting');}applyPresence();return state();}
function emitNotification(title,body){if(!config.notifications||!Notification.isSupported())return;new Notification({title,body}).show();}
class DiscordIpc{
 constructor(){this.socket=null;this.ready=false;this.status='Not connected';this.error='';this.buffer=Buffer.alloc(0);this.pending=null;this.lastSent='';this.lastAt=0;this.connecting=false;this.interval=setInterval(()=>this.tick(),5000);}
 setActivity(p){this.pending=p;this.sendIfReady();}
 close(){clearInterval(this.interval);try{this.socket?.destroy();}catch{}}
 tick(){if(!this.ready&&!this.connecting&&isValidId(config.applicationId))this.connect();else if(this.ready)this.sendIfReady();}
 connect(){if(!isValidId(config.applicationId)){this.status='Enter your Discord Application ID';notify();return;}
  if(this.connecting||this.ready)return;this.connecting=true;this.status='Connecting to Discord…';this.error='';notify();
  this.tryPipe(0);
 }
 tryPipe(index){if(index>9){this.connecting=false;this.ready=false;this.status='Waiting for Discord desktop';notify();return;}
  const socket=net.connect('\\\\.\\pipe\\discord-ipc-'+index);
  let connected=false;
  const fail=()=>{if(connected)return;connected=true;socket.destroy();this.tryPipe(index+1);};
  socket.once('error',err=>{if(this.socket===socket){this.socket=null;this.disconnect(err.message);}else fail();});
  socket.once('connect',()=>{
   if(connected)return;connected=true;this.socket=socket;this.buffer=Buffer.alloc(0);
   socket.on('data',data=>this.onData(data));
   socket.on('close',()=>{if(this.socket===socket){this.socket=null;this.disconnect('Discord IPC disconnected');}});
   this.frame(0,{v:1,client_id:String(config.applicationId).trim()});
  });
 }
 disconnect(reason){this.ready=false;this.connecting=false;this.status='Waiting for Discord desktop';this.error=reason||'';notify();}
 frame(op,obj){if(!this.socket||this.socket.destroyed)return;const body=Buffer.from(JSON.stringify(obj),'utf8');const header=Buffer.alloc(8);header.writeUInt32LE(op,0);header.writeUInt32LE(body.length,4);this.socket.write(Buffer.concat([header,body]));}
 onData(data){this.buffer=Buffer.concat([this.buffer,data]);while(this.buffer.length>=8){const op=this.buffer.readUInt32LE(0),len=this.buffer.readUInt32LE(4);if(len>4*1024*1024){this.socket?.destroy();return;}if(this.buffer.length<8+len)return;const raw=this.buffer.subarray(8,8+len).toString();this.buffer=this.buffer.subarray(8+len);
  let msg={};try{msg=JSON.parse(raw);}catch{}
  if(op===2||op===1&&msg.evt==='ERROR'){this.error=JSON.stringify(msg.data||msg).slice(0,300);log('Discord RPC response: '+this.error);continue;}
  if(op===1&&(msg.evt==='READY'||msg.cmd==='DISPATCH'&&msg.evt==='READY')){this.ready=true;this.connecting=false;this.status='Connected to Discord';this.lastSent='';log('Discord connected');emitNotification('MediaFlow Presence Studio','Connected to Discord desktop');this.sendIfReady();}
 }}
 sendIfReady(){if(!this.ready||!this.socket||!isValidId(config.applicationId))return;
  const data=this.pending?JSON.stringify(this.pending):'null';
  if(data===this.lastSent)return;
  const now=Date.now();
  // Avoid excessive activity updates that Discord may rate-limit.
  if(now-this.lastAt<15000)return;
  this.frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:this.pending||null},nonce:crypto.randomUUID()});
  this.lastSent=data;this.lastAt=now;this.status=this.pending?'Rich Presence active':'Presence cleared';notify();
 }
}
function allowedOrigin(origin){if(!origin)return true;return /^(chrome-extension|edge-extension):\/\/[a-z0-9-]+$/i.test(origin)||origin==='https://alexgodly.github.io';}
function bridge(){
 server=http.createServer((req,res)=>{
  const origin=req.headers.origin||'';
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  if(!allowedOrigin(origin)){res.writeHead(403);return res.end('Origin denied');}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204);return res.end();}
  if(req.method==='GET'&&req.url==='/catalog-policy'){
    res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.end(JSON.stringify({enabled:!!config.librarySync?.enabled,max:120000,chunkSize:250}));
  }
  if(req.method==='POST'&&req.url==='/catalog'){
    if(!config.librarySync?.enabled){res.writeHead(403);return res.end('Catalogue permission disabled');}
    res.setHeader('Content-Type','application/json; charset=utf-8');
    let size=0,chunks=[],failed=false;
    req.on('data',part=>{size+=part.length;if(size>MAX_BYTES){failed=true;req.destroy();return;}chunks.push(part)});
    req.on('end',()=>{if(failed)return;
      try{
        const p=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!['personal','plus'].includes(p.edition))throw Error('Invalid edition');
        const response=p.phase==='begin'?catalog.begin(p):
          p.phase==='chunk'?catalog.chunk(p):
          p.phase==='end'?catalog.finish(p):
          (()=>{throw Error('Invalid catalogue phase')})();
        if(p.phase==='end'){log('Catalog synced: '+p.edition+' ('+response.count+' titles)');notify();}
        res.end(JSON.stringify(response));
      }catch(err){res.writeHead(400);res.end(JSON.stringify({ok:false,error:err.message}));}
    });return;
  }
  if(req.method==='GET'&&req.url==='/health')return res.end('MediaFlow Presence Studio v20.507 is running');
  if(req.method==='GET'&&req.url==='/policy'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({priority:config.editionPriority,fixedEdition:config.fixedEdition,mode:config.mode}));}
  if(req.method==='GET'&&req.url==='/status')return res.end(JSON.stringify({bridge:bridgeStatus,discord:discord?.status,edition:active?.edition,activity:active?.details,version:'20.507'},null,2));
  if(req.method!=='POST'||req.url!=='/presence'){res.writeHead(404);return res.end('Not found');}
  let size=0,chunks=[];
  req.on('data',part=>{size+=part.length;if(size>32768){req.destroy();return;}chunks.push(part);});
  req.on('end',()=>{
   const parsed=parseWire(Buffer.concat(chunks).toString('utf8'));if(!parsed){res.writeHead(400);return res.end('Invalid MF5 message');}
   lastExtensionContact=Date.now();
   if(parsed.kind==='clear'){active=null;log('Browser activity cleared');}
   else{
    const previous=active;
    active=parsed.entry;active.source=active.source||'extension';
    const same=previous&&previous.edition===active.edition&&previous.title===active.title&&previous.view===active.view&&previous.action===active.action;
    active.startedAt=same?previous.startedAt||Date.now():Date.now();
    const title=active.title||active.details;
    if(title&&!recent.some(x=>x.title===title&&x.edition===active.edition))recent=[{title,edition:active.edition,cover:active.largeImage,action:active.action,at:Date.now()},...recent].slice(0,45);
   }
   applyPresence();res.writeHead(200);res.end('OK');
  });
 });
 server.on('error',err=>{bridgeStatus='Bridge error: '+err.message;log(bridgeStatus);});
 server.listen(PORT,'127.0.0.1',()=>{bridgeStatus='Listening on 127.0.0.1:'+PORT;log('Browser bridge ready');});
}
function asset(name){return path.join(__dirname,'assets',name);}
function createWindow(){
 window=new BrowserWindow({width:1440,height:900,minWidth:740,minHeight:600,show:false,backgroundColor:'#0e101d',title:APP,autoHideMenuBar:true,icon:asset('mediaflow.png'),
 webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.once('ready-to-show',()=>window?.show());
 window.on('close',event=>{if(!exiting&&config.launcher.minimizeToTray){event.preventDefault();window.hide();}});
 window.on('closed',()=>{window=null;});
 window.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
 const dev=process.env.MEDIAFLOW_STUDIO_DEV_URL;
 if(dev&&/^http:\/\/127\.0\.0\.1:5173/.test(dev))window.loadURL(dev);
 else window.loadFile(path.join(__dirname,'renderer-dist','index.html'));
 window.webContents.on('did-finish-load',notify);
}
function show(){if(!window||window.isDestroyed())createWindow();window.show();window.focus();}
function refreshTray(){if(!tray)return;tray.setToolTip(APP+' — '+(discord?.status||'Starting'));}
function createTray(){
 tray=new Tray(asset('mediaflow.ico'));
 const menu=()=>Menu.buildFromTemplate([
  {label:'Open Presence Studio',click:show},
  {label:'Open MediaFlow Personal',click:()=>shell.openExternal(EDITIONS.personal.url)},
  {label:'Open MediaFlow Plus',click:()=>shell.openExternal(EDITIONS.plus.url)},
  {type:'separator'},
  {label:'Automatic Presence',type:'radio',checked:config.mode==='automatic',click:()=>setConfig({mode:'automatic'})},
  {label:'Manual Presence',type:'radio',checked:config.mode==='manual',click:()=>setConfig({mode:'manual'})},
  {label:'Disable Presence',type:'radio',checked:config.mode==='off',click:()=>setConfig({mode:'off'})},
  {type:'separator'},
  ...(config.presets||[]).slice(0,10).map(p=>({label:'Preset: '+p.name,click:()=>setConfig({...p.config,presets:config.presets})})),
  {label:'Reconnect Discord',click:()=>{discord?.socket?.destroy();discord?.disconnect('Reconnecting');}},
  {label:'Exit Presence Studio',click:()=>{exiting=true;app.quit();}}
 ]);
 tray.on('click',show);tray.on('right-click',()=>tray.popUpContextMenu(menu()));
 refreshTray();
}
function findBrowser(name){
 const pf=process.env.PROGRAMFILES||'C:\\Program Files',pf86=process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)',local=process.env.LOCALAPPDATA||'';
 const locations={
 chrome:[path.join(pf,'Google/Chrome/Application/chrome.exe'),path.join(pf86,'Google/Chrome/Application/chrome.exe'),path.join(local,'Google/Chrome/Application/chrome.exe')],
 edge:[path.join(pf86,'Microsoft/Edge/Application/msedge.exe'),path.join(pf,'Microsoft/Edge/Application/msedge.exe')],
 brave:[path.join(pf,'BraveSoftware/Brave-Browser/Application/brave.exe'),path.join(pf86,'BraveSoftware/Brave-Browser/Application/brave.exe'),path.join(local,'BraveSoftware/Brave-Browser/Application/brave.exe')]
 };
 return (locations[name]||[]).find(f=>fs.existsSync(f))||null;
}
function browsers(){return ['chrome','edge','brave'].map(id=>({id,name:id==='chrome'?'Google Chrome':id==='edge'?'Microsoft Edge':'Brave',installed:!!findBrowser(id)}));}
function browserLaunch(url,id){const executable=findBrowser(id);if(executable){spawn(executable,[url],{detached:true,stdio:'ignore'}).unref();return true;}shell.openExternal(url);return false;}
function pwaShortcuts(){
 return new Promise(resolve=>{
  if(process.platform!=='win32')return resolve([]);
  const script='$s=New-Object -ComObject WScript.Shell; $p=@($env:APPDATA+"\\Microsoft\\Windows\\Start Menu\\Programs",$env:ProgramData+"\\Microsoft\\Windows\\Start Menu\\Programs"); Get-ChildItem -Path $p -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "MediaFlow" } | ForEach-Object { $l=$s.CreateShortcut($_.FullName); [pscustomobject]@{name=$_.Name;path=$_.FullName;target=$l.TargetPath;arguments=$l.Arguments} } | ConvertTo-Json -Compress';
  execFile('powershell.exe',['-NoProfile','-Command',script],{timeout:9000,maxBuffer:80000},(err,stdout)=>{
   if(err||!stdout.trim())return resolve([]);
   try{const v=JSON.parse(stdout);resolve((Array.isArray(v)?v:[v]).filter(x=>/MediaFlow/i.test(x.name||'')).slice(0,30));}catch{resolve([]);}
  });
 });
}
async function openEdition(edition,target='website',browserId){
 if(!EDITIONS[edition])return {ok:false,error:'Unknown edition'};
 const selected=browserId||config.launcher.browser;
 if(target==='pwa'){
  const list=await pwaShortcuts();
  const match=list.find(x=>edition==='plus'?/plus/i.test(x.name):!/plus/i.test(x.name));
  if(match&&fs.existsSync(match.path)){spawn('explorer.exe',[match.path],{detached:true,stdio:'ignore'}).unref();return {ok:true,target:'pwa'};}
  browserLaunch(EDITIONS[edition].url,selected);return {ok:true,target:'website',warning:'Installed PWA shortcut not found; opened website instead.'};
 }
 browserLaunch(EDITIONS[edition].url,selected);return {ok:true,target:'website'};
}
function selectImage(){
 return dialog.showOpenDialog(window,{title:'Choose image',properties:['openFile'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp','gif']}]})
 .then(result=>{
  if(result.canceled||!result.filePaths[0])return null;
  const file=result.filePaths[0],stats=fs.statSync(file);if(stats.size>16*1024*1024)throw Error('Image is larger than 16 MB');
  const dir=path.join(app.getPath('userData'),'artwork');fs.mkdirSync(dir,{recursive:true});
  const dest=path.join(dir,crypto.randomUUID()+path.extname(file).toLowerCase());fs.copyFileSync(file,dest);
  return {path:dest,url:'file:///'+dest.replace(/\\/g,'/'),name:path.basename(file),forDiscord:false,note:'Local files preview in Studio. Discord requires a hosted HTTPS image or registered asset.'};
 });
}
function attach(){
 const on=(name,handler)=>ipcMain.handle('studio:'+name,async(_, ...args)=>handler(...args));
 on('getState',()=>state());
 on('saveConfig',value=>setConfig(value||{}));
 on('setMode',mode=>setConfig({mode:['off','manual','automatic'].includes(mode)?mode:'automatic',manual:{startedAt:Date.now()}}));
 on('updateManual',m=>setConfig({manual:{...config.manual,...m}}));
 on('savePreset',preset=>{const id=crypto.randomUUID(),p={id,name:String(preset.name||'Preset').slice(0,80),config:merge(DEFAULTS,preset.config||config)};return setConfig({presets:[...config.presets,p].slice(-80)});});
 on('deletePreset',id=>setConfig({presets:config.presets.filter(x=>x.id!==id)}));
 on('applyPreset',id=>{const p=config.presets.find(x=>x.id===id);return p?setConfig({...p.config,presets:config.presets}):state();});
 on('searchCatalog',request=>catalog.search(request||{}));
 on('clearCatalog',edition=>{const result=catalog.clear(edition);notify();return result;});
 on('getBrowsers',()=>browsers());
 on('getPwas',()=>pwaShortcuts());
 on('openEdition',(edition,target,browser)=>openEdition(edition,target,browser));
 on('installPwa',(edition,browser)=>{if(!EDITIONS[edition])return {ok:false};browserLaunch(EDITIONS[edition].url,browser||config.launcher.browser);return {ok:true,guide:'Use the browser Install app control in the address bar or menu; approval is required.'};});
 on('prepareExtension',async browser=>{
  const bundled=path.join(process.resourcesPath,'mediaflow-extension');
  if(!fs.existsSync(path.join(bundled,'manifest.json')))throw Error('Bundled extension missing from this build');
  const target=path.join(app.getPath('userData'),'BrowserExtension');
  fs.mkdirSync(target,{recursive:true});fs.cpSync(bundled,target,{recursive:true,force:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8'));
  const selected=browser||config.launcher.browser;
  const browserName=selected==='edge'?'Edge':selected==='brave'?'Brave':'Chrome';
  const exe=findBrowser(selected);if(exe){spawn(exe,[selected==='edge'?'edge://extensions/':'chrome://extensions/'],{detached:true,stdio:'ignore'}).unref();}
  shell.showItemInFolder(path.join(target,'manifest.json'));
  return {ok:true,path:target,version:manifest.version,guide:'Extension folder prepared: '+target+' . In '+browserName+', enable Developer mode and select Load unpacked, then choose this folder. Chrome does not allow silent unpacked-extension installation.'};
 });
 on('openExtensions',browser=>{const b=browser||config.launcher.browser;const url=b==='edge'?'edge://extensions/':'chrome://extensions/';const exe=findBrowser(b);if(exe){spawn(exe,[url],{detached:true,stdio:'ignore'}).unref();return {ok:true};}return {ok:false,error:'Please open your browser extension settings manually.'};});
 on('selectImage',()=>selectImage());
 on('openExternal',url=>{if(typeof url==='string'&&/^https:\/\//.test(url)){shell.openExternal(url);return {ok:true};}return {ok:false};});
 on('setStartup',enabled=>{app.setLoginItemSettings({openAtLogin:!!enabled,path:process.env.PORTABLE_EXECUTABLE_FILE||process.execPath});return setConfig({launcher:{startWithWindows:!!enabled}});});
 on('checkUpdates',async()=>{
  const check=async url=>{try{const res=await fetch(url,{signal:AbortSignal.timeout(8000)});return res.ok?(await res.text()).trim():'unknown';}catch{return 'unavailable';}};
  const [personal,plus]=await Promise.all([check('https://raw.githubusercontent.com/AlexGodly/MediaFlow/main/VERSION'),check('https://raw.githubusercontent.com/AlexGodly/MediaFlowPlus/main/VERSION')]);
  let studio='unavailable';try{const res=await fetch('https://api.github.com/repos/AlexGodly/MediaFlowDiscordRPC/releases/latest',{headers:{'User-Agent':APP},signal:AbortSignal.timeout(8000)});if(res.ok){studio=(await res.json()).tag_name;}}catch{}
  return {personal,plus,studio,baseline:{personal:507,plus:436},checkedAt:new Date().toISOString()};
 });
 on('getDiagnostics',()=>({lines:diagnostics,configPath:configFile,bridge:bridgeStatus,discord:discord?.status,active}));
 on('exportSettings',async()=>{const r=await dialog.showSaveDialog(window,{title:'Export Presence Studio Settings',defaultPath:'MediaFlowPresenceStudio-settings-v20.507.json',filters:[{name:'JSON',extensions:['json']}]});if(r.canceled||!r.filePath)return {ok:false};fs.writeFileSync(r.filePath,JSON.stringify(config,null,2),'utf8');return {ok:true,message:'Settings exported successfully'};});
 on('importSettings',async()=>{const r=await dialog.showOpenDialog(window,{title:'Import Presence Studio Settings',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(r.canceled||!r.filePaths[0])return {ok:false};const file=r.filePaths[0];if(fs.statSync(file).size>2*1024*1024)throw Error('Settings file is too large');const imported=JSON.parse(fs.readFileSync(file,'utf8'));if(!imported||typeof imported!=='object'||Array.isArray(imported))throw Error('Invalid settings file');config=merge(DEFAULTS,imported);save();applyPresence();return {ok:true,message:'Settings imported successfully'};});
 on('resetSettings',()=>{config=merge(DEFAULTS,{});save();applyPresence();return state();});
 on('pause',()=>setConfig({mode:'off'}));on('resume',()=>setConfig({mode:'automatic'}));
 on('restartBridge',()=>{server?.close();bridgeStatus='Restarting';bridge();return state();});
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',show);
 app.whenReady().then(()=>{
  load();catalog=new Catalog(path.join(app.getPath('userData'),'catalog'));attach();discord=new DiscordIpc();bridge();createWindow();createTray();
  discord.setActivity(rendered());if(config.launcher.startWithWindows)app.setLoginItemSettings({openAtLogin:true,path:process.env.PORTABLE_EXECUTABLE_FILE||process.execPath});
  log('Presence Studio v20.507 started');
 });
 app.on('window-all-closed',()=>{if(!config.launcher.minimizeToTray){exiting=true;app.quit();}});
 app.on('before-quit',()=>{exiting=true;discord?.close();server?.close();});
}
