/**
 * Simula Image, canvas y URL para probar la preparación de fotos JPEG y la liberación de recursos sin cargar una imagen en un navegador real.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const output = {};
let sourceType, revoked = 0;
let canvas;
class FakeImage {
  naturalWidth = 4032;
  naturalHeight = 3024;
  set src(value) { queueMicrotask(() => this.onload()); }
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/app/services/profile-photo.ts','utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: output, Blob, Uint8Array, Image: FakeImage, queueMicrotask,
  URL: { createObjectURL: source => { sourceType = source.type; return 'blob:test'; }, revokeObjectURL: () => revoked++ },
  document: { createElement: () => canvas = { width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,/9j/AA==' } },
});
(async () => {
  for (const type of ['image/jpeg','image/pjpeg','application/octet-stream','']) {
    const file = new File([new Uint8Array([255,216,255,224])], 'telefono.jpeg', {type});
    const result = await output.prepareProfilePhoto(file);
    assert.equal(sourceType,'image/jpeg');
    assert.ok(result.startsWith('data:image/jpeg;base64,'));
    assert.equal(canvas.width,1280);
    assert.equal(canvas.height,960);
  }
  assert.equal(revoked,4);
  await assert.rejects(output.prepareProfilePhoto(new File(['invalid'],'document.pdf',{type:'application/pdf'})), /JPEG/);
  console.log('OK: JPEG normal, progresivo, MIME genérico y vacío; reducción proporcional y limpieza.');
})().catch(error => { console.error(error); process.exitCode=1; });
