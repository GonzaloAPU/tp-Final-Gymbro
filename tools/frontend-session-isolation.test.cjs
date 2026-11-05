/** Respuestas tardías de una cuenta anterior no deben modificar la cuenta actual. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Subject}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
function fixture(){
  const data=new Map([['smartgymbro_token','token-a'],['smartgymbro_user',JSON.stringify({id:'a',name:'Cuenta A'})]]);
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const get=new Subject(),patch=new Subject(),login=new Subject();
  const {AuthService}=loadComponent('frontend/src/app/services/auth.service.ts',{http:{get:()=>get,patch:()=>patch,post:()=>login}},{localStorage:storage});
  return {auth:new AuthService(),data,get,patch,login};
}
test('sesión: un perfil tardío no sustituye a la nueva cuenta',()=>{
  const f=fixture();f.auth.refreshProfile().subscribe();f.auth.login({email:'b@example.invalid',password:'fixture-only'}).subscribe();
  f.login.next({token:'token-b',user:{id:'b',name:'Cuenta B'}});f.login.complete();f.get.next({id:'a',name:'Respuesta vieja'});
  assert.equal(f.auth.user().id,'b');assert.equal(JSON.parse(f.data.get('smartgymbro_user')).id,'b');
});
test('sesión: un perfil tardío no reaparece después de salir',()=>{
  const f=fixture();f.auth.refreshProfile().subscribe();f.auth.logout();f.get.next({id:'a',name:'Cuenta A'});
  assert.equal(f.auth.user(),null);assert.equal(f.data.has('smartgymbro_user'),false);
});
test('sesión: una edición tardía de la cuenta anterior no altera la actual',()=>{
  const f=fixture();f.auth.updateProfile({name:'Edición de A'}).subscribe();f.auth.login({email:'b@example.invalid',password:'fixture-only'}).subscribe();
  f.login.next({token:'token-b',user:{id:'b',name:'Cuenta B'}});f.login.complete();f.patch.next({id:'a',name:'Edición de A'});
  assert.equal(f.auth.user().id,'b');assert.equal(JSON.parse(f.data.get('smartgymbro_user')).id,'b');
});
test('sesión: una respuesta de la sesión vigente sigue actualizando el perfil',()=>{
  const f=fixture();f.auth.refreshProfile().subscribe();f.get.next({id:'a',name:'Actualizado'});
  assert.equal(f.auth.user().name,'Actualizado');
});
