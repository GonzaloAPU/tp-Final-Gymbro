/** Carga clases reales de Angular con dependencias controladas para pruebas unitarias. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compiled=new Map();
function signal(initial){let value=initial;const read=()=>value;read.set=next=>{value=next;};read.update=fn=>{value=fn(value);};read.asReadonly=()=>read;return read;}
class HttpErrorResponse extends Error {constructor(message){super(message);this.error={message};}}
function loadComponent(file,services={},globals={}) {
  const absolute=path.resolve(__dirname,'../..',file);
  if(!compiled.has(absolute))compiled.set(absolute,ts.transpileModule(fs.readFileSync(absolute,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
  }).outputText);
  const exports={};
  vm.runInNewContext(compiled.get(absolute),{
    exports,window:{scrollTo(){}},...globals,
    require:name=>{
      if(name==='@angular/core')return { ChangeDetectionStrategy:{Eager:1,OnPush:0},Injectable:()=>target=>target,Component:()=>target=>target,Input:()=>()=>{},signal,computed:read=>read,inject:token=>{
        if(!(token in services))throw Error(`Falta simular ${token}`);return services[token];
      }};
      if(name==='@angular/router')return {Router:'router'};
      if(name==='@angular/common/http')return {HttpErrorResponse,HttpClient:'http'};
      if(name==='@angular/common')return {};
      if(name.includes('alarm-settings.component'))return {AlarmSettingsComponent:class {}};
      if(name.includes('legal.service'))return {LegalService:'legal',legalDocuments:require('../../shared/legal-documents.json')};
      if(name.includes('auth.service'))return {AuthService:'auth'};
      if(name.includes('api-endpoint.service'))return {ApiEndpointService:'endpoint'};
      if(name.includes('exercise.service'))return {ExerciseService:'exercises'};
      if(name.includes('routine.service'))return {RoutineService:'routines'};
      if(name.includes('welcome.service'))return {WelcomeService:'welcome'};
      if(name.includes('profile-photo'))return {prepareProfilePhoto:services.preparePhoto};
      return require(name);
    },
  });return exports;
}
module.exports={loadComponent,signal,HttpErrorResponse};
