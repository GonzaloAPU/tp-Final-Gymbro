/** Reglas puras del carrusel: distingue arrastres deliberados y gestos rápidos. */
export const MAIN_TABS=['/','/entrenamiento','/progreso','/perfil'] as const;
export function tabPath(url:string):string{return url.split(/[?#]/)[0];}
export function swipeDirection(dx:number,dy:number,elapsed:number,width=400):-1|0|1 {
  const distance=Math.abs(dx),threshold=Math.max(60,Math.min(110,width*.22));
  const flick=elapsed>=0&&elapsed<240&&distance>=40;
  if(elapsed<0||(!flick&&distance<threshold)||distance<Math.abs(dy)*1.5)return 0;
  return dx<0?1:-1;
}
export function adjacentTab(url:string,direction:-1|1):string|null {
  const index=MAIN_TABS.findIndex(path=>path===tabPath(url));
  return index<0?null:MAIN_TABS[(index+direction+MAIN_TABS.length)%MAIN_TABS.length];
}
