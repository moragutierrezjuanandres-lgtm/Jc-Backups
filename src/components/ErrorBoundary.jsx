import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Portal ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          margin: '20px',
          backgroundColor: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--danger)' }}>
            Error de Ejecución del Sistema
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '500px', margin: 0 }}>
            Se ha producido una excepción al procesar los datos de esta sección.
          </p>

          {this.state.error && (
            <div style={{
              backgroundColor: 'var(--background)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: '0.75rem',
              color: 'var(--danger)',
              fontFamily: 'monospace',
              maxWidth: '600px',
              wordBreak: 'break-word',
              textAlign: 'left'
            }}>
              <strong>Detalle Técnico:</strong> {this.state.error.toString()}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontWeight: 500 }}
            >
              Reintentar Vista
            </button>
            <button
              onClick={() => {
                this.handleReset();
                window.location.href = '?tab=dashboard';
              }}
              className="btn btn-secondary"
              style={{ padding: '8px 20px' }}
            >
              Ir al Panel Principal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
