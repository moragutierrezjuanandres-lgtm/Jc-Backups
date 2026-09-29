# Vinculación de Isabella

1. Un administrador u operador con permiso explícito de respaldos selecciona un cliente existente en el portal y genera un código de diez minutos.
2. En Isabella, el usuario inicia sesión con su usuario y contraseña del portal. La aplicación utiliza `/api/auth/login`; no guarda la contraseña en su configuración ni en el diario.
3. Isabella mantiene la sesión HTTPS en memoria y envía el código y nombre de equipo. El servidor exige sesión vigente y permiso sobre el cliente del código antes de consumirlo una sola vez.
4. El token de equipo y credenciales del repositorio se guardan con DPAPI. Las consultas de estado y cambios de política desde Isabella exigen también una sesión de usuario con acceso al cliente.
5. La pantalla de estado muestra ejecuciones, alertas y copias verificadas del equipo. La configuración de carpetas y horario se guarda en el portal con revisiones.

## Verificación

`tests/backup-link.test.mjs` recorre las rutas HTTP reales con PostgreSQL de prueba y usuarios ficticios: contraseña incorrecta, sesión ausente, cliente ajeno, código reutilizado, permisos de estado, persistencia de política y ausencia de secretos en respuestas de consulta. El receptor se sustituye por un fixture: esta prueba no demuestra recepción de archivos en producción.

`agent/internal/ui/login_test.go` verifica por HTTPS que Isabella envía las credenciales al inicio de sesión y solo crea sesión local cuando el portal las valida.

## Estado del despliegue

Los cambios se entregan en la rama `codex/windows-migration`. Subir esa rama no modifica el backend instalado ni equivale a desplegar en `www.jcevnzl.space`.

Para producción faltan la configuración y prueba del receptor HTTPS, inicialización de esquema de respaldos en el backend instalado y una restauración real. Los resultados declarados exitosos por el agente se registran como `verifying`; no se consideran copias verificadas sin comprobación independiente.

La reconciliación de eventos generados sin conexión todavía necesita completarse: las ejecuciones locales programadas deben reconciliarse con su ejecución del servidor antes de aceptar eventos. No activar equipos reales hasta verificar ese ciclo y restauración. No se ha confirmado arranque automático sin sesión de Windows.
