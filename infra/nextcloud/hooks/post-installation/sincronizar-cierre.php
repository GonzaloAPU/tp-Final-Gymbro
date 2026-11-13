<?php
// Complemento opcional del aprovisionamiento. Solo admite el paquete revisado de cierre.
$sourceCierre='/opt/project-reports/cierre';
if(is_file($sourceCierre.'/manifest.json')) {
 $extra=json_decode(file_get_contents($sourceCierre.'/manifest.json'),true,512,JSON_THROW_ON_ERROR);
 foreach($extra as $item) {
  $name=$item['archivo'];
  if(basename($name)!==$name || !in_array($item['carpeta'],[FOLDERS[0],FOLDERS[5]],true)) fail('Destino de cierre inválido');
  $path=$sourceCierre.'/'.$name;
  if(!is_file($path)||!is_readable($path)||!hash_equals($item['sha256'],hash_file('sha256',$path))) fail('Archivo de cierre alterado: '.$name);
  $target=$base->get($item['carpeta']);
  if($mode!=='--verify') {
   if(isset($item['version_anterior'])) {
    $old=$item['version_anterior'];
    if(basename($old['archivo'])!==$old['archivo'])fail('Revisión anterior inválida');
    $prior=file_get_contents($sourceCierre.'/'.$old['archivo']);
    if(!hash_equals($old['sha256'],hash('sha256',$prior)))fail('Hash anterior inválido');
    // Sembrar versión auténtica 1.0 solo en la primera importación; nunca retroceder un archivo existente.
    if(!$target->nodeExists($name))put($target,$name,$prior);
    put($base->get(FOLDERS[5])->get('Versiones-PDF'),$old['sha256'].'--'.$name,$prior);
   }
   put($target,$name,file_get_contents($path));
   if(str_ends_with($name,'.pdf'))put($base->get(FOLDERS[5])->get('Versiones-PDF'),$item['sha256'].'--'.$name,file_get_contents($path));
  }
  if(!$target->nodeExists($name)||!hash_equals($item['sha256'],hash('sha256',$target->get($name)->getContent())))fail('Cierre no coincide: '.$name);
 }
 echo 'Paquete de cierre verificado: ',count($extra)," archivos.\n";
}
