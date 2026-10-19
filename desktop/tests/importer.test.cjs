const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseExport}=require('../importer.cjs');
test('standard MediaFlow full-state JSON export',()=>{
 const items=parseExport(JSON.stringify({state:{library:[{id:5,title:'The Mentalist',coverUrl:'https://example.org/mental.jpg',category:{name:'TV Series'},status:'Watching',progress:11}]}}));
 assert.equal(items[0].title,'The Mentalist');assert.equal(items[0].category,'TV Series');assert.equal(items[0].progress,11);
});
test('CSV quoted titles and various headers',()=>{
 const r=parseExport('id,title,cover_url,media_type,status\n1,"This, is a title",https://example.org/x.jpg,TV,Watching\n2,One Piece,,Anime,Watching','library.csv');
 assert.equal(r.length,2);assert.equal(r[0].title,'This, is a title');assert.equal(r[1].category,'Anime');
});
test('reject unrelated exports or broken input without persisting credentials',()=>{
 assert.throws(()=>parseExport('{"settings":{"theme":"dark"}}'),/No library/);
 const rows=parseExport(JSON.stringify({library:[{title:'One Piece',token:'private',password:'secret'}]}));
 assert.equal('token' in rows[0],false);
});
