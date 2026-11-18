/** Comprueba la separación de servidores y evita filtrar JWT al cambiar de backend o llamar servicios externos. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { throwError } = require('rxjs');
const storage = new Map();
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),removeItem:key=>storage.delete(key) };
const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
let native = true;
let endpoint;
const auth = { token: 'test-token' };
function load(path) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, localStorage, require: name => {
    if (name === '@angular/core') return { Injectable: () => target => target, signal, inject: token => token === 'auth' ? auth : endpoint };
    if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => native } };
    if (name.includes('auth.service')) return { AuthService: 'auth' };
    if (name.includes('api-endpoint.service')) return { ApiEndpointService: 'endpoint' };
    if (name === 'rxjs') return { throwError };
    return require(name);
  } });
  return exports;
}
const { ApiEndpointService, normalizeServer,DEFAULT_API_SERVER } = load('frontend/src/app/services/api-endpoint.service.ts');
endpoint = new ApiEndpointService();
assert.equal(endpoint.server(),'http://localhost:3100');
assert.equal(storage.get('gymbro.api-server'),DEFAULT_API_SERVER);
storage.delete('gymbro.default-api-version');storage.set('gymbro.api-server','http://192.168.1.20:3000');storage.set('smartgymbro_token','old-server-token');storage.set('smartgymbro_user','old-profile');storage.set('workout-backup','preserve');
endpoint=new ApiEndpointService();
assert.equal(endpoint.server(),DEFAULT_API_SERVER);
assert.equal(storage.has('smartgymbro_token'),false);assert.equal(storage.has('smartgymbro_user'),false);assert.equal(storage.get('workout-backup'),'preserve');
storage.set('smartgymbro_token','current-server-token');new ApiEndpointService();assert.equal(storage.get('smartgymbro_token'),'current-server-token');storage.delete('smartgymbro_token');
assert.equal(normalizeServer(' https://example.com/ '), 'https://example.com');
for (const value of ['file:///local', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com/?key=secret']) {
  assert.throws(() => normalizeServer(value));
}
const { authInterceptor } = load('frontend/src/app/interceptors/auth.interceptor.ts');
let sent;
const request = url => ({ url, clone: changes => ({ url, ...changes }) });
const next = value => { sent = value; return value; };
authInterceptor(request('/api/auth/me'), next);
assert.equal(sent.url,DEFAULT_API_SERVER+'/api/auth/me','El cliente usa la API de pruebas local sin configurar manualmente');
endpoint.server.set('');sent=undefined;
authInterceptor(request('/api/auth/me'), next).subscribe({ error: error => assert.match(error.message, /Configurá/) });
assert.equal(sent,undefined,'Un servidor vacío no recibe credenciales');
endpoint.save('http://192.168.1.20:3000');
authInterceptor(request('/api/auth/me'), next);
assert.equal(sent.url, 'http://192.168.1.20:3000/api/auth/me');
assert.equal(sent.setHeaders.Authorization, 'Bearer test-token');
for (const url of ['https://external.example/image', '/api-other', '//external.example/api']) {
  authInterceptor(request(url), next);
  assert.equal(sent.url, url);
  assert.equal(sent.setHeaders, undefined, 'Una URL externa no recibe el JWT');
}
storage.set('smartgymbro_token', 'token');
assert.throws(() => endpoint.save('https://other.example'), /Cerrá sesión/);
assert.equal(endpoint.server(), 'http://192.168.1.20:3000');
storage.delete('smartgymbro_token');
endpoint.save('https://api.example');
assert.equal(new ApiEndpointService().server(), 'https://api.example', 'La conexión persiste al reiniciar');
native = false;
endpoint = new ApiEndpointService();
authInterceptor(request('/api/auth/me'), next);
assert.equal(sent.url, '/api/auth/me', 'El navegador conserva el proxy de desarrollo');
console.log('OK: conexión Android persistente, validación de URL, proxy web y aislamiento de tokens.');
