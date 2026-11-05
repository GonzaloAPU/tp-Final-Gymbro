/** Documenta los modelos y sus FK sin conectarse a ninguna base de datos. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {physicalTable,physicalColumn,spanishTables,spanishColumns} from '../backend/src/services/database-names.js';

process.env.DB_CONNECTION_MODE='LOCAL';
process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
process.env.DB_NAMES_LANGUAGE=process.argv.includes('--es')?'es':'en';
const spanish=process.env.DB_NAMES_LANGUAGE==='es';
const {models}=await import('../backend/src/models/index.js');
const {sequelize}=await import('../backend/src/db.js');
const tableName=table=>typeof table==='string'?table:table.tableName;
const types={UUID:'uuid',STRING:'varchar',TEXT:'text',INTEGER:'integer',BOOLEAN:'boolean',DATE:'timestamptz',TIME:'time',DECIMAL:'numeric',JSONB:'jsonb',ENUM:'enum'};
const ordered=['users','legal_acceptances','user_rest_days','welcome_plans','exercises','routines','routine_days','routine_exercises','routine_schedules','training_sessions','performed_exercises','performed_sets','session_mutations','body_weight_histories','strength_records'].map(name=>physicalTable(name));
const byTable=new Map(Object.values(models).map(model=>[tableName(model.getTableName()),model]));
const lines=['erDiagram','  direction LR'];
let references=0;
for(const name of ordered){
  const model=byTable.get(name);
  if(!model)throw Error(`Falta modelo ${name}`);
  const singleUnique=new Set((model.options.indexes||[]).filter(index=>index.unique&&index.fields.length===1).map(index=>index.fields[0]));
  lines.push(`  ${name} {`);
  for(const attribute of Object.values(model.getAttributes())){
    const keys=[];
    if(attribute.primaryKey)keys.push('PK');
    if(attribute.references)keys.push('FK');
    if(!attribute.primaryKey&&(attribute.unique===true||singleUnique.has(attribute.field)))keys.push('UK');
    const type=types[attribute.type.key];
    if(!type)throw Error(`Tipo sin documentar: ${attribute.type.key}`);
    const details=[attribute.type.toSql(),attribute.primaryKey||attribute.allowNull===false?'NOT NULL':'NULL'].join('; ');
    lines.push(`    ${type} ${attribute.field}${keys.length?' '+keys.join(', '):''} "${details}"`);
  }
  lines.push('  }');
  for(const attribute of Object.values(model.getAttributes()).filter(field=>field.references)){
    const parent=tableName(attribute.references.model);
    if(!byTable.has(parent))throw Error(`Referencia sin modelo: ${parent}`);
    const left=attribute.allowNull===false?'||':'|o';
    const right=singleUnique.has(attribute.field)||attribute.unique===true?'o|':'o{';
    lines.push(`  ${parent} ${left}..${right} ${name} : "${attribute.field}"`);
    references++;
  }
}
lines.push(`  ${physicalTable('schema_migrations')} {`,'    varchar version PK "VARCHAR(80); NOT NULL"',`    timestamptz ${physicalColumn('applied_at')} "NOT NULL; DEFAULT now()"`,'  }');
const diagram=lines.join('\n')+'\n';
const markdown=`# Diagrama actualizado de Gymbro

Esquema PostgreSQL: \`gymbro\`. Generado desde los modelos Sequelize actuales, más la tabla técnica \`schema_migrations\`. Representa el esquema esperado tras aplicar las migraciones; no inspecciona ni modifica Supabase.

16 tablas, ${references} claves foráneas. PK = clave primaria, FK = clave foránea, UK = unicidad de una columna. Las líneas punteadas representan relaciones no identificadoras. Un círculo permite cero; una barra indica uno; el extremo ramificado indica muchos.

## Vista completa

\`\`\`mermaid
${diagram}\`\`\`

## Cambios recientes

- \`users.ai_week_start\` y \`users.ai_weekly_used\`: cupo de tres generaciones de IA por semana. La migración 07 agrega estos campos y la restricción entre 0 y 3.
- \`users.password_changed_at\`: revocación de sesiones después del cambio de contraseña. Los tokens de recuperación no se almacenan en una tabla.
- \`users.leaderboard_opt_in\` y \`legal_acceptances\`: participación en el ranking y recibos de consentimiento.
- \`exercises.description\` y \`exercises.video_url\`: instrucciones y enlace al video, sin almacenar el video.
- \`welcome_plans\`: conserva una propuesta por usuario. Sus preferencias y propuesta son JSONB; al aceptar se crean rutinas, ejercicios y horarios normalizados.
- \`session_mutations\`: recibos durables que evitan aplicar dos veces la misma operación al sincronizar entrenamientos.

## Cómo se organiza

- Planificación: \`routines → routine_days → routine_exercises\`. Los horarios viven en \`routine_schedules\`; \`day_number\` es un orden interno y \`weekday\` identifica el día semanal.
- Ejecución real: \`training_sessions → performed_exercises → performed_sets\`.
- \`strength_records\` sigue presente por compatibilidad. Las marcas personales y el ranking actuales se calculan desde \`performed_sets\` de sesiones completadas. El ranking no tiene una tabla propia.
- \`created_by_user_id\` nulo identifica un ejercicio oficial; con usuario identifica un ejercicio privado.
- \`deleted_at\` permite borrar lógicamente sin eliminar físicamente los registros históricos.
- \`schema_migrations\` es una tabla técnica independiente, sin FK.

## Unicidad compuesta

Además del email único y de una propuesta por usuario, hay índices únicos sobre:

- \`user_rest_days(user_id, weekday)\`.
- \`routine_days(routine_id, day_number)\`.
- \`routine_exercises(routine_day_id, order)\`.
- \`routine_schedules(routine_day_id, weekday, start_time, end_time)\`.
- \`performed_exercises(session_id, order)\`.
- \`performed_sets(performed_exercise_id, set_number)\`.

El catálogo también protege la unicidad del nombre normalizado mediante índices y trigger: distingue ejercicios oficiales de privados.

Para regenerar: \`node tools/build-database-diagram.mjs\`. El SQL entregable está en \`postgres/sql\`.
`;
const suffix=spanish?'-ES':'';
const names={...spanishTables,...spanishColumns};
const documented=spanish?markdown.replace(/\b[a-z_][a-z_0-9]*\b/g,word=>names[word]||word).replace('node tools/build-database-diagram.mjs','node tools/build-database-diagram.mjs --es'):markdown;
fs.writeFileSync(fileURLToPath(new URL(`../docs/DIAGRAMA-BASE-DE-DATOS${suffix}.mmd`,import.meta.url)),diagram);
fs.writeFileSync(fileURLToPath(new URL(`../docs/DIAGRAMA-BASE-DE-DATOS${suffix}.md`,import.meta.url)),documented);
await sequelize.close();
console.log(`Diagrama generado: ${byTable.size+1} tablas y ${references} claves foráneas; sin conexiones externas.`);
