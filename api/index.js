import { PostgresStore } from '../lib/postgres.js';
import { createCloudApp } from '../lib/cloud-app.js';
let app;
export default function handler(req,res) {
  try {
    if(!app)app=createCloudApp({store:new PostgresStore(process.env.DATABASE_URL),vaultKey:Buffer.from(process.env.JC_VAULT_KEY||'','base64')});
    return app(req,res);
  } catch {
    res.setHeader('Cache-Control','no-store');
    res.status(503).json({error:'La API necesita completar su configuración de base de datos.'});
  }
}
