import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import LogoSvg from '../components/LogoSvg';
import { playNetflixSound } from '../utils/audio';

export default function Login() {
  const { login } = useContext(AppContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiServerIp, setApiServerIp] = useState(localStorage.getItem('jc_api_server_ip') || '26.186.172.165');
  const isFileProtocol = window.location.protocol === 'file:';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor complete todos los campos.');
      return;
    }
    setIsLoading(true);
    setError('');

    // Small delay for UX feedback
    await new Promise(r => setTimeout(r, 400));

    const result = login(username, password);
    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
    } else {
      playNetflixSound();
    }
    // If success, AppContext sets isAuthenticated → PortalRouter re-renders
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--card-hover)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background glow orbs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'var(--card-hover)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-5%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'var(--card-hover)',
        pointerEvents: 'none'
      }} />

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          border: '1px solid var(--border)',
          boxShadow: 'none',
          backdropFilter: 'blur(12px)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <LogoSvg style={{ width: '72px', height: '72px', color: 'var(--primary)', filter: 'drop-shadow(0 0 15px hsla(222,85%,55%,0.35))' }} />

          <div>
            <h1 style={{
              fontSize: '1.625rem', fontWeight: 500, letterSpacing: '-0.03em',
              background: 'var(--card-hover)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              JC Portal
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ingrese sus credenciales para acceder al sistema
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              backgroundColor: 'hsla(0, 84%, 60%, 0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '0.8rem',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '1rem' }}>⚠️</span>
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              id="login-username"
              type="text"
              placeholder="Ingrese su usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              autoComplete="username"
              disabled={isLoading}
              title="Introduzca su nombre de usuario de empleado para iniciar sesión"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingRight: '44px' }}
                autoComplete="current-password"
                disabled={isLoading}
                title="Introduzca su contraseña de seguridad asociada a su cuenta"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '1rem', padding: '0', lineHeight: 1
                }}
                title={showPassword ? "Ocultar la contraseña escrita" : "Mostrar la contraseña en texto plano"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="btn-login"
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: '4px',
              height: '44px',
              fontSize: '0.9375rem',
              fontWeight: 600,
              letterSpacing: '0.02em'
            }}
            disabled={isLoading}
            title="Presione para validar credenciales y entrar al panel principal"
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Verificando...
              </span>
            ) : 'Acceder al Portal →'}
          </button>
        </form>

        {/* API Server IP configuration (Only shown on file:// protocol) */}
        {isFileProtocol && (
          <div
            style={{
              backgroundColor: 'hsla(250, 84%, 60%, 0.05)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
               Configuración de Red (VPN/Intranet)
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                style={{ padding: '6px 10px', fontSize: '0.8125rem', flex: 1 }}
                placeholder="Dirección IP del Servidor"
                value={apiServerIp}
                onChange={(e) => {
                  const val = e.target.value;
                  setApiServerIp(val);
                  localStorage.setItem('jc_api_server_ip', val);
                }}
                title="Establece la dirección IP donde reside el servidor de la base de datos Express (VPN o Red Local)"
              />
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Ingrese la dirección IP del servidor donde corre la base de datos (VPN Radmin o red local).
            </span>
          </div>
        )}



        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'hsl(240,5%,35%)' }}>
          JC Soluciones Tecnológicas  2026
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
