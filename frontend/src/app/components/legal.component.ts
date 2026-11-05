import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {legalDocuments} from '../services/legal.service';
@Component({standalone:true,imports:[RouterLink],template:`
  <main class="page legal"><a routerLink="/perfil">Volver al perfil</a> · <a routerLink="/registro">Crear cuenta</a>
  <h1>{{privacy ? 'Política de privacidad' : 'Términos de uso'}}</h1>
  <p>Responsable: {{documents.operator}} · Contacto: {{documents.email}}</p>
  <p>Versión {{documents.version}} · Actualizado: {{documents.updatedAt}}</p>
  @for(section of sections;track section.title){<section><h2>{{section.title}}</h2><p>{{section.text}}</p></section>}
  </main>`,changeDetection: ChangeDetectionStrategy.Eager,
styles:[`.legal{max-width:760px;padding-block:30px 70px}.legal p{line-height:1.8;white-space:pre-line;overflow-wrap:anywhere;color:var(--muted)}.legal h2{font-size:20px;margin-top:28px}.legal a{color:var(--lime)}`]})
export class LegalComponent {
  readonly documents=legalDocuments;
  readonly privacy=inject(ActivatedRoute).snapshot.data['kind']==='privacy';
  readonly sections=this.privacy?this.documents.privacy:this.documents.terms;
}
