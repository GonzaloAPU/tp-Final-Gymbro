/** Agrega ejercicios sin modificar los existentes ni crear cuentas o rutinas. */
import 'dotenv/config';
import { sequelize } from '../src/db.js';
import { Exercise } from '../src/models/index.js';
import { exerciseData } from '../src/data/exercise-catalog.js';
import {normalizeExerciseName as normalize} from '../src/services/exercise-access.js';
try {
  await sequelize.authenticate();
  const result = await sequelize.transaction(async transaction => {
    // El bloqueo evita duplicados si dos cargas del catálogo se ejecutan a la vez.
    await sequelize.query('LOCK TABLE exercises IN SHARE ROW EXCLUSIVE MODE', {transaction});
    const existing = new Set((await Exercise.findAll({attributes:['name'],where:{createdByUserId:null},paranoid:false,transaction})).map(row=>normalize(row.name)));
    let added = 0;
    for (const data of exerciseData) {
      if (existing.has(normalize(data.name))) continue;
      await Exercise.create(data,{transaction}); existing.add(normalize(data.name)); added++;
    }
    return { added, total:await Exercise.count({transaction}) };
  });
  console.log(JSON.stringify(result));
} finally { await sequelize.close(); }
