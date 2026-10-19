const test=require('node:test'),assert=require('node:assert/strict');
const {DEFAULTS,EDITIONS,merge,compile,parseWire,safeAsset}=require('../core.cjs');
test('edition versions',()=>{assert.equal(EDITIONS.personal.version,507);assert.equal(EDITIONS.plus.version,437);});
test('independent artwork, no clickable links',()=>{const p=compile({edition:'personal',view:'details',title:'The Mentalist',cover:'https://example.org/poster.jpg'},DEFAULTS);assert.equal(p.assets.large_image,'https://example.org/poster.jpg');assert.equal(p.assets.small_image,'mediaflow');assert.equal(p.name,'The Mentalist');assert.ok(!p.buttons&&!p.assets.small_url);});
test('small-image alternatives',()=>{const e={edition:'plus',view:'community',profileImage:'https://example.org/me.png'};assert.equal(compile(e,merge(DEFAULTS,{smallImage:{mode:'account'}})).assets.small_image,'https://example.org/me.png');assert.equal(compile(e,merge(DEFAULTS,{smallImage:{mode:'none'}})).assets.small_image,undefined);assert.equal(compile(e,merge(DEFAULTS,{smallImage:{mode:'custom',url:'https://x.test/img.jpg'}})).assets.small_image,'https://x.test/img.jpg');});
test('visibility and mode',()=>{assert.equal(compile({edition:'personal',view:'logging'},merge(DEFAULTS,{when:{logging:false}})),null);assert.equal(compile({edition:'personal',view:'other'},merge(DEFAULTS,{mode:'off'})),null);});
test('template and safe URL',()=>{assert.equal(safeAsset('file:///C:/secret.png'),'');assert.equal(compile({edition:'plus',view:'other',title:'One Piece',action:'Reading'},DEFAULTS).details,'Reading One Piece');});
test('MF5 decode',()=>{const e=v=>Buffer.from(String(v)).toString('base64'),w=['MF5','P',e('Watching'),e('Level 10'),e('details'),e(''),e(''),e('mediaflow'),e(''),e('plus')].join('|');assert.equal(parseWire(w).entry.edition,'plus');assert.equal(parseWire('MF4|C'),null);});

test('per-edition overrides can be added incrementally without wiping older fields',()=>{
 const c1=merge(DEFAULTS,{perEdition:{personal:{detailsTemplate:'Viewing {title}'}}});
 const c2=merge(c1,{perEdition:{personal:{smallImage:{mode:'none'}}}});
 assert.equal(c2.perEdition.personal.detailsTemplate,'Viewing {title}');
 assert.equal(c2.perEdition.personal.smallImage.mode,'none');
 assert.equal(compile({edition:'personal',view:'details',title:'The Mentalist'},c2).assets.small_image,undefined);
 assert.equal(compile({edition:'plus',view:'details',title:'One Piece'},c2).assets.small_image,'mediaflow');
});

test('non-title pages retain their real counts and meaningful action',()=>{
 const library=compile({edition:'personal',view:'library',details:'Browsing Library',state:'29,847 titles',largeText:'MediaFlow'},DEFAULTS);
 assert.equal(library.details,'Browsing Library');
 assert.equal(library.state,'29,847 titles');
 const order=compile({edition:'plus',view:'order',details:'Organizing Personal Order',state:'128 titles',largeText:'MediaFlow'},DEFAULTS);
 assert.equal(order.details,'Organizing Personal Order');
 assert.equal(order.state,'128 titles');
});

test('activity rules match title, edition and category without leaking to another edition',()=>{
 const conf=merge(DEFAULTS,{rules:[{
  id:'one',name:'Special Mentalist',enabled:true,priority:30,
  match:{edition:'personal',titleContains:'mentalist',category:'TV Series'},
  overrides:{detailsTemplate:'Currently watching {title}',smallImage:{mode:'none'},activityType:3}
 }]});
 const matching=compile({edition:'personal',view:'details',title:'The Mentalist',category:'TV Series'},conf);
 assert.equal(matching.details,'Currently watching The Mentalist');assert.equal(matching.assets.small_image,undefined);
 const noMatch=compile({edition:'plus',view:'details',title:'The Mentalist',category:'TV Series'},conf);
 assert.equal(noMatch.assets.small_image,'mediaflow');
});
test('higher priority rule overrides overlapping lower priority template',()=>{
 const c=merge(DEFAULTS,{rules:[
  {id:'low',enabled:true,priority:1,match:{view:'details'},overrides:{detailsTemplate:'Low {title}'}},
  {id:'high',enabled:true,priority:9,match:{view:'details'},overrides:{detailsTemplate:'High {title}'}}
 ]});
 assert.equal(compile({edition:'personal',view:'details',title:'X'},c).details,'High X');
});

test('manual mode custom state takes effect and XP progress bar can be used as text',()=>{
 const c=merge(DEFAULTS,{mode:'manual',show:{xp:true,progress:true},manual:{title:'The Mentalist',state:'{xpProgressBar}',xp:70,xpNext:100},stateTemplate:'{streakLine}'});
 const p=compile({edition:'personal',view:'details',title:'ignored'},c);
 assert.equal(p.name,'The Mentalist');
 assert.equal(p.state,'███████░░░ 70%');
});
test('xp progress clamped to 0..100 and no progress when hidden',()=>{
 const c=merge(DEFAULTS,{mode:'manual',show:{xp:true,progress:true},manual:{title:'Example',state:'{xpProgressBar}',xp:1000,xpNext:100}});
 assert.equal(compile({edition:'personal',view:'details'},c).state,'██████████ 100%');
 const off=merge(c,{show:{xp:false}});
 assert.equal(compile({edition:'personal',view:'details'},off).state,'MediaFlow');
});
