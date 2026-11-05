/**
 * Página incluida en la API: el enlace funciona desde Android sin alojar otra web.
 * La estructura HTML es la misma para todas las cuentas. El JWT viene en #token=...
 * y no se incrusta desde el servidor en este HTML.
 * nonce autoriza este script ante CSP; no autoriza cambiar la contraseña.
 */
export function passwordResetPage(nonce){return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nueva contraseña — Gymbro</title><style>
*{box-sizing:border-box}body{margin:0;background:#090d18;color:#f8fafc;font:16px/1.6 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{width:min(100%,460px);padding:32px;background:#111827;border:1px solid #293449;border-radius:24px}b{color:#a3e635}h1{font-size:30px;line-height:1.2}p{color:#a5b4c8}label{display:block;margin:18px 0}input{display:block;width:100%;margin-top:8px;padding:14px;border-radius:10px;border:1px solid #334155;background:#1c2738;color:white;font:inherit}button{width:100%;padding:14px;border:0;border-radius:10px;background:#a3e635;color:#101a08;font:700 16px system-ui;cursor:pointer}button:disabled{opacity:.5;cursor:wait}#message{white-space:pre-line}input:focus-visible,button:focus-visible{outline:2px solid #a3e635;outline-offset:3px}</style></head><body><main><b>GYMBRO</b><h1>Elegí tu nueva contraseña</h1><p>Usá al menos 8 caracteres. El enlace vence en 15 minutos.</p><form id="reset"><label>Nueva contraseña<input id="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><label>Repetir contraseña<input id="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><button id="save" type="submit">Guardar nueva contraseña</button></form><p id="message" role="status" aria-live="polite"></p><p>Después volvé a Gymbro para iniciar sesión.</p></main><script nonce="${nonce}">
// location.hash contiene el fragmento que empieza con #.
// El navegador no lo envió en el GET; este script lo lee y conserva en memoria.
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';

// Retira el token de la dirección visible. Esto NO lo consume ni lo invalida.
// Como queda en memoria, recargar esta dirección sin fragmento ya no lo recupera.
history.replaceState(null,'',location.pathname);

const form=document.getElementById('reset');
const button=document.getElementById('save');
const message=document.getElementById('message');
let busy=false;

// Solo comprueba que haya algún token. Su autenticidad y vencimiento
// NO se deciden aquí: un usuario puede modificar el JavaScript de su navegador.
if(!token){
  form.hidden=true;
  message.textContent='Este enlace no es válido. Solicitá uno nuevo desde «Olvidé mi contraseña» en Gymbro.';
}

form.addEventListener('submit',async event=>{
  // Evita el envío HTML tradicional, que recargaría la página.
  event.preventDefault();
  if(busy)return;

  const password=document.getElementById('password').value;
  if(password!==document.getElementById('confirm').value){
    message.textContent='Las contraseñas no coinciden.';
    return;
  }

  // Impide dobles clics mientras se espera la respuesta.
  busy=true;
  button.disabled=true;
  button.textContent='Guardando…';
  message.textContent='';
  try{
    // location.pathname es /api/auth/reset-password: la MISMA ruta usada para
    // descargar el formulario, ahora con POST para solicitar el cambio.
    // El token viaja explícitamente en el JSON y la conexión debe usar HTTPS.
    const response=await fetch(location.pathname,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token,password}),
      // 75 segundos de espera de red; esto no amplía los 15 minutos del JWT.
      signal:AbortSignal.timeout(75000),
    });
    const result=await response.json();
    if(!response.ok)throw Error(result.issues?.[0]?.message||result.message||'No pudimos cambiar tu contraseña.');

    // Solo se muestra éxito después de que la API confirmó el cambio.
    // Se vacían los campos; no se inicia sesión automáticamente.
    form.hidden=true;
    form.reset();
    message.textContent=result.message;
  }catch(error){
    message.textContent=error.name==='TimeoutError'
      ?'El servidor tardó demasiado. Intentá de nuevo.'
      :error.message==='Failed to fetch'
        ?'No pudimos conectar. Revisá tu conexión e intentá de nuevo.'
        :error.message;
  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='Guardar nueva contraseña';
  }
});
</script></body></html>`;}
