/** Comprueba SQL real del ORM con nombres físicos españoles y atributos API previos. */
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DB_NAMES_LANGUAGE='es';
process.env.DB_CONNECTION_MODE='LOCAL';
process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
const {User,Routine,RoutineDay,RoutineExercise,Exercise,PerformedSet,models}=await import('../src/models/index.js');
const {sequelize}=await import('../src/db.js');
const {spanishTables,spanishColumns}=await import('../src/services/database-names.js');
test('modelos español: todas las tablas, columnas, índices y FK usan el diccionario',()=>{
 for(const model of Object.values(models)){
  assert.ok(Object.values(spanishTables).includes(model.tableName));
  for(const attribute of Object.values(model.getAttributes())){
   assert.ok(Object.values(spanishColumns).includes(attribute.field),attribute.field);
   if(attribute.references){const ref=attribute.references.model;assert.ok(Object.values(spanishTables).includes(typeof ref==='string'?ref:ref.tableName));}
  }
 }
 assert.equal(User.getAttributes().passwordHash.field,'hash_contrasena');
 assert.equal(User.getAttributes().aiWeeklyUsed.field,'generaciones_ia_semana');
 assert.equal(PerformedSet.getAttributes().weightKg.field,'peso_kg');
 assert.deepEqual(User.build({id:'id',name:'Nombre',aiWeeklyUsed:2}).get({plain:true}).name,'Nombre');
});
test('modelos español: SELECT, JOIN y borrado lógico mantienen sus campos y alias',async t=>{
 const sql=[];t.mock.method(sequelize,'query',async query=>{sql.push(typeof query==='string'?query:query.query);return [];});
 await Routine.findAll({include:[{model:RoutineDay,as:'days',include:[{model:RoutineExercise,as:'exercises',include:[{model:Exercise,as:'exercise'}]}]}]});
 assert.match(sql[0],/"rutinas"/);assert.match(sql[0],/"rutina_id"/);assert.match(sql[0],/"dia_rutina_id"/);
 assert.match(sql[0],/"fecha_eliminacion" IS NULL/);assert.match(sql[0],/AS "days.exercises.exercise.name"/);
 assert.doesNotMatch(sql[0],/\."routine_id"|\."routine_day_id"|\."deleted_at"/);
});
test('modelos español: insertar y actualizar conservan atributos API sin escribir nombres anteriores',async t=>{
 const sql=[];t.mock.method(sequelize,'query',async query=>{sql.push(typeof query==='string'?query:query.query);return [User.build({id:'11111111-1111-4111-8111-111111111111',name:'Nombre'}),1];});
 await User.update({name:'Nombre',aiWeeklyUsed:2},{where:{email:'test@example.invalid'}});
 assert.match(sql[0],/UPDATE "usuarios" SET "nombre"/);
 assert.match(sql[0],/"generaciones_ia_semana"/);assert.match(sql[0],/"correo_electronico"/);
 assert.doesNotMatch(sql[0],/"ai_weekly_used"|"email"/);
});

test('recuperación en español: busca el correo sin mayúsculas usando la columna traducida',async t=>{
 const {requestRecovery,recoveryDelivery,recoveryLimiter}=await import('../src/services/password-recovery.js');
 const sql=[];
 t.mock.method(recoveryDelivery,'configured',()=>true);
 t.mock.method(recoveryLimiter,'allow',()=>true);
 t.mock.method(recoveryDelivery,'send',()=>assert.fail('Esta prueba no debe enviar correos'));
 t.mock.method(sequelize,'query',async (query,options)=>{sql.push(typeof query==='string'?query:query.query);return options?.plain?null:[];});
 await requestRecovery('Prueba@Example.invalid');
 assert.equal(sql.length,1);
 assert.match(sql[0],/lower\("correo_electronico"\)/);
 assert.doesNotMatch(sql[0],/lower\("email"\)/);
 assert.match(sql[0],/prueba@example\.invalid/);
});
