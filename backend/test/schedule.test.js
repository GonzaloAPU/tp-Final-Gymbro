/**
 * Prueba automatizada del backend: prepara dependencias o datos simulados, ejecuta una operación y usa assert para comprobar el comportamiento. No forma parte del servidor que usa el usuario.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSchema, validateSchedule } from '../src/schedule.js';
const slot = (start, end, weekday = 1) => ({ start, end, weekday });

test('schedule allows consecutive and separated slots and counts other routines', () => {
  assert.doesNotThrow(() => validateSchedule([slot('08:00', '09:00'), slot('09:00', '10:00')], [slot('18:00', '19:00')]));
  assert.throws(() => validateSchedule([slot('20:00', '21:00')], [slot('08:00', '09:00'), slot('09:00', '10:00'), slot('18:00', '19:00')]), /hasta 3/);
  assert.doesNotThrow(() => validateSchedule([slot('08:00', '09:00', 0)], [slot('08:00', '09:00', 1)]));
});
test('schedule rejects overlaps, duplicates, invalid times and inverted ranges', () => {
  assert.throws(() => validateSchedule([slot('08:30', '09:30')], [slot('08:00', '09:00')]), /superponerse/);
  assert.throws(() => validateSchedule([slot('08:00', '09:00'), slot('08:00', '09:00')]), /superponerse/);
  assert.throws(() => validateSchedule([slot('10:00', '09:00')]), /posterior/);
  assert.throws(() => validateSchedule([slot('09:00', '09:00')]), /posterior/);
  assert.equal(scheduleSchema.safeParse({ schedule: [slot('24:00', '25:00')] }).success, false);
  assert.equal(scheduleSchema.safeParse({ schedule: [slot('08:00', '09:00', 7)] }).success, false);
  assert.doesNotThrow(() => validateSchedule([]));
});
