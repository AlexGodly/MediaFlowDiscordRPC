'use strict';
const {spawn}=require('node:child_process');
const executable=require('electron');
const child=spawn(executable,['.'],{cwd:require('node:path').resolve(__dirname,'..'),
 env:{...process.env,MEDIAFLOW_STUDIO_SMOKE:'1',ELECTRON_DISABLE_SECURITY_WARNINGS:'true'},
 stdio:'inherit',windowsHide:false});
const timeout=setTimeout(()=>{console.error('Electron smoke test timed out');child.kill();process.exit(1);},40000);
child.on('error',e=>{clearTimeout(timeout);console.error(e);process.exit(1)});
child.on('exit',(code,signal)=>{clearTimeout(timeout);process.exit(typeof code==='number'?code:1)});
