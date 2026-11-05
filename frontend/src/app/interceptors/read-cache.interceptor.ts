import {inject} from '@angular/core';
import {HttpInterceptorFn,HttpResponse} from '@angular/common/http';
import {filter,map,tap,timeout} from 'rxjs';
import {AuthService} from '../services/auth.service';
import {ApiEndpointService} from '../services/api-endpoint.service';
import {RequestCache,mutationGroups,readPolicy} from '../services/request-cache';
import {IndexedReadRepository,LocalReadCache,persistentRead} from '../services/local-read-cache';
const cache=new RequestCache();
const local=new LocalReadCache(new IndexedReadRepository());
if(typeof window!=='undefined')window.addEventListener('online',()=>local.refresh());
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')local.refresh(undefined,['routines','profile']);});
/** Solo lecturas JSON propias y autenticadas; cada cuenta/servidor tiene un espacio aislado. */
export const readCacheInterceptor:HttpInterceptorFn=(request,next)=>{
  if(!request.url.startsWith('/api/'))return next(request);
  const auth=inject(AuthService),endpoint=inject(ApiEndpointService);
  cache.setScope((endpoint.native?endpoint.server():'proxy')+'|'+(auth.token||''));
  const token=auth.token,userId=auth.user()?.id;
  const server=endpoint.native?endpoint.server():window.location.origin;
  const scope=JSON.stringify([server,userId]);
  const current=()=>auth.token===token&&auth.user()?.id===userId&&(endpoint.native?endpoint.server():window.location.origin)===server;
  const path=request.url.split('?')[0];
  if(request.method!=='GET'){
    // El progreso se renueva al finalizar, no por cada serie enviada por la cola.
    const groups=path.startsWith('/api/sessions')&&!path.endsWith('/finish')?[]:mutationGroups(path);
    return next(request).pipe(tap(event=>{if(event instanceof HttpResponse&&current()){
      cache.invalidate(groups);
      if(userId&&groups.length)void local.invalidate(scope,groups,path,event.body).then(()=>local.refresh(scope,groups));
    }}));
  }
  const policy=readPolicy(path);
  if(!auth.token||!policy||request.responseType!=='json'||request.reportProgress)return next(request);
  if(userId&&persistentRead(path))return local.read(scope,request.urlWithParams,policy,
    ()=>next(request).pipe(filter((event):event is HttpResponse<unknown>=>event instanceof HttpResponse),map(response=>response.body),timeout(75000)),current,token||'')
    .pipe(map(body=>new HttpResponse({body,status:200,url:request.urlWithParams})));
  return cache.read(request.urlWithParams,policy,()=>next(request).pipe(filter((event):event is HttpResponse<unknown>=>event instanceof HttpResponse)),
    response=>response.clone({body:response.body==null?response.body:JSON.parse(JSON.stringify(response.body))}));
};
