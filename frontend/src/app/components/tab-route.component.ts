/** La ruta conserva sus guardas; AppComponent presenta la vista persistente del carrusel. */
import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
@Component({selector:'app-tab-route',standalone:true,changeDetection: ChangeDetectionStrategy.Eager,
template:''})
export class TabRouteComponent {
  readonly index=inject(ActivatedRoute).snapshot.data['tab'] as number;
}
