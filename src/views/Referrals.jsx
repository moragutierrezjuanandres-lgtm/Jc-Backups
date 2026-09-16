import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

export default function Referrals() {
  const { db, currentUser, addReferral, approveReferralBonus, updateReferralBonus } = useContext(AppContext);
  const [showAddModal, setShowAddModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [details, setDetails] = useState('');

  if (!db || !currentUser) return null;

  const isMaster = currentUser.role === 'Administrador' || currentUser.id === 'emp-master';
  const referralsList = db.referrals || [];

  // Filter referrals based on user role
  const displayedReferrals = isMaster 
    ? referralsList 
    : referralsList.filter(ref => ref.employeeId === currentUser.id);

  // Compute metrics
  const pendingCount = displayedReferrals.filter(r => r.status === 'Pendiente').length;
  const approvedCount = displayedReferrals.filter(r => r.status === 'Aprobado').length;
  
  // Accumulated approved bonuses
  const totalApprovedBonus = displayedReferrals
    .filter(r => r.status === 'Aprobado')
    .reduce((sum, r) => sum + (r.bonusAmount || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientName || !bonusAmount) return;

    addReferral({
      clientName,
      bonusAmount: parseFloat(bonusAmount) || 0,
      details
    });

    setClientName('');
    setBonusAmount('');
    setDetails('');
    setShowAddModal(false);
  };

  const handleApprove = (id) => {
    approveReferralBonus(id, 'Aprobado');
  };

  const handleReject = (id) => {
    if (window.confirm('¿Está seguro de que desea rechazar esta bonificación?')) {
      approveReferralBonus(id, 'Rechazado');
    }
  };

  return (
    <div className="page-container">
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Referidos y Bonificaciones</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Registre clientes referidos y gestione las bonificaciones de fin de mes.
          </p>
        </div>

        <div>
          {!isMaster && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Registrar Referido
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card success">
          <span className="metric-title">Bono Acumulado Aprobado</span>
          <div className="metric-value">${totalApprovedBonus}</div>
          <span className="metric-trend" style={{ color: 'var(--success)' }}>
            ✓ Bonos validados
          </span>
        </div>
        <div className="metric-card info">
          <span className="metric-title">Referidos Aprobados</span>
          <div className="metric-value">{approvedCount}</div>
          <span className="metric-trend" style={{ color: 'var(--info)' }}>
            Clientes incorporados
          </span>
        </div>
        <div className="metric-card warning">
          <span className="metric-title">Pendientes de Aprobación</span>
          <div className="metric-value">{pendingCount}</div>
          <span className="metric-trend" style={{ color: 'var(--warning)' }}>
             Esperando revisión
          </span>
        </div>
      </div>

      {/* Referrals list / table */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '20px' }}>
          {isMaster ? 'Control de Referidos de Personal' : 'Mis Referidos Registrados'}
        </h3>

        {displayedReferrals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No se han registrado clientes referidos en este período.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {isMaster && <th>Empleado</th>}
                  <th>Cliente Referido</th>
                  <th>Detalle / Contrato</th>
                  <th>Bono Propuesto</th>
                  <th>Estado</th>
                  {isMaster && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {displayedReferrals.map(ref => (
                  <tr key={ref.id}>
                    <td style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{ref.date}</td>
                    {isMaster && <td style={{ fontWeight: 500 }}>{ref.employeeName}</td>}
                    <td style={{ fontWeight: 600 }}>{ref.clientName}</td>
                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'normal', color: 'var(--text-muted)' }}>
                      {ref.details || 'Sin observaciones.'}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--primary)' }}>
                      {isMaster && ref.status === 'Pendiente' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.875rem' }}>$</span>
                          <input
                            type="number"
                            key={ref.id + '-' + ref.bonusAmount}
                            defaultValue={ref.bonusAmount}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (val !== ref.bonusAmount) {
                                updateReferralBonus(ref.id, val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== ref.bonusAmount) {
                                  updateReferralBonus(ref.id, val);
                                }
                                e.target.blur();
                              }
                            }}
                            className="form-input"
                            style={{
                              width: '80px',
                              padding: '2px 6px',
                              fontSize: '0.8125rem',
                              margin: 0,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              color: 'var(--primary)',
                              fontWeight: 500
                            }}
                          />
                        </div>
                      ) : (
                        `$${ref.bonusAmount}`
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        ref.status === 'Aprobado' ? 'badge-success' :
                        ref.status === 'Rechazado' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {ref.status}
                      </span>
                    </td>
                    {isMaster && (
                      <td>
                        {ref.status === 'Pendiente' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleApprove(ref.id)}
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'var(--success)' }}
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleReject(ref.id)}
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {ref.approvedDate ? `Procesado el ${ref.approvedDate}` : 'Finalizado'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD REFERRAL */}
      {showAddModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', margin: '20px', zIndex: 1001, animation: 'fadeInPage 0.2s ease forwards' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontWeight: 600 }}>+ Registrar Cliente Referido</h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowAddModal(false)}
                style={{ padding: '4px 8px', minWidth: 'auto', border: 'none', background: 'none', fontSize: '1.2rem' }}
              >✕</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Cliente / Empresa</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ej. Inversiones Chacao C.A." 
                  required 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Monto de Bono Solicitado ($)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="ej. 150" 
                  required 
                  min="1"
                  value={bonusAmount} 
                  onChange={e => setBonusAmount(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detalle del Negocio / Comentarios</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  placeholder="Describa el servicio contratado, condiciones, etc."
                  value={details} 
                  onChange={e => setDetails(e.target.value)} 
                  style={{ resize: 'vertical', minHeight: '70px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Referido</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
