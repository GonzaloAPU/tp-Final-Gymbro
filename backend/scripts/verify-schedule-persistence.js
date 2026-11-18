/**
 * Comprobación de persistencia de horarios contra la API/base. Leer los datos de prueba y la limpieza antes de ejecutarlo: es una verificación con efectos reales.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { sequelize } from '../src/db.js';
import { RoutineSchedule } from '../src/models/index.js';

const base = `http://localhost:${process.env.PORT || 3000}/api`;
/** Ingresa con la cuenta demo usada por la prueba y devuelve su token. */
async function login() {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sofia@smartgymbro.app', password: 'Demo1234!' }) });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}
/** Envía GET para consultar o PUT si recibe un cuerpo y comprueba la respuesta HTTP. */
async function request(token, path, body) {
  const response = await fetch(base + path, { method: body ? 'PUT' : 'GET', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
let token, path, original;
try {
  token = await login();
  const profile = await request(token, '/auth/me');
  const routines = await request(token, '/routines');
  const routine = routines[0]; const day = routine.days[0];
  original = day.schedule;
  path = `/routines/${routine.id}/days/${day.id}/schedule`;
  const other = routines.flatMap(routine => routine.days).filter(item => item.id !== day.id).flatMap(item => item.schedule);
  const weekday = Array.from({length:7}, (_, i) => i).find(value => !(profile.restDays || []).includes(value) && !other.some(slot => slot.weekday === value));
  assert.notEqual(weekday, undefined, 'Demo account needs a free weekday for this verification');
  const schedule = [{ weekday, start: '08:00', end: '09:00' }, { weekday, start: '09:00', end: '10:00' }, { weekday, start: '18:00', end: '19:00' }];
  await request(token, path, { schedule });
  const rows = await RoutineSchedule.findAll({ where: { routineDayId: day.id }, order: [['start','ASC']] });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].start.slice(0,5), '08:00');
  console.log('PostgreSQL: 3 filas verificadas en routine_schedules.');
  const freshToken = await login();
  const reloaded = await request(freshToken, '/routines');
  assert.deepEqual(reloaded.find(item => item.id === routine.id).days.find(item => item.id === day.id).schedule, schedule);
  console.log('Nuevo inicio de sesión: días y horarios recuperados correctamente.');
  const blockedRest = await fetch(`${base}/auth/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: `Bearer ${freshToken}` }, body: JSON.stringify({ restDays: [...(profile.restDays || []), weekday] }) });
  assert.equal(blockedRest.status, 409, 'A training day must not become a rest day');
  if (profile.restDays?.length) {
    const blockedTraining = await fetch(base + path, { method: 'PUT', headers: { 'content-type': 'application/json', Authorization: `Bearer ${freshToken}` }, body: JSON.stringify({ schedule: [{ weekday: profile.restDays[0], start:'08:00', end:'09:00' }] }) });
    assert.equal(blockedTraining.status, 409, 'Rest day must reject routine assignment');
  }
  console.log('Calendario: protección de los días de descanso verificada.');
} finally {
  if (path && original) {
    await request(token, path, { schedule: original });
    console.log('Se restauraron las asignaciones originales de la cuenta de prueba.');
  }
  await sequelize.close();
}
