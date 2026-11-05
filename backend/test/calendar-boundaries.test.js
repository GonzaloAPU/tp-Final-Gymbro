/** Límites del calendario: formato, cruces, capacidad diaria y días independientes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleSchema,validateSchedule} from '../src/schedule.js';
const slot=(start='08:00',end='09:00',weekday=1)=>({weekday,start,end});
const invalid=(value)=>assert.equal(scheduleSchema.safeParse({schedule:[value]}).success,false);

test('calendario: vaciar asignaciones es válido',()=>{assert.deepEqual(scheduleSchema.parse({schedule:[]}),{schedule:[]});assert.doesNotThrow(()=>validateSchedule([]));});
test('calendario: rechaza la hora 24:00',()=>invalid(slot('24:00')));
test('calendario: rechaza minutos 60',()=>invalid(slot('08:60')));
test('calendario: exige cero inicial en la hora',()=>invalid(slot('8:00')));
test('calendario: rechaza días fuera de la semana',()=>invalid(slot('08:00','09:00',7)));
test('calendario: rechaza días fraccionarios',()=>invalid(slot('08:00','09:00',1.5)));
test('calendario: rechaza más de 21 asignaciones por solicitud',()=>assert.equal(scheduleSchema.safeParse({schedule:Array.from({length:22},()=>slot())}).success,false));
test('calendario: permite comenzar a medianoche',()=>{const input=slot('00:00','00:01',0);assert.ok(scheduleSchema.safeParse({schedule:[input]}).success);assert.doesNotThrow(()=>validateSchedule([input]));});
test('calendario: rechaza una duración cero',()=>assert.throws(()=>validateSchedule([slot('08:00','08:00')]),{status:400}));
test('calendario: rechaza horarios que cruzan medianoche',()=>assert.throws(()=>validateSchedule([slot('23:00','01:00')]),{status:400}));
test('calendario: detecta un bloque contenido completamente en otro',()=>assert.throws(()=>validateSchedule([slot('09:00','10:00')],[slot('08:00','11:00')]),{status:409}));
test('calendario: permite bloques consecutivos de rutinas distintas',()=>assert.doesNotThrow(()=>validateSchedule([slot('09:00','10:00')],[slot()])));
test('calendario: permite un intervalo libre entre bloques',()=>assert.doesNotThrow(()=>validateSchedule([slot('12:00','13:00')],[slot()])));
test('calendario: permite exactamente tres bloques en un día',()=>assert.doesNotThrow(()=>validateSchedule([slot('10:00','11:00')],[slot(),slot('09:00','10:00')])));
test('calendario: cuenta las otras rutinas para impedir un cuarto bloque',()=>assert.throws(()=>validateSchedule([slot('12:00','13:00')],[slot(),slot('09:00','10:00'),slot('10:00','11:00')]),{status:409}));
test('calendario: el mismo horario en días distintos no es un cruce',()=>assert.doesNotThrow(()=>validateSchedule([slot('08:00','09:00',2)],[slot()])));
