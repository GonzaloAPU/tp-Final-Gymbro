/**
 * Prepara fotos en el navegador: detecta JPEG/PNG, reduce dimensiones y calidad con canvas y devuelve JPEG Base64. Así evita subir directamente una foto pesada del teléfono.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
/** Reduce la foto localmente antes de enviarla al servidor. */
/** Devuelve una promesa con la foto JPEG comprimida; libera la URL temporal incluso si ocurre un error. */
export async function prepareProfilePhoto(file: File): Promise<string> {
  // Algunos teléfonos etiquetan los JPEG como application/octet-stream o image/pjpeg.
  // Comprueba bytes de firma porque algunos teléfonos asignan un MIME genérico a archivos JPEG válidos.
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const detectedType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : file.type;
  if (detectedType && !detectedType.startsWith('image/')) throw new Error('Elegí una imagen JPG, JPEG, PNG o WebP.');
  const source = detectedType !== file.type ? new Blob([file], { type: detectedType }) : file;
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No pudimos abrir esta imagen. Probá con otra foto JPG o JPEG.'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('La imagen no se pudo leer. Elegí otra foto.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No pudimos preparar tu foto. Intentá con otro navegador.');
    let longest = Math.min(1280, Math.max(image.naturalWidth, image.naturalHeight));
    // Intenta varias calidades y luego reduce resolución; el límite mide caracteres Base64, no bytes del archivo original.
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, longest / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.75, 0.6]) {
        const result = canvas.toDataURL('image/jpeg', quality);
        if (result.length <= 650000) return result;
      }
      longest = Math.max(128, Math.floor(longest * 0.7));
    }
    throw new Error('No pudimos procesar esta foto. Probá con otra de tu galería.');
  // finally se ejecuta tanto al devolver la foto como al producirse un error.
  } finally {
    URL.revokeObjectURL(url);
  }
}
