export function diagnoseBackup({device,run,event,policy,message,now=Date.now()}){
 const text=message.toLowerCase();
 const connected=device.last_seen_at&&now-Date.parse(device.last_seen_at)<120000;
 const prefix=`Estoy revisando ${device.label}. `;
 if(/deten|cancel|parar/.test(text))return prefix+'Para detenerlo, utiliza el botón Detener respaldo. Espero la confirmación del agente antes de indicar que se detuvo. Este chat no ejecuta órdenes.';
 if(/carpeta|directorio|ruta|guardar/.test(text))return prefix+`Origen: ${(policy?.source_dirs||[]).join(', ')||'sin configurar'}. Destino del servidor: ${device.server_directory||'almacenamiento predeterminado'}. Puedes modificarlo desde la configuración del equipo.`;
 if(!connected)return prefix+'No recibo comunicación reciente del agente. Comprueba que el equipo esté encendido, tenga Internet y que el servicio JCEnterpriseIsabella esté ejecutándose. No puedo determinar desde el portal cuál de esas condiciones está fallando.';
 if(run?.cancel_requested&&run.status==='running')return prefix+'Se solicitó detener el respaldo. Todavía espero que el agente confirme la detención. Necesita la versión del motor con control de cancelación.';
 if(run?.status==='running')return prefix+`Está respaldando${typeof run.progress?.percent==='number'?` al ${Math.round(run.progress.percent)}%`:', esperando progreso'}. Puedes consultar el porcentaje y detener esta ejecución en el portal.`;
 if(run?.status==='verifying')return prefix+'Los archivos llegaron y el servidor está comprobando su integridad. Todavía no están marcados como copia verificada.';
 if(run?.status==='cancelled')return prefix+'La ejecución fue detenida y no se reintentará. Puedes iniciar una nueva desde la configuración del equipo.';
 const failure=event?.payload;
 if(['failed','retry_wait'].includes(run?.status)){
  const reasons={12:'Restic no pudo abrir las claves del repositorio. Puede ser una clave incorrecta o un problema del receptor al listar las claves.',11:'Restic no pudo bloquear el repositorio: puede haber otra tarea activa o un bloqueo pendiente.',10:'Restic no encontró el repositorio.',3:'No se pudieron leer todos los archivos; la copia quedó incompleta.'};
  const codes={invalid_source:'La carpeta de origen no existe o el servicio no tiene acceso.',profile_unavailable:'El perfil de respaldo no está disponible.',timeout_or_cancelled:'La tarea se interrumpió o agotó su tiempo.'};
  return prefix+(reasons[failure?.exitCode]||codes[failure?.errorCode]||'La ejecución falló.')+(failure?.message?` Detalle registrado por el equipo: ${failure.message}`:' No recibí un detalle suficiente para confirmar la causa.')+` Estado: ${run.status}.`;
 }
 if(run?.status==='succeeded')return prefix+'La última ejecución terminó y fue verificada. Revisa el horario para saber cuándo corresponde la próxima copia.';
 if(run?.status==='queued')return prefix+'Hay una tarea en cola esperando que el agente la tome.';
 return prefix+'Puedo ayudarte a revisar por qué no funciona, el estado del respaldo, su conexión y las carpetas configuradas. Aún no hay una ejecución reciente que analizar.';
}
