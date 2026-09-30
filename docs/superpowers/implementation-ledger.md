# Isabella: decisiones de implementación

## 2026-09-30

Se conserva Go y `golang.org/x/sys/windows/svc` para entregar un servicio nativo de Windows con los componentes existentes. La propuesta de .NET queda sustituida en esta entrega: no se requiere SDK ni runtime adicional en el equipo del cliente. El ejecutable contiene Restic y el bundle Three.js, solicita elevación y registra el servicio con inicio automático y recuperación ante fallos.

La interfaz se sirve en loopback desde el proceso del servicio. El trabajador solo se inicia después de reservar el puerto de la interfaz, evitando dos motores activos. Las operaciones de configuración requieren sesión del portal, cookie local HttpOnly, CSRF y comprobación del origen. Se conserva el diario persistente de Go y DPAPI de máquina; no se migra a SQLite ni se introducen pipes en esta entrega.

Se aplica la última preferencia visual del usuario: nube irregular de polvo gris con acentos azules, estados reales y soporte de movimiento reducido. El portal y la interfaz local comparten el componente Three.js.

El receptor HTTPS mantiene repositorios aislados por equipo. El servidor verifica los datos y la etiqueta de ejecución antes de marcar una copia como exitosa. La retención cuenta únicamente snapshots verificados; la restauración escribe en una carpeta nueva del servidor.

Se comprobó instalación y arranque del servicio. No se ha reiniciado el servidor de producción para simular un arranque sin usuario, ni se ha completado la vinculación con un cliente real desde una sesión del navegador accesible al agente. Estos puntos siguen pendientes de aceptación.
