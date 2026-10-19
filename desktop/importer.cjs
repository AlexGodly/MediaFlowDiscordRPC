'use strict';
const ACCEPT_KEYS=['library','titles','media','mediaItems','libraryItems','catalog','items','entries'];
function parseCSV(text){
 const rows=[];let row=[],part='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'&&quoted&&text[i+1]==='"'){part+='"';i++;continue;}
  if(ch==='"'){quoted=!quoted;continue;}
  if(!quoted&&ch===','){row.push(part);part='';continue;}
  if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(part);part='';if(row.some(c=>String(c).trim()))rows.push(row);row=[];continue;}
  part+=ch;
 }
 row.push(part);if(row.some(c=>String(c).trim()))rows.push(row);
 if(!rows.length)return [];
 const heads=rows.shift().map(x=>x.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 return rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]||''])));
}
function findLibrary(root){
 if(Array.isArray(root))return root;
 if(!root||typeof root!=='object')throw Error('No library collection found in export');
 const direct=ACCEPT_KEYS.find(k=>Array.isArray(root[k]));
 if(direct)return root[direct];
 const containers=['state','data','payload','export','backup','account','app','mediaflow','userData','content'];
 for(const key of containers)if(root[key]&&typeof root[key]==='object'){
  try{const result=findLibrary(root[key]);if(Array.isArray(result))return result;}catch{}
 }
 throw Error('No library titles array found in export');
}
function asString(x){
 if(typeof x==='string'||typeof x==='number')return String(x);
 if(x&&typeof x==='object')return String(x.name||x.title||x.label||'');
 return '';
}
function convertRows(rows){
 if(!Array.isArray(rows)||rows.length>120000)throw Error('Import exceeds the 120,000 title limit');
 return rows.map(x=>{
  if(typeof x==='string')return {title:x};
  if(!x||typeof x!=='object')return null;
  return {id:asString(x.id||x.externalId||x.external_id||x.mal_id),
    title:asString(x.title||x.name||x.title_name||x.media_title),
    cover:asString(x.coverUrl||x.coverURL||x.cover_url||x.cover||x.posterUrl||x.poster_url||x.poster||x.imageUrl||x.image_url||x.image),
    category:asString(x.category||x.categoryName||x.category_name||x.mediaType||x.media_type||x.type),
    status:asString(x.status||x.watchStatus||x.watch_status||x.readStatus||x.read_status),
    progress:Number(x.progress??x.currentProgress??x.current_progress??0)||0,
    total:Number(x.total??x.totalUnits??x.total_units??0)||0};
 }).filter(x=>x&&x.title);
}
function parseExport(text,filename='export.json'){
 let rows;
 if(/\.csv$/i.test(filename))rows=parseCSV(text);
 else {
  let obj;try{obj=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('Invalid JSON file');}
  rows=findLibrary(obj);
 }
 return convertRows(rows);
}
module.exports={parseCSV,findLibrary,convertRows,parseExport};
