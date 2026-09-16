import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import LogoSvg from '../components/LogoSvg';
export default function Login() {
  const { login } = useContext(AppContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const result = await login(username, password); if (!result.success) setError(result.error); }
    catch { setError('No se pudo conectar al servidor.'); }
    finally { setBusy(false); }
  }
  return <main className="enterprise-login">
    <section className="login-brand"><div className="wordmark"><LogoSvg style={{ width: 36, height: 36 }} /> JC ENTERPRISE</div><div><span className="eyebrow">OPERACIONES Y SERVICIOS</span><h1>Una visión clara.<br />Un equipo conectado.</h1><p>Clientes, soporte e infraestructura en un solo espacio de trabajo.</p></div><span className="login-footer">Gestión empresarial · JC Services</span></section>
    <section className="login-form-panel"><form onSubmit={submit}><span className="eyebrow">PORTAL EMPRESARIAL</span><h2>Bienvenido</h2><p className="muted">Inicia sesión para acceder a tu espacio de trabajo.</p>{error && <div className="notice error" role="alert">{error}</div>}<label>Usuario o correo electrónico<input className="form-input" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} autoFocus /></label><label>Contraseña<input className="form-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button className="btn btn-primary" disabled={busy}>{busy ? 'Conectando…' : 'Iniciar sesión'} <span aria-hidden="true">→</span></button><small className="muted">¿Necesitas acceso? Contacta con el administrador.</small></form></section>
  </main>;
}
