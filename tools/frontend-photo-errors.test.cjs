/** 10 casos nuevos del procesamiento de fotos y liberación de recursos. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../frontend/src/app/services/profile-photo.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(options={}) {
  const state={created:0,revoked:0,encodings:[],fills:[],draws:[]};
  const context={fillStyle:'',fillRect(...args){state.fills.push({color:this.fillStyle,args});},drawImage(...args){state.draws.push(args);}};
  const canvas={width:0,height:0,getContext:()=>options.noContext?null:context,toDataURL(type,quality){
    state.encodings.push({type,quality,width:canvas.width,height:canvas.height});
    if(options.encoderError)throw Error('Falló el codificador');
    return options.oversized||options.retryQuality&&state.encodings.length===1?'x'.repeat(650001):'data:image/jpeg;base64,YQ==';
  }};
  class Image {naturalWidth=options.width??400;naturalHeight=options.height??300;set src(_value){queueMicrotask(()=>options.decodeError?this.onerror():this.onload());}}
  const exports={};vm.runInNewContext(source,{exports,Blob,Uint8Array,Image,document:{createElement:()=>canvas},URL:{createObjectURL(){state.created++;return 'blob:photo';},revokeObjectURL(){state.revoked++;}}});
  return {state,prepare:()=>exports.prepareProfilePhoto(new File([new Uint8Array([255,216,255,0])],'foto.jpg',{type:options.type||'image/jpeg'})),prepareText:()=>exports.prepareProfilePhoto(new File(['texto'],'archivo.txt',{type:'text/plain'}))};
}
test('foto: archivo de texto se rechaza antes de crear URL temporal',async()=>{const {prepareText,state}=fixture();await assert.rejects(prepareText(),/imagen/);assert.equal(state.created,0);assert.equal(state.revoked,0);});
test('foto: fallo de decodificación libera la URL',async()=>{const {prepare,state}=fixture({decodeError:true});await assert.rejects(prepare(),/abrir/);assert.equal(state.revoked,1);});
test('foto: ancho cero se rechaza y libera recursos',async()=>{const {prepare,state}=fixture({width:0});await assert.rejects(prepare(),/leer/);assert.equal(state.revoked,1);});
test('foto: alto cero se rechaza y libera recursos',async()=>{const {prepare,state}=fixture({height:0});await assert.rejects(prepare(),/leer/);assert.equal(state.revoked,1);});
test('foto: canvas no disponible produce error recuperable',async()=>{const {prepare,state}=fixture({noContext:true});await assert.rejects(prepare(),/preparar/);assert.equal(state.revoked,1);});
test('foto: excepción del codificador también libera la URL',async()=>{const {prepare,state}=fixture({encoderError:true});await assert.rejects(prepare(),/codificador/);assert.equal(state.revoked,1);});
test('foto: tamaño imposible tiene intentos acotados y termina en error',async()=>{const {prepare,state}=fixture({oversized:true});await assert.rejects(prepare(),/procesar/);assert.equal(state.encodings.length,15);assert.equal(state.revoked,1);});
test('foto: baja calidad antes de reducir resolución',async()=>{const {prepare,state}=fixture({retryQuality:true});await prepare();assert.equal(state.encodings.length,2);assert.equal(state.encodings[0].quality,0.88);assert.equal(state.encodings[1].quality,0.75);assert.equal(state.encodings[0].width,state.encodings[1].width);});
test('foto: imagen pequeña no se agranda innecesariamente',async()=>{const {prepare,state}=fixture({width:32,height:24});await prepare();assert.equal(state.encodings[0].width,32);assert.equal(state.encodings[0].height,24);assert.equal(state.revoked,1);});
test('foto: retrato grande conserva proporción y rellena fondo blanco',async()=>{const {prepare,state}=fixture({width:3000,height:4000});await prepare();assert.equal(state.encodings[0].width,960);assert.equal(state.encodings[0].height,1280);assert.equal(state.fills[0].color,'#ffffff');assert.equal(state.draws.length,1);});
