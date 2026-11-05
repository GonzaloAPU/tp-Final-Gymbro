/** Perfil de lectura. La edición vive en otra ruta y solamente se abre por decisión del usuario. */
import { Component, Input, OnChanges, SimpleChanges, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlarmSettingsComponent } from './alarm-settings.component';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { prepareProfilePhoto } from '../services/profile-photo';

@Component({
  selector:'app-profile-view',
  standalone: true,
  imports: [RouterLink, DecimalPipe, AlarmSettingsComponent],
  template: `
    <section class="page profile-view">
      <header><div><span class="kicker">TU ESPACIO PERSONAL</span><h1>Mi perfil</h1></div><a class="button primary" routerLink="/perfil/editar">Modificar perfil</a></header>
      @if (error()) {<p role="alert" class="error">{{error()}}</p>}
      <article class="identity">
        <div class="portrait">@if(auth.user()?.photoUrl) {<img [src]="$safeNavigationMigration(auth.user()?.photoUrl)" alt="Tu foto de perfil">} @else {<span>{{initials}}</span>}</div>
        <input #photo type="file" accept="image/*,.jpg,.jpeg,.jpe,.jfif,.png,.webp" hidden [disabled]="photoSaving()" (change)="uploadPhoto($event)">
        <button type="button" class="button primary photo-action" [disabled]="photoSaving()" (click)="photo.click()">{{photoSaving() ? 'Guardando foto…' : auth.user()?.photoUrl ? 'Cambiar foto' : 'Cargar foto'}}</button>
        @if(photoSaved()) {<p class="photo-status" role="status">Foto de perfil actualizada.</p>}
        <h2>{{auth.user()?.name}}</h2><p class="email">{{auth.user()?.email}}</p>
        @if(auth.user()?.discipline) {<span class="discipline">{{auth.user()?.discipline}}</span>}
        <dl><div><dt>Mi gimnasio</dt><dd>{{auth.user()?.gymName || 'Todavía no agregaste tu gimnasio'}}</dd></div><div><dt>Mi objetivo</dt><dd>{{auth.user()?.goal || 'Todavía no definiste un objetivo'}}</dd></div></dl>
      </article>
      <section class="measurements" aria-label="Mis medidas"><article><span>MI PESO</span><button class="eye" type="button" (click)="toggleWeight()" [attr.aria-label]="showWeight() ? 'Ocultar peso' : 'Mostrar peso'" [attr.aria-pressed]="showWeight()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>@if(!showWeight()){<path d="m3 3 18 18"/>}</svg></button><strong>@if(showWeight()) {{{auth.user()?.currentKg != null ? ($safeNavigationMigration(auth.user()?.currentKg) | number:'1.1-1') : '—'}}} @else {•••}<small>kg</small></strong><p>{{showWeight() ? 'Tu peso actual' : 'Solo se muestra cuando vos lo elegís'}}</p></article><article><span>MI ALTURA</span><strong>{{auth.user()?.heightCm || '—'}}<small>cm</small></strong><p>Altura registrada</p></article></section>
      <app-alarm-settings />
      <a class="progress-link" routerLink="/privacidad/ajustes">Privacidad, permisos y mis datos →</a>
      <a class="progress-link" routerLink="/progreso">Ver mis entrenamientos y récords →</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .photo-action{margin-top:14px;min-height:44px;gap:8px}.photo-action:disabled{opacity:.55;cursor:wait}.photo-status{font-size:13px;color:var(--lime)}
    .profile-view{max-width:760px;padding-block:30px 60px}header{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:24px}.kicker{font-size:10px;letter-spacing:.14em;font-weight:800;color:var(--lime)}h1{font-size:36px;margin:10px 0}.identity{padding:30px;border:1px solid var(--line);border-radius:24px;background:var(--surface);text-align:center}.portrait{width:112px;height:112px;border-radius:28px;background:var(--surface-2);overflow:hidden;display:grid;place-items:center;margin:auto;border:1px solid #a3e63555}.portrait img{width:100%;height:100%;object-fit:cover}.portrait span{font-size:38px;font-weight:800;color:var(--lime)}h2{font-size:30px;margin:18px 0 5px}.email{color:var(--muted);font-size:14px;overflow-wrap:anywhere}.discipline{display:inline-block;color:var(--lime);background:#a3e63512;padding:8px 14px;border-radius:30px;font-size:14px}dl{text-align:left;margin:28px 0 0}dl>div{padding:18px 0;border-top:1px solid var(--line)}dt{font-size:12px;color:var(--muted);margin-bottom:9px}dd{margin:0;line-height:1.6;overflow-wrap:anywhere}.measurements{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}.measurements article{position:relative;padding:22px;background:var(--surface);border:1px solid var(--line);border-radius:18px}.measurements article>span{font-size:11px;color:var(--lime);font-weight:800}.measurements strong{display:block;margin-top:22px;font-size:32px}.measurements small{font-size:14px;font-weight:400;color:var(--muted);margin-left:6px}.measurements p{font-size:12px;color:var(--muted);line-height:1.6}.eye{position:absolute;right:12px;top:8px;border:0;background:transparent;color:var(--muted);width:44px;height:44px;cursor:pointer}.eye svg{width:23px;height:23px}.progress-link{display:block;padding:18px;text-align:center;color:var(--lime);font-size:14px}.error{color:#fca5a5}@media(max-width:480px){header{align-items:flex-start;flex-direction:column}header .button{width:100%}.identity{padding:24px}.measurements{gap:10px}.measurements article{padding:18px 14px}.measurements strong{font-size:28px}}
  `],
})
export class ProfileViewComponent implements OnInit, OnChanges {
  @Input() visible=true;
  ngOnChanges(changes:SimpleChanges):void {if(changes['visible']?.currentValue&&!changes['visible'].firstChange){this.showWeight.set(localStorage.getItem(this.weightKey)==='true');this.ngOnInit();}}

  readonly auth = inject(AuthService);
  readonly error = signal('');
  readonly photoSaving = signal(false);
  readonly photoSaved = signal(false);
  readonly showWeight = signal(localStorage.getItem(this.weightKey) === 'true');
  private get weightKey(): string { return `smartgymbro_show_weight_${this.auth.user()?.id || 'guest'}`; }
  get initials(): string { return (this.auth.user()?.name || 'U').split(' ').filter(Boolean).map(part => part[0]).join('').slice(0,2).toUpperCase(); }
  ngOnInit(): void { this.auth.refreshProfile().subscribe({ error: () => this.error.set('No pudimos actualizar tu perfil. Se muestran los últimos datos disponibles.') }); }
  /** Comprime y guarda solo la foto; conserva la anterior si la API falla. */
  async uploadPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.photoSaving()) return;
    this.photoSaving.set(true); this.photoSaved.set(false); this.error.set('');
    try {
      const photoUrl = await prepareProfilePhoto(file);
      await firstValueFrom(this.auth.updateProfile({photoUrl}));
      this.photoSaved.set(true);
    } catch (error) {
      const serverMessage = (error as {error?: {message?: string}})?.error?.message;
      this.error.set(serverMessage || (error instanceof Error ? error.message : 'No pudimos guardar la foto. Intentá nuevamente.'));
    } finally {
      this.photoSaving.set(false); input.value = '';
    }
  }
  /** Recuerda la preferencia de privacidad para esta cuenta, también al visitar Progreso. */
  toggleWeight(): void { this.showWeight.update(value => !value); localStorage.setItem(this.weightKey, String(this.showWeight())); }
}
