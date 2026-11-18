/** El texto viaja en la APK para poder leerlo sin conexión; el servidor registra la aceptación. */
import {inject,Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {tap,timeout} from 'rxjs';
import {AuthService} from './auth.service';
import {ApiEndpointService} from './api-endpoint.service';
import documents from '../../../../shared/legal-documents.json';
export const legalDocuments=documents;
export interface LegalInput {
  version:string; termsAccepted:boolean; privacyAcknowledged:boolean;
  adultConfirmed:boolean; sportsDataConsent:boolean;
}
export interface LegalStatus {needsAcceptance:boolean;sportsDataConsent:boolean;version:string;}
@Injectable({providedIn:'root'})
export class LegalService {
  private readonly http=inject(HttpClient);
  private readonly auth=inject(AuthService);
  private readonly endpoint=inject(ApiEndpointService);
  private get cacheKey(){return 'gymbro.legal-status.v2.'+JSON.stringify([this.endpoint.native?this.endpoint.server():window.location.origin,this.auth.user()?.id]);}
  // Solo ayuda a navegar sin conexión; el backend siempre verifica su recibo real.
  private remember(status:LegalStatus){
    try{localStorage.setItem(this.cacheKey,JSON.stringify({...status,checkedAt:Date.now()}));}catch{/* Sin espacio, seguimos usando el resultado del servidor. */}
  }
  cachedStatus():LegalStatus|null {
    try{
      const saved=JSON.parse(localStorage.getItem(this.cacheKey)||'null');
      return saved?.version===documents.version&&Date.now()-saved.checkedAt<7*86400000?saved:null;
    }catch{return null;}
  }
  status(){const key=this.cacheKey,token=this.auth.token;return this.http.get<LegalStatus>('/api/legal/status').pipe(timeout(75000),tap(s=>{if(key===this.cacheKey&&token===this.auth.token)this.remember(s);}));}
  accept(input:LegalInput){const key=this.cacheKey,token=this.auth.token;return this.http.post<LegalStatus>('/api/legal/accept',input).pipe(timeout(75000),tap(s=>{if(key===this.cacheKey&&token===this.auth.token)this.remember(s);}));}
  withdraw(){const key=this.cacheKey,token=this.auth.token;return this.http.post<LegalStatus>('/api/legal/withdraw-sports',{}).pipe(timeout(75000),tap(s=>{if(key===this.cacheKey&&token===this.auth.token)this.remember(s);}));}
}
