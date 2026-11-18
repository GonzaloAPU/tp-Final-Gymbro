/** Persistencia real de la política de lectura, con disco y red controlados. */
const test=require('node:test'),assert=require('node:assert/strict');
const {of,Subject,throwError,firstValueFrom,toArray}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
const {LocalReadCache,persistentRead}=loadComponent('frontend/src/app/services/local-read-cache.ts');
const clone=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  let now=1000;
  const data=new Map(),repo={async get(id){return data.has(id)?clone(data.get(id)):undefined;},async put(entry){data.set(entry.id,clone(entry));},async invalidateGroups(scope,groups,update){for(const [id,entry]of data)if(entry.scope===scope&&groups.includes(entry.group))data.set(id,clone(update(entry)));}};
  const policy={group:'routines',ttl:100};
  const cache=()=>new LocalReadCache(repo,()=>now);
  return {data,repo,policy,cache,tick:()=>{now+=101;},read:(store,load,current=()=>true,scope='server-a:user-a',session='a')=>store.read(scope,'/api/routines',policy,load,current,session)};
}
test('local: reabrir sin servidor recupera las rutinas guardadas',async()=>{
  const f=fixture();await firstValueFrom(f.read(f.cache(),()=>of([{id:'routine-a'}])));await settle();f.tick();
  const result=await firstValueFrom(f.read(f.cache(),()=>throwError(()=>Error('offline'))));assert.equal(result[0].id,'routine-a');
});
test('local: entrega copia inmediata y después la actualización sin bloquear',async()=>{
  const f=fixture(),cache=f.cache();await firstValueFrom(f.read(cache,()=>of({version:1})));f.tick();
  const network=new Subject(),values=[];f.read(cache,()=>network).subscribe(value=>values.push(value));await settle();
  assert.deepEqual(clone(values),[{version:1}]);network.next({version:2});network.complete();await settle();assert.deepEqual(clone(values),[{version:1},{version:2}]);
  assert.equal([...f.data.values()][0].body.version,2);
});
test('local: firstValueFrom no cancela la actualización de fondo',async()=>{
  const f=fixture(),cache=f.cache();await firstValueFrom(f.read(cache,()=>of({version:1})));f.tick();
  const network=new Subject();assert.equal((await firstValueFrom(f.read(cache,()=>network))).version,1);
  network.next({version:2});network.complete();await settle();assert.equal([...f.data.values()][0].body.version,2);
});
test('local: solicitudes simultáneas comparten una sola consulta',async()=>{
  const f=fixture(),cache=f.cache(),network=new Subject();let calls=0;
  const load=()=>{calls++;return network;};const a=firstValueFrom(f.read(cache,load)),b=firstValueFrom(f.read(cache,load));await settle();assert.equal(calls,1);
  network.next({ok:true});network.complete();await Promise.all([a,b]);
});
test('local: otra cuenta y otro servidor no reciben datos ajenos',async()=>{
  const f=fixture();await firstValueFrom(f.read(f.cache(),()=>of({private:'a'})));await settle();
  for(const scope of ['server-a:user-b','server-b:user-a'])await assert.rejects(firstValueFrom(f.read(f.cache(),()=>throwError(()=>Error('offline')),()=>true,scope)),/offline/);
});
test('local: cambiar cuenta antes de responder descarta la respuesta y no la persiste',async()=>{
  const f=fixture(),network=new Subject();let current=true;const values=[];
  f.read(f.cache(),()=>network,()=>current).subscribe(value=>values.push(value));await settle();current=false;network.next({private:'old'});network.complete();await settle();
  assert.equal(values.length,0);assert.equal(f.data.size,0);
});
test('local: invalidar impide que una lectura vieja repueble el disco',async()=>{
  const f=fixture(),cache=f.cache(),network=new Subject();f.read(cache,()=>network).subscribe();await settle();await cache.invalidate('server-a:user-a',['routines']);
  network.next({version:1});network.complete();await settle();assert.equal(f.data.size,0);
  assert.equal((await firstValueFrom(f.read(cache,()=>of({version:2})))).version,2);
});
test('local: fallo de disco permite seguir usando la respuesta de red',async()=>{
  const f=fixture();f.repo.get=async()=>{throw Error('storage');};f.repo.put=async()=>{throw Error('quota');};
  assert.equal((await firstValueFrom(f.read(f.cache(),()=>of({ok:true})))).ok,true);
});
test('local: fallo de red no destruye la copia anterior ni expone error si hay datos',async()=>{
  const f=fixture(),cache=f.cache();await firstValueFrom(f.read(cache,()=>of({ok:true})));await settle();f.tick();
  const values=await firstValueFrom(f.read(cache,()=>throwError(()=>Error('offline'))).pipe(toArray()));assert.deepEqual(clone(values),[{ok:true}]);assert.equal(f.data.size,1);
});
test('local: el consumidor no puede modificar el respaldo compartido',async()=>{
  const f=fixture(),cache=f.cache();const a=await firstValueFrom(f.read(cache,()=>of({days:[1]})));a.days.push(2);
  assert.deepEqual(clone((await firstValueFrom(f.read(cache,()=>of({days:[]})))).days),[1]);
});
test('local: solo se persisten consultas previstas, nunca credenciales ni ranking',()=>{
  for(const path of ['/api/auth/login','/api/health','/api/legal/status','/api/progress/leaderboard','/api/sessions/a'])assert.equal(persistentRead(path),false);
  for(const path of ['/api/routines','/api/exercises','/api/auth/me'])assert.equal(persistentRead(path),true);
});
test('local: horarios confirmados sobreviven al cierre aunque falle la nueva consulta',async()=>{
  const f=fixture(),cache=f.cache();const routine={id:'r1',days:[{id:'d1',schedule:[],favorite:false}]};
  await firstValueFrom(f.read(cache,()=>of([routine])));await settle();
  await cache.invalidate('server-a:user-a',['routines'],'/api/routines/r1/days/d1/schedule',{schedule:[{weekday:1,start:'19:00',end:'19:30'}]});
  const stored=await firstValueFrom(f.read(f.cache(),()=>throwError(()=>Error('offline'))));assert.equal(stored[0].days[0].schedule[0].start,'19:00');
});
test('local: crear una rutina no vuelve a enviar al usuario a la bienvenida',async()=>{
  const {applyReadMutation}=loadComponent('frontend/src/app/services/local-read-cache.ts');
  const entry={key:'/api/welcome/status',savedAt:1,body:{needed:true,hasRoutines:false}};
  assert.equal(applyReadMutation(entry,'/api/routines',{id:'r',days:[]}).body.needed,false);
});
