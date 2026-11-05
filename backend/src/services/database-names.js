/** Nombres físicos; las propiedades JavaScript y el contrato de la API se conservan. */
export const spanishTables={users:'usuarios',user_rest_days:'dias_descanso_usuario',exercises:'ejercicios',routines:'rutinas',routine_days:'dias_rutina',routine_exercises:'ejercicios_rutina',routine_schedules:'horarios_rutina',training_sessions:'sesiones_entrenamiento',performed_exercises:'ejercicios_realizados',performed_sets:'series_realizadas',body_weight_histories:'historial_peso_corporal',strength_records:'marcas_fuerza',session_mutations:'operaciones_sesion',welcome_plans:'planes_iniciales',legal_acceptances:'consentimientos_legales',schema_migrations:'migraciones_esquema'};
export const spanishColumns={
 active:'activa',
 id:'id',version:'version',email:'correo_electronico',password_hash:'hash_contrasena',name:'nombre',goal:'objetivo',height_cm:'altura_cm',gym_name:'nombre_gimnasio',discipline:'disciplina',photo_url:'foto_url',created_at:'fecha_creacion',updated_at:'fecha_actualizacion',deleted_at:'fecha_eliminacion',leaderboard_opt_in:'participa_ranking',password_changed_at:'fecha_cambio_contrasena',ai_week_start:'inicio_semana_ia',ai_weekly_used:'generaciones_ia_semana',
 weekday:'dia_semana',user_id:'usuario_id',preferences:'preferencias',proposal:'propuesta',source:'origen',accepted_at:'fecha_aceptacion',skipped_at:'fecha_omision',routine_id:'rutina_id',normalized_name:'nombre_normalizado',muscle_group:'grupo_muscular',equipment:'equipamiento',movement_pattern:'patron_movimiento',training_type:'tipo_entrenamiento',created_by_user_id:'creado_por_usuario_id',description:'descripcion',video_url:'enlace_video',favorite:'favorita',day_number:'numero_dia',routine_day_id:'dia_rutina_id',order:'orden',target_sets:'series_objetivo',min_reps:'repeticiones_minimas',max_reps:'repeticiones_maximas',rest_seconds:'descanso_segundos',target_duration_minutes:'duracion_objetivo_minutos',target_distance_km:'distancia_objetivo_km',intensity:'intensidad',exercise_id:'ejercicio_id',start_time:'hora_inicio',end_time:'hora_fin',started_at:'fecha_inicio',finished_at:'fecha_fin',duration_seconds:'duracion_segundos',status:'estado',calories:'calorias',total_volume_kg:'volumen_total_kg',session_id:'sesion_id',set_number:'numero_serie',weight_kg:'peso_kg',repetitions:'repeticiones',actual_rest_seconds:'descanso_real_segundos',completed_at:'fecha_finalizacion',performed_exercise_id:'ejercicio_realizado_id',recorded_at:'fecha_registro',max_weight_kg:'peso_maximo_kg',estimated_one_rm:'estimacion_1rm',achieved_at:'fecha_marca',kind:'tipo',request_hash:'hash_solicitud',response:'respuesta',status_code:'codigo_estado',applied_at:'fecha_aplicacion',document_hash:'hash_documento',documents:'documentos',terms_accepted:'terminos_aceptados',privacy_acknowledged:'privacidad_reconocida',adult_confirmed:'mayoria_edad_confirmada',sports_data_consent:'permiso_datos_deportivos',
};
export function databaseLanguage(){
 const language=process.env.DB_NAMES_LANGUAGE||'en';
 if(!['en','es'].includes(language))throw Error('DB_NAMES_LANGUAGE debe ser en o es');
 return language;
}
export const physicalColumn=(name,language=databaseLanguage())=>language==='es'?(spanishColumns[name]||name):name;
export const physicalTable=(name,language=databaseLanguage())=>language==='es'?(spanishTables[name]||name):name;

/** Proyección interna para consultas de informes; sus alias y respuestas no cambian. */
export function reportTable(table,columns,language=databaseLanguage()){
 if(language!=='es')return table;
 return `(SELECT ${columns.map(name=>`"${physicalColumn(name,language)}" AS "${name}"`).join(', ')} FROM ${table})`;
}

export function applySpanishModelNames(models){
 if(databaseLanguage()!=='es')return;
 for(const model of Object.values(models)){
  model.tableName=physicalTable(model.tableName);
  model.options.tableName=model.tableName;
  for(const attribute of Object.values(model.rawAttributes)){
   attribute.field=physicalColumn(attribute.field);
   if(attribute.references){const ref=attribute.references.model;attribute.references.model=typeof ref==='string'?physicalTable(ref):{...ref,tableName:physicalTable(ref.tableName)};}
  }
  for(const index of model.options.indexes||[])index.fields=index.fields.map(field=>typeof field==='string'?physicalColumn(field):{...field,name:physicalColumn(field.name)});
  for(const key of Object.values(model.uniqueKeys||{}))key.fields=key.fields.map(field=>physicalColumn(field));
  model.refreshAttributes();
 }
 // Sequelize guarda también los nombres físicos en las asociaciones ya creadas.
 for(const model of Object.values(models))for(const association of Object.values(model.associations)){
  for(const key of ['identifierField','foreignKeyField','sourceKeyField','targetKeyField'])if(typeof association[key]==='string')association[key]=physicalColumn(association[key]);
 }
}
