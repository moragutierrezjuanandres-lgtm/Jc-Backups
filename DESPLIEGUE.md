# Guía de Despliegue del Portal JC Enterprise en un Servidor

Esta guía detalla los pasos para desplegar y alojar el portal de JC Enterprise en un servidor local (Intranet) o en un servidor en la nube (VPS/Remoto) utilizando Node.js, Express, la compilación de React (Vite) y PM2 para mantener la ejecución continua en segundo plano.

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente en el servidor:
1. **Node.js** (versión 18 o superior recomendado) y **npm**.
2. **Git** (opcional, para clonar el repositorio).
3. Puertos libres: Puerto `5000` (Backend API) y puerto `3000` o `80` (Frontend).

---

## 🚀 Paso 1: Configurar los Archivos de la Aplicación

1. Copia la carpeta del proyecto `jc-enterprise-portal` en el servidor de destino.
2. Si usas la versión Vite de React, instala las dependencias del proyecto ejecutando:
   ```bash
   npm install
   ```

---

## 🛠️ Paso 2: Compilar el Frontend (React + Vite)

Para generar el paquete de distribución estático optimizado para producción, ejecuta:
```bash
npm run build
```
Esto creará una carpeta llamada `dist/` en la raíz del proyecto, la cual contiene los archivos HTML, CSS y JS optimizados.

---

## ⚙️ Paso 3: Configurar el Servidor Backend (Express)

El proyecto incluye un archivo `server.js` que actúa como servidor API para guardar de forma segura la base de datos `database.json`. Asegúrate de que `server.js` apunte correctamente a la carpeta de compilación `dist/`.

Ejemplo simplificado de `server.js`:
```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir archivos estáticos de la compilación de React
app.use(express.static(path.join(__dirname, 'dist')));

// Rutas de la API
app.get('/api/db', (req, res) => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
  }
  const dbData = fs.readFileSync(DB_PATH, 'utf8');
  res.json(JSON.parse(dbData));
});

app.post('/api/db', (req, res) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Redirección por defecto a React (Single Page Application Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});
```

---

## 🔄 Paso 4: Ejecución en Segundo Plano con PM2

Para evitar que el servidor se apague al cerrar la terminal, utilizaremos **PM2** (Process Manager 2).

1. Instala PM2 globalmente en el servidor:
   ```bash
   npm install -g pm2
   ```

2. Inicia la aplicación usando PM2:
   ```bash
   pm2 start server.js --name "jc-portal"
   ```

3. Guarda la lista de procesos de PM2 y configúralo para que se inicie automáticamente con el sistema:
   ```bash
   pm2 save
   pm2 startup
   ```
   *(Sigue las instrucciones que PM2 imprima en consola para configurar el servicio de inicio en el sistema operativo del servidor).*

---

## 🌐 Paso 5: Configuración de Red y Firewall

Para que otros equipos de la red local o internet puedan acceder:

### En Windows Server:
1. Abre **Firewall de Windows con seguridad avanzada**.
2. Crea una **Regla de Entrada**:
   - Tipo de regla: **Puerto**.
   - Protocolo: **TCP**.
   - Puertos locales específicos: **5000** (o el puerto configurado).
   - Acción: **Permitir la conexión**.
   - Asigna un nombre descriptivo como `JC Enterprise Portal API`.

### En Linux (Ubuntu Server):
Abre el puerto en UFW:
```bash
sudo ufw allow 5000/tcp
sudo ufw reload
```

---

## 🔒 Paso 6: Acceso a la Aplicación

Una vez configurado, cualquier cliente de la red podrá acceder al portal a través del navegador ingresando la dirección IP del servidor y el puerto configurado:
- **Localmente**: `http://localhost:5000`
- **Red Local (Intranet)**: `http://<IP_DEL_SERVIDOR>:5000`
- **Servidor en la Nube (Internet)**: `http://<IP_PUBLICA_O_DOMINIO>:5000`

---

## 💡 Opción Alternativa: Despliegue Standalone (Fácil)

Si no deseas configurar Node.js en el servidor de destino y prefieres una instalación offline ultra simplificada:
1. Comparte el archivo `preview-portal.html` a través de una carpeta compartida en la red local (Samba / Active Directory).
2. Los usuarios pueden abrir el archivo directamente haciendo doble clic (soporta protocolo `file://`).
3. *Nota*: En este modo, la base de datos se guarda de forma local en el navegador de cada usuario (`localStorage`). Para una base de datos centralizada, utiliza el despliegue del servidor Express detallado arriba.
