const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Catalog,normalize}=require('../catalog.cjs');
test('separate edition catalogue, search and persistence',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-catalog-'));const c=new Catalog(dir);
 c.begin({edition:'personal',batchId:'transfer-p-123',total:2,siteVersion:'507',source:'local snapshot'});
 c.chunk({edition:'personal',batchId:'transfer-p-123',offset:0,items:[{id:1,title:'The Mentalist',cover:'https://example.org/mentalist.jpg',status:'Watching'}, {id:2,title:'One Piece',status:'Plan to Watch'}]});
 assert.equal(c.finish({edition:'personal',batchId:'transfer-p-123'}).count,2);
 c.begin({edition:'plus',batchId:'transfer-plus-123',total:1,siteVersion:'437',source:'DOM'});
 c.chunk({edition:'plus',batchId:'transfer-plus-123',offset:0,items:[{title:'Public Example'}]});
 c.finish({edition:'plus',batchId:'transfer-plus-123'});
 assert.equal(c.search({edition:'personal',query:'mental'}).items[0].title,'The Mentalist');
 assert.equal(c.search({edition:'plus'}).total,1);
 assert.equal(new Catalog(dir).search({edition:'personal'}).catalogCount,2);
 c.clear('personal');assert.equal(c.search({edition:'personal'}).total,0);assert.equal(c.search({edition:'plus'}).total,1);
 fs.rmSync(dir,{recursive:true,force:true});
});
test('catalog metadata sanitization and transfer integrity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-catalog-'));const c=new Catalog(dir);
 assert.equal(normalize({title:'Test',cover:'file:///secrets',authToken:'private'}).cover,'');
 assert.ok(!('authToken' in normalize({title:'Test',authToken:'private'})));
 c.begin({edition:'personal',batchId:'transfer-y-123',total:1});
 assert.throws(()=>c.chunk({edition:'personal',batchId:'transfer-y-123',offset:1,items:[]}),/Out-of-order/);
 assert.throws(()=>c.finish({edition:'personal',batchId:'transfer-y-123'}),/Incomplete/);
 fs.rmSync(dir,{recursive:true,force:true});
});
test('catalog handles a 100,000-title library with pagination',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-catalog-'));const c=new Catalog(dir);
 const id='stress-100000-123';const total=100000;
 c.begin({edition:'personal',batchId:id,total,siteVersion:'507',source:'test'});
 for(let offset=0;offset<total;offset+=250){
  const items=Array.from({length:250},(_,i)=>({id:String(offset+i),title:'Media title '+(offset+i),category:'TV Series',status:'Watching'}));
  const r=c.chunk({edition:'personal',batchId:id,offset,items});
  assert.equal(r.received,offset+250);
 }
 assert.equal(c.finish({edition:'personal',batchId:id}).count,total);
 const page=c.search({edition:'personal',query:'Media title 999',offset:0,limit:15});
 assert.ok(page.total>0&&page.items.length<=15);
 assert.equal(c.search({edition:'personal',offset:99990,limit:50}).items.length,10);
 fs.rmSync(dir,{recursive:true,force:true});
});

test('directly imported title library stays isolated by edition',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-import-')),c=new Catalog(dir);
 const rows=[{title:'The Mentalist',cover:'https://x.test/mental.jpg',status:'Watching'}, {title:'The Mentalist',status:'Completed'},{title:'One Piece'}];
 assert.equal(c.import('personal',rows).count,2);
 assert.equal(c.search({edition:'plus'}).total,0);
 assert.equal(c.search({edition:'personal',query:'mental'}).items[0].status,'Completed');
 fs.rmSync(dir,{recursive:true,force:true});
});
