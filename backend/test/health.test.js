/**
 * Prueba automatizada del backend: prepara dependencias o datos simulados, ejecuta una operación y usa assert para comprobar el comportamiento. No forma parte del servidor que usa el usuario.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

test("health endpoint responds without database access", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'),null);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(), { status: "ok", service: "smartgymbro-api" });
  // Android usa este origen aunque el backend esté en otra máquina de la red.
  const native = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Origin: 'https://localhost' } });
  assert.equal(native.headers.get('access-control-allow-origin'), 'https://localhost');
  const external = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(external.headers.get('access-control-allow-origin'), null);
});
