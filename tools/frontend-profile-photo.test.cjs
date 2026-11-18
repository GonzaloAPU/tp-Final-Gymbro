/** Foto desde Perfil: confirmación de la API, errores y prevención de doble carga. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Subject,tap}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
function fixture({compressionError=false}={}) {
  const user={id:'test',name:'Ana',photoUrl:'anterior'},pending=new Subject(),sent=[];
  const {ProfileViewComponent}=loadComponent('frontend/src/app/components/profile-view.component.ts',{
    auth:{user:()=>user,updateProfile:body=>{sent.push(body);return pending.pipe(tap(()=>{user.photoUrl=body.photoUrl;}));}},
    preparePhoto:async()=>{if(compressionError)throw Error('Imagen inválida');return 'comprimida';},
  },{Error,localStorage:{getItem:()=>null}});
  const screen=new ProfileViewComponent(),input={files:[{}],value:'foto.jpg'};
  return {screen,input,user,pending,sent};
}
test('foto en Perfil: cancelar selector no envía ni altera la foto',async()=>{
  const {screen,sent,user}=fixture();await screen.uploadPhoto({target:{files:[]}});
  assert.equal(sent.length,0);assert.equal(user.photoUrl,'anterior');assert.equal(screen.photoSaving(),false);
});
test('foto en Perfil: espera a la API antes de reemplazar la imagen',async()=>{
  const {screen,input,user,pending,sent}=fixture();const upload=screen.uploadPhoto({target:input});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sent.length,1);assert.equal(user.photoUrl,'anterior');assert.equal(screen.photoSaving(),true);
  pending.next({});await upload;assert.equal(user.photoUrl,'comprimida');
});
test('foto en Perfil: éxito guarda solo photoUrl y libera el selector',async()=>{
  const {screen,input,pending,sent}=fixture();const upload=screen.uploadPhoto({target:input});await new Promise(resolve=>setImmediate(resolve));
  pending.next({});await upload;assert.equal(Object.keys(sent[0]).join(','),'photoUrl');
  assert.equal(screen.photoSaved(),true);assert.equal(screen.photoSaving(),false);assert.equal(input.value,'');
});
test('foto en Perfil: error de compresión no llama al servidor',async()=>{
  const {screen,input,sent,user}=fixture({compressionError:true});await screen.uploadPhoto({target:input});
  assert.equal(sent.length,0);assert.equal(user.photoUrl,'anterior');assert.equal(screen.error(),'Imagen inválida');assert.equal(screen.photoSaving(),false);
});
test('foto en Perfil: error HTTP conserva la anterior y permite reintentar',async()=>{
  const {screen,input,pending,user}=fixture();const upload=screen.uploadPhoto({target:input});await new Promise(resolve=>setImmediate(resolve));
  pending.error({error:{message:'Sin conexión'}});await upload;
  assert.equal(user.photoUrl,'anterior');assert.equal(screen.error(),'Sin conexión');assert.equal(screen.photoSaved(),false);assert.equal(input.value,'');assert.equal(screen.photoSaving(),false);
});
test('foto en Perfil: doble carga pendiente no duplica solicitudes',async()=>{
  const {screen,input,pending,sent}=fixture();const upload=screen.uploadPhoto({target:input});await new Promise(resolve=>setImmediate(resolve));
  await screen.uploadPhoto({target:input});assert.equal(sent.length,1);pending.next({});await upload;
});
