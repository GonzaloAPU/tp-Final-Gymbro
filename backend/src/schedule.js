/**
 * Reglas del calendario: domingo=0 y sábado=6. Valida horas HH:mm, un máximo de tres bloques diarios y ausencia de superposiciones entre todas las rutinas del usuario.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { z } from 'zod';

// El formato HH:mm con ceros permite comparar horas como texto dentro del mismo día.
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z.object({ schedule: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: time, end: time })).max(21) });

/** Combina bloques propios y de otras rutinas, ordena por hora y rechaza cruces o más de tres bloques en un día. */
export function validateSchedule(schedule, otherSlots = []) {
  for (const slot of schedule) {
    if (slot.start >= slot.end) throw Object.assign(new Error('La hora de fin debe ser posterior al inicio, dentro del mismo día.'), { status: 400 });
  }
  const combined = [...otherSlots, ...schedule];
  for (let weekday = 0; weekday < 7; weekday++) {
    const slots = combined.filter(slot => slot.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
    if (slots.length > 3) throw Object.assign(new Error('Podés asignar hasta 3 bloques de rutina por día, entre todas tus rutinas.'), { status: 409 });
    for (let index = 1; index < slots.length; index++) {
      if (slots[index].start < slots[index - 1].end) throw Object.assign(new Error('Los horarios no pueden superponerse. Pueden ser consecutivos o separados.'), { status: 409 });
    }
  }
}
