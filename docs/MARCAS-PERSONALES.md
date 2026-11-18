# Marcas personales y ranking

«Mejores marcas» se calcula directamente desde las series de fuerza de sesiones completadas de la cuenta. La tabla `strength_records` no era actualizada por el cierre de sesión, por lo que consultarla dejaba la tarjeta vacía aunque hubiera volumen y entrenamientos completados.

El resumen ahora selecciona una serie por ejercicio: mayor carga, más repeticiones en empate y primera fecha para empates exactos. Devuelve hasta ocho ejercicios. Se usa el historial completo, no solo las doce sesiones recientes. Solo cuentan peso y repeticiones positivos; se excluyen sesiones sin finalizar, registros anulados y datos de otros usuarios. Los ejercicios propios o archivados conservan sus marcas personales históricas.

No se insertan registros duplicados ni se requiere backfill o migración. La API obtiene las marcas de sesiones que ya estaban guardadas. La tabla antigua se conserva sin borrar sus filas. El campo estimado de 1RM se mantiene por compatibilidad del contrato, pero la tarjeta compara la carga real, no esa estimación.

El ranking público agrupa las variantes oficiales en tres familias: sentadilla, press de banca (inclinado, declinado y press de pecho incluidos) y peso muerto (incluido rumano). Cada persona aparece una vez por familia, con su mayor carga y la variante realizada. Las cargas de variantes distintas no son equivalentes. Se mantienen la participación voluntaria, las sesiones completadas y las series con carga y repeticiones positivas.
