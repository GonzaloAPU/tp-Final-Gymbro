const test=require('node:test'),assert=require('node:assert/strict');
const {of,Subject,throwError,firstValueFrom}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
const {RequestCache,readPolicy,mutationGroups}=loadComponent('frontend/src/app/services/request-cache.ts');
const {LocalReadCache,persistentRead}=loadComponent('frontend/src/app/services/local-read-cache.ts');
const {adjacentTab,swipeDirection}=loadComponent('frontend/src/app/tab-navigation.ts');
const clone=value=>JSON.parse(JSON.stringify(value));
function interceptorFixture(){
  const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
  const auth={token:'token-a',user:()=>({id:auth.token})},endpoint={native:true,server:()=> 'https://gymbro.test'};
  class HttpResponse {constructor(init){this.body=Object.hasOwn(init,'body')?init.body:init;}clone({body}){return new HttpResponse({body});}}
  class IndexedReadRepository {constructor(){this.data=new Map();}async get(id){return this.data.get(id);}async put(entry){this.data.set(entry.id,entry);}async invalidateGroups(scope,groups,update){for(const [id,entry] of this.data)if(entry.scope===scope&&groups.includes(entry.group))this.data.set(id,update(entry));}}
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/app/interceptors/read-cache.interceptor.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,require:name=>{
      if(name==='@angular/core')return {inject:token=>token==='auth'?auth:endpoint};
      if(name==='@angular/common/http')return {HttpResponse};
      if(name.includes('auth.service'))return {AuthService:'auth'};
      if(name.includes('api-endpoint.service'))return {ApiEndpointService:'endpoint'};
      if(name.includes('request-cache'))return {RequestCache,readPolicy,mutationGroups};
      if(name.includes('local-read-cache'))return {LocalReadCache,persistentRead,IndexedReadRepository};
      return require(name);
    },
  });
  const request=(url,method='GET')=>({url,urlWithParams:url,method,responseType:'json',reportProgress:false});
  let calls=0;
  return {auth,request,run:exports.readCacheInterceptor,next:()=>{calls++;return of(new HttpResponse({number:calls}));},calls:()=>calls};
}
test('interceptor: reutiliza respuestas HTTP y las clona',async()=>{
  const f=interceptorFixture(),req=f.request('/api/routines');
  const first=await firstValueFrom(f.run(req,f.next));first.body.number=999;
  const second=await firstValueFrom(f.run(req,f.next));assert.equal(second.body.number,1);assert.equal(f.calls(),1);
});
test('interceptor: un cambio de horarios fuerza otra consulta',async()=>{
  const f=interceptorFixture();await firstValueFrom(f.run(f.request('/api/routines'),f.next));
  await firstValueFrom(f.run(f.request('/api/routines/a/days/b/schedule','PUT'),f.next));
  await firstValueFrom(f.run(f.request('/api/routines'),f.next));assert.equal(f.calls(),3);
});
test('interceptor: cambiar sesión no reutiliza el perfil anterior',async()=>{
  const f=interceptorFixture();await firstValueFrom(f.run(f.request('/api/auth/me'),f.next));
  f.auth.token='token-b';const next=await firstValueFrom(f.run(f.request('/api/auth/me'),f.next));assert.equal(next.body.number,2);
});
test('interceptor: salud y URLs externas siempre van a la red',async()=>{
  const f=interceptorFixture();
  for(const url of ['/api/health','https://other.test/api/routines'])for(let i=0;i<2;i++)await firstValueFrom(f.run(f.request(url),f.next));
  assert.equal(f.calls(),4);
});
test('gestos: navegación circular en ambos sentidos',()=>{
  assert.equal(adjacentTab('/perfil',1),'/');assert.equal(adjacentTab('/',-1),'/perfil');
  assert.equal(adjacentTab('/entrenamiento?x=1',1),'/progreso');
  assert.equal(adjacentTab('/progreso',-1),'/entrenamiento');
});
test('gestos: formularios y rutas secundarias no participan',()=>{for(const path of ['/perfil/editar','/rutinas/nueva','/login','/bienvenida','/consentimiento'])assert.equal(adjacentTab(path,1),null);});
test('gestos: reconoce dirección horizontal y descarta scroll, diagonales y pulsaciones',()=>{
  assert.equal(swipeDirection(-90,10,200),1);assert.equal(swipeDirection(-120,0,3000),1,'Permite arrastrar despacio');assert.equal(swipeDirection(100,10,300),-1);
  for(const args of [[0,0,100],[30,0,100],[80,90,100],[80,60,100]])assert.equal(swipeDirection(...args),0);
});
test('caché: reutiliza respuesta vigente y renueva al vencer',async()=>{
  let now=0,calls=0;const cache=new RequestCache(()=>now);cache.setScope('a');
  const get=()=>cache.read('routines',{group:'routines',ttl:100},()=>{calls++;return of({value:calls});},clone);
  assert.equal((await firstValueFrom(get())).value,1);assert.equal((await firstValueFrom(get())).value,1);assert.equal(calls,1);
  now=101;assert.equal((await firstValueFrom(get())).value,2);
});
test('caché: dos pantallas comparten una solicitud simultánea',()=>{
  const cache=new RequestCache(),pending=new Subject();let calls=0;const values=[];
  const get=()=>cache.read('catalog',{group:'catalog',ttl:1000},()=>{calls++;return pending;},clone);
  get().subscribe(v=>values.push(v));get().subscribe(v=>values.push(v));
  assert.equal(calls,1);pending.next({count:190});pending.complete();assert.equal(values.length,2);
});
test('caché: las ediciones de una pantalla no mutan la copia compartida',async()=>{
  const cache=new RequestCache(),get=()=>cache.read('x',{group:'routines',ttl:1000},()=>of({days:[1]}),clone);
  const first=await firstValueFrom(get());first.days.push(2);
  assert.deepEqual(await firstValueFrom(get()),{days:[1]});
});
test('caché: cambiar usuario o servidor descarta datos anteriores',async()=>{
  const cache=new RequestCache();let calls=0;
  const get=()=>cache.read('x',{group:'profile',ttl:1000},()=>of({value:++calls}),clone);
  cache.setScope('server1:user1');await firstValueFrom(get());
  cache.setScope('server1:user2');assert.equal((await firstValueFrom(get())).value,2);
  cache.setScope('server2:user2');assert.equal((await firstValueFrom(get())).value,3);
});
test('caché: guardar un horario invalida plan y bienvenida pero conserva catálogo',async()=>{
  const cache=new RequestCache();let calls=0;
  const get=(key,group)=>cache.read(key,{group,ttl:1000},()=>of(++calls),clone);
  await firstValueFrom(get('plan','routines'));await firstValueFrom(get('exercises','catalog'));
  cache.invalidate(mutationGroups('/api/routines/id/days/day/schedule'));
  assert.equal(await firstValueFrom(get('exercises','catalog')),2);
  assert.equal(await firstValueFrom(get('plan','routines')),3);
});
test('caché: respuesta vieja no reaparece después de una escritura',async()=>{
  const cache=new RequestCache(),old=new Subject();let calls=0;
  cache.read('plan',{group:'routines',ttl:1000},()=>old,clone).subscribe();
  cache.invalidate(['routines']);old.next('viejo');old.complete();
  const fresh=await firstValueFrom(cache.read('plan',{group:'routines',ttl:1000},()=>{calls++;return of('nuevo');},clone));
  assert.equal(fresh,'nuevo');assert.equal(calls,1);
});
test('caché: errores no quedan guardados y permiten reintentar',async()=>{
  const cache=new RequestCache(),policy={group:'profile',ttl:1000};
  await assert.rejects(firstValueFrom(cache.read('x',policy,()=>throwError(()=>Error('offline')),clone)));
  assert.equal(await firstValueFrom(cache.read('x',policy,()=>of('ok'),clone)),'ok');
});
test('caché: no contempla credenciales, salud ni recibos de sincronización',()=>{for(const path of ['/api/auth/login','/api/health','/api/legal/accept','/api/sessions/id'])assert.equal(readPolicy(path),null);});
test('caché: mediciones y finalización invalidan progreso; privacidad invalida permisos',()=>{
  assert.ok(mutationGroups('/api/progress/weight').includes('profile'));
  assert.ok(mutationGroups('/api/sessions/id/finish').includes('progress'));
  assert.ok(mutationGroups('/api/legal/withdraw-sports').includes('legal'));
});
