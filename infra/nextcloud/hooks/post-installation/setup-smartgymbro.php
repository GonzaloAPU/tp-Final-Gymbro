<?php
/** Punto 12: documentos compartidos, permisos, informes y registro verificable.
 * --check no carga Nextcloud ni modifica datos. --verify solo comprueba la instalación.
 * Sin opciones aplica cambios. No modifica contraseñas de cuentas existentes.
 */
declare(strict_types=1);
const ROOT_NAME = 'SmartGymBro-TP-Final';
const TEAM = 'SmartGymBro-Equipo';
const FOLDERS = [
 '01-Arquitectura-y-Gestion-Agil', '02-Base-de-Datos-y-Replicacion',
 '03-Docker-CI-CD-y-Rollback', '04-Seguridad-e-Incidencias',
 '05-Monitoreo-y-Automatizacion', '06-Registro-Versiones-Entregables',
];
const MEMBERS = [
 'gonzalo' => ['Gonzalo (Arquitectura)', 'Rol-Admin-Arquitectura', 0],
 'facundo' => ['Facundo (Base de datos)', 'Rol-DBA-Datos', 1],
 'aldo' => ['Aldo Dante (DevOps)', 'Rol-DevOps-CI-CD', 2],
 'rodrigo' => ['Rodrigo (Seguridad)', 'Rol-SecOps-Calidad', 3],
 'sonia' => ['Sonia (Monitoreo y n8n)', 'Rol-Observabilidad-SRE', 4],
];
function fail(string $message): never { throw new RuntimeException($message); }
function folder($parent, string $name) {
 $node = $parent->nodeExists($name) ? $parent->get($name) : $parent->newFolder($name);
 if (!$node instanceof \OCP\Files\Folder) fail("No es carpeta: $name");
 return $node;
}
function put($dir, string $name, string $bytes): void {
 if ($dir->nodeExists($name)) {
  $node = $dir->get($name);
  if (!$node instanceof \OCP\Files\File) fail("No es archivo: $name");
  if ($node->getContent() === $bytes) return;
  $node->putContent($bytes); // API de Nextcloud: mantiene caché, eventos e historial nativo.
 } else $dir->newFile($name, $bytes);
}
function policyPermissions(string $uid, int $index): int {
 // 1 lectura; 15 lectura/actualización/creación/borrado. Nunca delega compartir (16).
 return ($uid === 'gonzalo' || MEMBERS[$uid][2] === $index || $index === 5) ? 15 : 1;
}
try {
 $mode = $argv[1] ?? '';
 if (!in_array($mode, ['', '--check', '--verify'], true)) fail('Uso: script [--check|--verify]');
 $source = getenv('NEXTCLOUD_REPORTS_DIR') ?: '/opt/project-reports';
 $manifestPath = "$source/manifest.json";
 if (!is_file($manifestPath)) fail("Falta $manifestPath; montar infra/nextcloud/informes en /opt/project-reports.");
 $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
 if (count($manifest) !== 10) fail('Se esperan los diez informes revisados del equipo.');
 $seen = [];
 foreach ($manifest as $entry) {
  $name = $entry['archivo']; $uid = $entry['responsable'];
  if (basename($name) !== $name || !str_ends_with($name, '.pdf') || isset($seen[$name])) fail('Nombre inválido o duplicado.');
  $seen[$name] = true;
  if (!isset(MEMBERS[$uid]) || $entry['carpeta'] !== FOLDERS[MEMBERS[$uid][2]]) fail("Responsable/carpeta inválidos: $name");
  $path = "$source/$name";
  if (!is_file($path) || substr(file_get_contents($path, false, null, 0, 5), 0, 5) !== '%PDF-') fail("PDF ausente/inválido: $name");
  if (!hash_equals($entry['sha256'], hash_file('sha256', $path))) fail("Cambió el PDF: revisar y actualizar manifest.json antes de cargar $name");
 }
 if ($mode === '--check') { echo "OK: 10 PDF, responsables, carpetas y SHA-256 verificados. Sin cambios.\n"; exit(0); }
 define('OC_CONSOLE', 1);
 require_once '/var/www/html/lib/base.php';
 $users = \OC::$server->getUserManager();
 $groups = \OC::$server->getGroupManager();
 $config = \OC::$server->getConfig();
 $shares = \OC::$server->getShareManager();
 $root = \OC::$server->getRootFolder();
 $allowed = array_merge(['admin'], array_keys(MEMBERS));
 foreach ($users->search('') as $u) {
  if (!in_array($u->getUID(), $allowed, true)) fail('Hay cuentas fuera del equipo. Revisarlas antes de certificar el acceso: '.$u->getUID());
 }
 if ($mode !== '--verify') {
  $apps = \OC::$server->getAppManager();
  foreach (['files_sharing','files_versions','files_trashbin','dav'] as $app) $apps->enableApp($app);
  foreach (['default_language'=>'es','default_locale'=>'es_AR','default_phone_region'=>'AR'] as $k=>$v) $config->setSystemValue($k,$v);
  // No se copian automáticamente carpetas a nuevas cuentas.
  $config->setSystemValue('skeletondirectory','');
  foreach (['shareapi_allow_links'=>'no','shareapi_allow_public_upload'=>'no',
   'shareapi_allow_resharing'=>'no','shareapi_allow_group_sharing'=>'no',
   'shareapi_only_share_with_group_members'=>'yes','shareapi_enforce_links_password'=>'yes'] as $k=>$v) $config->setAppValue('core',$k,$v);
  $config->setSystemValue('sharing.enable_share_mail',false);
  $team = $groups->get(TEAM) ?: $groups->createGroup(TEAM);
  foreach (MEMBERS as $uid=>[$label,$role,$index]) {
   $user = $users->get($uid);
   if (!$user) {
    // Se descarta la contraseña aleatoria: el administrador establece una propia
    // con occ user:resetpassword (interactivo) o la interfaz. Nunca se imprime ni guarda.
    $user = $users->createUser($uid, bin2hex(random_bytes(32)).'aA1!');
    if (!$user) fail("No se pudo crear $uid");
    $user->setDisplayName($label);
    echo "Cuenta nueva $uid: establecer contraseña desde administración antes de usarla.\n";
   }
   $team->addUser($user);
   ($groups->get($role) ?: $groups->createGroup($role))->addUser($user);
   // Configuración de cuota por la API del usuario, sin sobrescribir correo personal.
   $user->setQuota('5 GB');
   if ($uid==='gonzalo') $groups->get('admin')->addUser($user);
   folder($root->getUserFolder($uid),ROOT_NAME);
  }
 }
 $owner = $users->get('gonzalo');
 if (!$owner) fail('Falta gonzalo: aplicar primero el script.');
 \OC::$server->getUserSession()->setUser($owner);
 \OC_Util::setupFS('gonzalo');
 $home = $root->getUserFolder('gonzalo');
 $base = $mode==='--verify' ? $home->get(ROOT_NAME) : folder($home,ROOT_NAME);
 if ($mode !== '--verify') {
  $dirs = [];
  foreach (FOLDERS as $f) $dirs[$f]=folder($base,$f);
  // Lista cerrada: no se importan .env, repositorios completos, claves ni configuraciones operativas.
  $docs = [
   0=>['ASIGNACION.md','BIENVENIDA.md','CRONOGRAMA.md','FLUJO-GIT.md','INTEGRACION.md'],
   1=>['DIAGRAMA-BASE-DE-DATOS-ES.md','DIAGRAMA-BASE-DE-DATOS.md','MARCAS-PERSONALES.md','NOMBRES-BASE-ESPANOL.md'],
   2=>['ANGULAR-22.md','ROLLBACK.md','VALIDACION-INICIAL.md'],
  ];
  foreach ($docs as $i=>$names) foreach ($names as $name) {
   $path="/opt/project-docs/$name";
   if (is_file($path)) {
    $text=file_get_contents($path);
    if (preg_match('/-----BEGIN .*PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})/', $text)) fail("Posible secreto en $name: no importado.");
    // No reemplazar documentación que el equipo haya editado desde Nextcloud.
    if (!$dirs[FOLDERS[$i]]->nodeExists($name)) put($dirs[FOLDERS[$i]],$name,$text);
   } else echo "Aviso: documento opcional ausente: $name\n";
  }
  $ledger = $dirs[FOLDERS[5]];
  $archive=folder($ledger,'Versiones-PDF');
  $rows=[];
  foreach ($manifest as $entry) {
   $bytes=file_get_contents("$source/".$entry['archivo']);
   $dir=$dirs[$entry['carpeta']]; $name=$entry['archivo'];
   // Copia histórica identificada por contenido: no inventa número de revisión ni autoría del PDF.
   if ($dir->nodeExists($name)) {
    $old=$dir->get($name)->getContent(); $hash=hash('sha256',$old);
    put($archive,$hash.'--'.$name,$old);
   }
   put($archive,$entry['sha256'].'--'.$name,$bytes);
   put($dir,$name,$bytes);
   $rows[]='| '.$name.' | '.$entry['responsable'].' | '.$entry['carpeta'].' | `'.$entry['sha256'].'` |';
  }
  $record="# Registro de entregables\n\nResponsables según los archivos y la identificación aportada por el equipo.\nLa huella SHA-256 identifica la revisión exacta; no se atribuyen versiones anteriores inexistentes.\n\n| Informe | Responsable | Carpeta | SHA-256 |\n|---|---|---|---|\n".implode("\n",$rows)."\n\nLas revisiones se conservan en Versiones-PDF por su hash y mediante files_versions.\n";
  put($ledger,'REGISTRO-INFORMES.md',$record);
  put($ledger,'manifest.json',file_get_contents($manifestPath));
  $matrix="# Matriz de permisos\n\nGonzalo es propietario y administrador. Los demás reciben lectura en todas las carpetas y edición únicamente en su área y en 06-Registro-Versiones-Entregables.\n\n| Usuario | Área editable |\n|---|---|\n| facundo | 02-Base-de-Datos-y-Replicacion |\n| aldo (Aldo Dante) | 03-Docker-CI-CD-y-Rollback |\n| rodrigo | 04-Seguridad-e-Incidencias |\n| sonia | 05-Monitoreo-y-Automatizacion |\n\nNo se permite volver a compartir ni crear enlaces públicos. La cuenta admin de instalación conserva sus privilegios administrativos.\n";
  put($ledger,'MATRIZ-PERMISOS.md',$matrix);
  put($dirs[FOLDERS[3]],'PROTECCION-DE-SECRETOS.md',"# Protección de secretos\n\nNo cargar .env, claves privadas, tokens ni contraseñas. Importación de PDF limitada al manifiesto revisado. Revisar también capturas e imágenes antes de actualizarlo. Credenciales nuevas aleatorias descartadas; configurar cada cuenta por canal administrativo. No hay enlaces públicos ni permiso de volver a compartir.\n");
  // Comparticiones directas: evita sumar permisos de grupos superpuestos.
  foreach (MEMBERS as $uid=>$member) {
   if ($uid==='gonzalo') continue;
   $previous=$config->getUserValue($uid,'files_sharing','share_folder','');
   $config->setUserValue($uid,'files_sharing','share_folder','/'.ROOT_NAME);
   try {
    foreach (FOLDERS as $i=>$name) {
     $node=$dirs[$name]; $found=null;
     foreach ($shares->getSharesBy('gonzalo',\OCP\Share\IShare::TYPE_USER,$node,false,-1) as $s) {
      if ($s->getSharedWith()===$uid) { $found=$s; break; }
     }
     $perms=policyPermissions($uid,$i);
     if ($found) {
      if ($found->getPermissions()!==$perms) { $found->setPermissions($perms); $shares->updateShare($found); }
     } else {
      $s=$shares->newShare(); $s->setNode($node)->setShareType(\OCP\Share\IShare::TYPE_USER)
       ->setSharedWith($uid)->setSharedBy('gonzalo')->setPermissions($perms);
      $shares->createShare($s);
     }
    }
   } finally {
    if ($previous==='') $config->deleteUserValue($uid,'files_sharing','share_folder');
    else $config->setUserValue($uid,'files_sharing','share_folder',$previous);
   }
  }
 }
 require __DIR__.'/sincronizar-cierre.php';
 // Verificar todas las comparticiones de los documentos, incluso enlaces antiguos.
 $checks=[];
 $nodes=[$base];
 for ($n=0;$n<count($nodes);$n++) if ($nodes[$n] instanceof \OCP\Files\Folder)
  foreach ($nodes[$n]->getDirectoryListing() as $child) $nodes[]=$child;
 foreach ($nodes as $node) {
  // getSharesByPath es un método sin implementar en Nextcloud 29.
  foreach ([0,1,3,4] as $type) {
   foreach ($shares->getSharesBy('gonzalo',$type,$node,false,-1) as $s) {
    $i=array_search($node->getName(),FOLDERS,true);
    if ($type!==0 || !isset(MEMBERS[$s->getSharedWith()]) || $i===false
      || $node->getParent()->getId()!==$base->getId()
      || $s->getPermissions()!==policyPermissions($s->getSharedWith(),$i))
     fail('Compartición no autorizada detectada: '.$node->getName().'. Revisarla manualmente.');
   }
  }
 }
 foreach (FOLDERS as $i=>$name) {
  $node=$base->get($name);
  foreach (MEMBERS as $uid=>$member) {
   if ($uid==='gonzalo') continue;
   $found=[];
   foreach($shares->getSharesBy('gonzalo',\OCP\Share\IShare::TYPE_USER,$node,false,-1) as $s)
    if ($s->getSharedWith()===$uid) $found[]=$s;
   if(count($found)!==1 || $found[0]->getPermissions()!==policyPermissions($uid,$i)) fail("Permisos incorrectos: $uid / $name");
   $checks[]=['usuario'=>$uid,'carpeta'=>$name,'permisos'=>$found[0]->getPermissions()];
  }
 }
 foreach($manifest as $entry) {
  $stored=$base->get($entry['carpeta'])->get($entry['archivo'])->getContent();
  if(!hash_equals($entry['sha256'],hash('sha256',$stored))) fail('PDF almacenado distinto: '.$entry['archivo']);
 }
 $result=['fecha_utc'=>gmdate('c'),'pdf_verificados'=>count($manifest),'permisos_configurados'=>$checks,
  'alcance'=>'Comprueba contenido, comparticiones y destinatarios. Las pruebas interactivas de login y escritura por usuario se documentan por separado.'];
 if($mode!=='--verify') put($base->get(FOLDERS[5]),'VERIFICACION-PUNTO12.json',json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)."\n");
 echo "OK: diez informes verificados y 24 permisos de carpeta comprobados.\n";
 echo "Las cuentas nuevas requieren una contraseña personal; las existentes se conservan.\n";
} catch (Throwable $e) { fwrite(STDERR,'ERROR: '.$e->getMessage().' en '.$e->getFile().':'.$e->getLine()."\n"); exit(1); }
