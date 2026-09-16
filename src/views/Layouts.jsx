import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { encryptData, decryptData } from '../utils/crypto';
import Modal from '../components/Modal';

export default function Layouts({ embeddedClientId, isEmbedded }) {
  const { db, currentUser, updateClientLayout, updateClient, logActivity } = useContext(AppContext);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [activeTab, setActiveTab] = useState('2d'); // '2d' or '3d'
  
  // Focused / selected item states
  const [focusedDevice, setFocusedDevice] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); // {x, y}
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states
  const [devName, setDevName] = useState('');
  const [devType, setDevType] = useState('Servidor');
  const [devDesc, setDevDesc] = useState('');
  const [devInventory, setDevInventory] = useState('');
  const [devCablingPath, setDevCablingPath] = useState('');
  const [devCablingStatus, setDevCablingStatus] = useState('Directo');
  const [workstationUser, setWorkstationUser] = useState('');
  const [workstationPass, setWorkstationPass] = useState('');
  
  // Cabling connections states
  const [connectedSwitch, setConnectedSwitch] = useState('');
  const [connectedServer, setConnectedServer] = useState('');
  const [editConnectedSwitch, setEditConnectedSwitch] = useState('');
  const [editConnectedServer, setEditConnectedServer] = useState('');

  // Quick create states
  const [quickCreateSwitch, setQuickCreateSwitch] = useState(false);
  const [quickSwitchName, setQuickSwitchName] = useState('');
  const [quickCreateServer, setQuickCreateServer] = useState(false);
  const [quickServerName, setQuickServerName] = useState('');
  
  const [editQuickCreateSwitch, setEditQuickCreateSwitch] = useState(false);
  const [editQuickSwitchName, setEditQuickSwitchName] = useState('');
  const [editQuickCreateServer, setEditQuickCreateServer] = useState(false);
  const [editQuickServerName, setEditQuickServerName] = useState('');

  // Peripherals and VPOS states
  const [vposVersion, setVposVersion] = useState('');
  const [editVposVersion, setEditVposVersion] = useState('');
  const [peripherals, setPeripherals] = useState([]);
  const [editPeripherals, setEditPeripherals] = useState([]);

  // Temp peripheral form states
  const [newPeriType, setNewPeriType] = useState('Impresora Térmica');
  const [newPeriName, setNewPeriName] = useState('');
  const [newPeriVposVersion, setNewPeriVposVersion] = useState('');
  
  // Credentials revealing states
  const [revealedPass, setRevealedPass] = useState({}); // { devId: passwordText }
  const [loadingReveal, setLoadingReveal] = useState({}); // { devId: boolean }

  if (!db || !currentUser) return null;

  const activeClientId = isEmbedded ? embeddedClientId : selectedClientId;
  const activeClient = db.clients.find(c => c.id === activeClientId) || db.clients[0];

  // Helper to find empty grid cell
  const findFreeCell = (layout) => {
    for (let y = 1; y <= 8; y++) {
      for (let x = 1; x <= 8; x++) {
        if (!layout.some(d => d.x === x && d.y === y)) {
          return { x, y };
        }
      }
    }
    return null;
  };

  // General cabling notes for client
  const [cablingNotes, setCablingNotes] = useState('');

  // Edit Device States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDevId, setEditDevId] = useState('');
  const [editDevName, setEditDevName] = useState('');
  const [editDevType, setEditDevType] = useState('');
  const [editDevDesc, setEditDevDesc] = useState('');
  const [editDevInventory, setEditDevInventory] = useState('');
  const [editDevCablingPath, setEditDevCablingPath] = useState('');
  const [editDevCablingStatus, setEditDevCablingStatus] = useState('Directo');
  const [editWorkstationUser, setEditWorkstationUser] = useState('');
  const [editWorkstationPass, setEditWorkstationPass] = useState('');

  // Sync general cabling notes
  useEffect(() => {
    if (activeClient) {
      setCablingNotes(activeClient.cablingNotes || '');
    }
  }, [activeClient]);

  // Set default client if none selected
  if (!isEmbedded && db.clients.length > 0 && !selectedClientId) {
    setSelectedClientId(db.clients[0].id);
  }

  const layoutDevices = activeClient ? (activeClient.layout || []) : [];
  const coreDevice = layoutDevices.find(d => d.type === 'Rack') || 
                     layoutDevices.find(d => d.type === 'Switch') || 
                     layoutDevices.find(d => d.type === 'Servidor');

  const handleCellClick = (x, y) => {
    const existing = layoutDevices.find(d => d.x === x && d.y === y);
    if (existing) {
      setFocusedDevice(existing);
      setSelectedCell(null);
    } else {
      setSelectedCell({ x, y });
      setDevName('');
      setDevDesc('');
      setDevType('Servidor');
      setDevInventory('');
      setDevCablingPath('');
      setDevCablingStatus('Directo');
      setWorkstationUser('');
      setWorkstationPass('');
      setConnectedSwitch('');
      setConnectedServer('');
      setQuickCreateSwitch(false);
      setQuickSwitchName('');
      setQuickCreateServer(false);
      setQuickServerName('');
      setVposVersion('');
      setPeripherals([]);
      setShowAddModal(true);
      setFocusedDevice(null);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCell || !devName || !activeClient) return;

    let cipherPass = '';
    if (devType === 'Puesto de Trabajo' && workstationPass) {
      cipherPass = await encryptData(workstationPass);
    }

    let tempLayout = [...layoutDevices];
    let finalSwitchId = connectedSwitch;
    let finalServerId = connectedServer;

    if (quickCreateSwitch && quickSwitchName) {
      const cell = findFreeCell(tempLayout);
      if (cell) {
        const newSwitch = {
          id: `dev-${Date.now()}-sw`,
          x: cell.x,
          y: cell.y,
          type: 'Switch',
          name: quickSwitchName,
          description: 'Switch creado automáticamente via mapeo rápido',
          cablingPath: '',
          cablingStatus: 'Directo',
          peripherals: []
        };
        tempLayout.push(newSwitch);
        finalSwitchId = newSwitch.id;
      }
    }

    if (quickCreateServer && quickServerName) {
      const cell = findFreeCell(tempLayout);
      if (cell) {
        const newServer = {
          id: `dev-${Date.now()}-srv`,
          x: cell.x,
          y: cell.y,
          type: 'Servidor',
          name: quickServerName,
          description: 'Servidor creado automáticamente via mapeo rápido',
          cablingPath: '',
          cablingStatus: 'Directo',
          peripherals: []
        };
        tempLayout.push(newServer);
        finalServerId = newServer.id;
      }
    }

    const newDevice = {
      id: `dev-${Date.now()}`,
      x: selectedCell.x,
      y: selectedCell.y,
      type: devType,
      name: devName,
      description: devDesc,
      inventory: devInventory,
      cablingPath: devCablingPath,
      cablingStatus: devCablingStatus,
      username: devType === 'Puesto de Trabajo' ? workstationUser : undefined,
      password: devType === 'Puesto de Trabajo' ? cipherPass : undefined,
      connectedSwitch: finalSwitchId || undefined,
      connectedServer: finalServerId || undefined,
      vposVersion: ['Puesto de Trabajo', 'Periférico'].includes(devType) ? vposVersion : undefined,
      peripherals: peripherals
    };

    const updatedLayout = [...tempLayout, newDevice];
    const logDetails = `Agregó equipo "${devName}" (${devType}) en cuadrícula (${selectedCell.x}, ${selectedCell.y}) al plano del cliente "${activeClient.commercialName}"`;
    updateClientLayout(activeClient.id, updatedLayout, logDetails);

    setShowAddModal(false);
    setSelectedCell(null);
  };

  const handleEditClick = (dev) => {
    setEditDevId(dev.id);
    setEditDevName(dev.name);
    setEditDevType(dev.type);
    setEditDevDesc(dev.description || '');
    setEditDevInventory(dev.inventory || '');
    setEditDevCablingPath(dev.cablingPath || '');
    setEditDevCablingStatus(dev.cablingStatus || 'Directo');
    setEditWorkstationUser(dev.username || '');
    setEditWorkstationPass('');
    setEditConnectedSwitch(dev.connectedSwitch || '');
    setEditConnectedServer(dev.connectedServer || '');
    setEditQuickCreateSwitch(false);
    setEditQuickSwitchName('');
    setEditQuickCreateServer(false);
    setEditQuickServerName('');
    setEditVposVersion(dev.vposVersion || '');
    setEditPeripherals(dev.peripherals || []);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editDevId || !editDevName || !activeClient) return;

    const oldDev = layoutDevices.find(d => d.id === editDevId);
    if (!oldDev) return;

    let cipherPass = oldDev.password;
    if (editDevType === 'Puesto de Trabajo' && editWorkstationPass) {
      cipherPass = await encryptData(editWorkstationPass);
    } else if (editDevType !== 'Puesto de Trabajo') {
      cipherPass = undefined;
    }

    let tempLayout = [...layoutDevices];
    let finalSwitchId = editConnectedSwitch;
    let finalServerId = editConnectedServer;

    if (editQuickCreateSwitch && editQuickSwitchName) {
      const cell = findFreeCell(tempLayout.filter(d => d.id !== editDevId));
      if (cell) {
        const newSwitch = {
          id: `dev-${Date.now()}-sw`,
          x: cell.x,
          y: cell.y,
          type: 'Switch',
          name: editQuickSwitchName,
          description: 'Switch creado automáticamente via mapeo rápido',
          cablingPath: '',
          cablingStatus: 'Directo',
          peripherals: []
        };
        tempLayout.push(newSwitch);
        finalSwitchId = newSwitch.id;
      }
    }

    if (editQuickCreateServer && editQuickServerName) {
      const cell = findFreeCell(tempLayout.filter(d => d.id !== editDevId));
      if (cell) {
        const newServer = {
          id: `dev-${Date.now()}-srv`,
          x: cell.x,
          y: cell.y,
          type: 'Servidor',
          name: editQuickServerName,
          description: 'Servidor creado automáticamente via mapeo rápido',
          cablingPath: '',
          cablingStatus: 'Directo',
          peripherals: []
        };
        tempLayout.push(newServer);
        finalServerId = newServer.id;
      }
    }

    const updatedDevice = {
      ...oldDev,
      type: editDevType,
      name: editDevName,
      description: editDevDesc,
      inventory: editDevInventory,
      cablingPath: editDevCablingPath,
      cablingStatus: editDevCablingStatus,
      username: editDevType === 'Puesto de Trabajo' ? editWorkstationUser : undefined,
      password: cipherPass,
      connectedSwitch: finalSwitchId || undefined,
      connectedServer: finalServerId || undefined,
      vposVersion: ['Puesto de Trabajo', 'Periférico'].includes(editDevType) ? editVposVersion : undefined,
      peripherals: editPeripherals
    };

    const updatedLayout = tempLayout.map(d => d.id === editDevId ? updatedDevice : d);
    const logDetails = `Modificó equipo "${editDevName}" (${editDevType}) en el plano del cliente "${activeClient.commercialName}"`;
    updateClientLayout(activeClient.id, updatedLayout, logDetails);

    setFocusedDevice(updatedDevice);
    setShowEditModal(false);
  };

  const handleDeleteDevice = (id, name) => {
    if (!activeClient) return;
    if (window.confirm(`¿Está seguro de que desea eliminar el equipo "${name}" del plano?`)) {
      const updatedLayout = layoutDevices.filter(d => d.id !== id);
      const logDetails = `Eliminó equipo "${name}" del plano del cliente "${activeClient.commercialName}"`;
      updateClientLayout(activeClient.id, updatedLayout, logDetails);
      setFocusedDevice(null);
    }
  };

  const handleRevealPassword = async (dev) => {
    if (revealedPass[dev.id]) {
      // Toggle visibility off
      const updated = { ...revealedPass };
      delete updated[dev.id];
      setRevealedPass(updated);
      return;
    }

    setLoadingReveal(prev => ({ ...prev, [dev.id]: true }));
    const plainText = await decryptData(dev.password);
    setRevealedPass(prev => ({ ...prev, [dev.id]: plainText }));
    setLoadingReveal(prev => ({ ...prev, [dev.id]: false }));

    logActivity('Bóveda de Planos', `Consultó clave del puesto de trabajo "${dev.name}" (usuario: ${dev.username}) para el cliente "${activeClient.commercialName}"`);
  };

  // Device type helper mapping
  const deviceMeta = {
    'Rack': { icon: '🏢', color: 'hsl(222, 85%, 55%)', colorLight: 'hsla(222, 85%, 55%, 0.15)' },
    'Servidor': { icon: '🖥️', color: 'hsl(200, 89%, 48%)', colorLight: 'hsla(200, 89%, 48%, 0.15)' },
    'Router': { icon: '🌐', color: 'hsl(199, 89%, 48%)', colorLight: 'hsla(199, 89%, 48%, 0.15)' },
    'Switch': { icon: '🔌', color: 'hsl(38, 92%, 50%)', colorLight: 'hsla(38, 92%, 50%, 0.15)' },
    'Firewall': { icon: '🧱', color: 'hsl(0, 84%, 60%)', colorLight: 'hsla(0, 84%, 60%, 0.15)' },
    'UPS': { icon: '🔋', color: 'hsl(38, 92%, 50%)', colorLight: 'hsla(38, 92%, 50%, 0.15)' },
    'Antena / AP': { icon: '📡', color: 'hsl(210, 95%, 45%)', colorLight: 'hsla(210, 95%, 45%, 0.15)' },
    'Impresora': { icon: '🖨️', color: 'hsl(240, 5%, 65%)', colorLight: 'hsla(240, 5%, 65%, 0.15)' },
    'Puesto de Trabajo': { icon: '💼', color: 'hsl(74, 45%, 55%)', colorLight: 'hsla(74, 45%, 55%, 0.15)' },
    'Periférico': { icon: '⌨️', color: 'hsl(142, 70%, 45%)', colorLight: 'hsla(142, 70%, 45%, 0.15)' },
    'Mesa': { icon: '🟫', color: 'hsl(25, 50%, 40%)', colorLight: 'hsla(25, 50%, 40%, 0.15)' },
    'Silla': { icon: '🪑', color: 'hsl(30, 45%, 45%)', colorLight: 'hsla(30, 45%, 45%, 0.15)' },
    'Mobiliario': { icon: '🗄️', color: 'hsl(200, 15%, 40%)', colorLight: 'hsla(200, 15%, 40%, 0.15)' },
    'Planta Decorativa': { icon: '🌱', color: 'hsl(74, 40%, 45%)', colorLight: 'hsla(74, 40%, 45%, 0.15)' }
  };

  const getDeviceMeta = (type) => deviceMeta[type] || { icon: '⚙️', color: 'var(--primary)', colorLight: 'var(--primary-glow)' };

  // Generate 8x8 grid coordinates
  const gridCoords = [];
  for (let y = 1; y <= 8; y++) {
    for (let x = 1; x <= 8; x++) {
      gridCoords.push({ x, y });
    }
  }

  const handleExportMap = () => {
    if (!activeClient) return;
    const canvas = document.createElement('canvas');
    const size = 800;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = activeClient.floorColor || '#000000';
    ctx.fillRect(0, 0, size, size);
    
    // Draw Title
    ctx.fillStyle = '#E9E9E2'; // primary text
    ctx.font = 'bold 24px "Josefin Sans", sans-serif';
    ctx.fillText(`Infraestructura: ${activeClient.commercialName}`, 40, 55);
    
    ctx.font = '16px "Josefin Sans", sans-serif';
    ctx.fillStyle = '#C8CCC8'; // muted text
    ctx.fillText(`Plano de Red e Instalaciones (2D)`, 40, 85);
    
    const gridStart = 140;
    const gridWidth = 520;
    const cellWidth = gridWidth / 8;
    
    // Draw grid axis labels
    ctx.fillStyle = '#C8CCC8';
    ctx.font = 'bold 14px "Josefin Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cols = ['A','B','C','D','E','F','G','H'];
    for (let i = 0; i < 8; i++) {
      // Columns (A-H)
      ctx.fillText(cols[i], gridStart + i * cellWidth + cellWidth / 2, gridStart - 20);
      // Rows (1-8)
      ctx.fillText((i + 1).toString(), gridStart - 25, gridStart + i * cellWidth + cellWidth / 2);
    }
    
    // Draw grid lines
    ctx.strokeStyle = '#342C36'; // border color
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      // Verticals
      ctx.beginPath();
      ctx.moveTo(gridStart + i * cellWidth, gridStart);
      ctx.lineTo(gridStart + i * cellWidth, gridStart + gridWidth);
      ctx.stroke();
      
      // Horizontals
      ctx.beginPath();
      ctx.moveTo(gridStart, gridStart + i * cellWidth);
      ctx.lineTo(gridStart + gridWidth, gridStart + i * cellWidth);
      ctx.stroke();
    }
    
    // Draw cabling connections
    layoutDevices.forEach(dev => {
      if (['Mesa', 'Silla', 'Mobiliario', 'Planta Decorativa'].includes(dev.type)) return;
      
      const targets = [];
      if (dev.connectedSwitch) {
        const sw = layoutDevices.find(d => d.id === dev.connectedSwitch);
        if (sw) targets.push(sw);
      }
      if (dev.connectedServer) {
        const srv = layoutDevices.find(d => d.id === dev.connectedServer);
        if (srv) targets.push(srv);
      }
      if (targets.length === 0 && coreDevice && dev.id !== coreDevice.id) {
        targets.push(coreDevice);
      }
      
      targets.forEach(target => {
        const x1 = gridStart + (dev.x - 0.5) * cellWidth;
        const y1 = gridStart + (dev.y - 0.5) * cellWidth;
        const x2 = gridStart + (target.x - 0.5) * cellWidth;
        const y2 = gridStart + (target.y - 0.5) * cellWidth;
        
        let strokeColor = '#8F9E4B'; // success (olive green)
        let isDashed = false;
        if (dev.cablingStatus === 'Puenteado') {
          strokeColor = '#eab308'; // warning
        } else if (dev.cablingStatus === 'Inactivo') {
          strokeColor = '#ef4444'; // danger
          isDashed = true;
        } else if (dev.cablingStatus === 'Requiere Mantenimiento') {
          strokeColor = '#eab308';
          isDashed = true;
        }
        
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (isDashed) {
          ctx.setLineDash([4, 4]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    });
    ctx.setLineDash([]); // Reset
    
    // Draw devices
    layoutDevices.forEach(dev => {
      const cx = gridStart + (dev.x - 1) * cellWidth;
      const cy = gridStart + (dev.y - 1) * cellWidth;
      const meta = getDeviceMeta(dev.type);
      
      // Draw background circle or rect for device
      ctx.fillStyle = meta.colorLight || 'rgba(239, 182, 172, 0.15)';
      ctx.fillRect(cx + 4, cy + 4, cellWidth - 8, cellWidth - 8);
      
      ctx.strokeStyle = meta.color || 'var(--primary)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx + 4, cy + 4, cellWidth - 8, cellWidth - 8);
      
      // Draw Emoji
      ctx.font = '24px "Segoe UI Symbol", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.icon || '⚙️', cx + cellWidth / 2, cy + cellWidth / 2 - 8);
      
      // Draw Label
      ctx.fillStyle = '#E9E9E2';
      ctx.font = '8px "Josefin Sans", sans-serif';
      ctx.fillText(dev.name.substring(0, 10), cx + cellWidth / 2, cy + cellWidth / 2 + 16);
    });
    
    // Convert to PNG and download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `plano-${activeClient.commercialName.toLowerCase()}-${activeTab}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className={isEmbedded ? "" : "page-container"} style={isEmbedded ? { padding: 0 } : undefined}>
      {/* Header section */}
      {!isEmbedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Planos e Instalaciones de Clientes</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Diagramador de infraestructura de red física y puestos de trabajo en 2D y 3D.
            </p>
          </div>

          {/* Client selector dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="form-label" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Cliente:</span>
            <select
              className="form-select"
              style={{ width: '220px', padding: '8px 12px' }}
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setFocusedDevice(null);
              }}
            >
              {db.clients.map(c => (
                <option key={c.id} value={c.id}>{c.commercialName}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!activeClient ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          ⚠️ Debe registrar al menos un cliente en el sistema para poder usar la diagramación.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>
          
          {/* Main workspace (Grid & Tabs) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* View Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn ${activeTab === '2d' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('2d')}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                  🗺️ Vista Editor 2D
                </button>
                <button
                  className={`btn ${activeTab === '3d' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('3d')}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                  📦 Vista Isométrica 3D
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--card)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>🎨 Color de Piso:</span>
                  <input
                    type="color"
                    value={activeClient.floorColor || '#1e1e24'}
                    onChange={(e) => {
                      updateClient(activeClient.id, { floorColor: e.target.value });
                    }}
                    style={{ width: '30px', height: '24px', padding: 0, border: '1px solid var(--border)', cursor: 'pointer', borderRadius: '4px', backgroundColor: 'transparent' }}
                    title="Selecciona el color del piso para este cliente"
                  />
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    alert('¡Plano de instalaciones guardado exitosamente en el servidor!');
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                >
                  💾 Guardar Plano
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportMap}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                  📸 Exportar Plano (PNG)
                </button>
              </div>
            </div>

            {/* 2D Grid View */}
            {activeTab === '2d' && (
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '100%', textAlign: 'center' }}>
                  Pulse sobre una celda vacía para colocar un equipo nuevo, o sobre un equipo para editarlo.
                </p>

                <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '520px' }}>
                  {/* Y Axis labels */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 0 10px 0', width: '20px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {[1,2,3,4,5,6,7,8].map(y => <div key={y} style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{y}</div>)}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* X Axis labels */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      {['A','B','C','D','E','F','G','H'].map(x => <div key={x}>{x}</div>)}
                    </div>

                    {/* 8x8 Grid Matrix */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(8, 1fr)',
                      gap: '6px',
                      position: 'relative',
                      backgroundColor: activeClient.floorColor || 'transparent',
                      padding: activeClient.floorColor ? '8px' : '0px',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.3s ease'
                    }}>
                      {/* SVG Cable lines */}
                      {layoutDevices.length > 0 && (
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                          {layoutDevices.flatMap(dev => {
                            const isFurniture = ['Mesa', 'Silla', 'Mobiliario', 'Planta Decorativa'].includes(dev.type);
                            if (isFurniture) return [];
                            
                            const targets = [];
                            if (dev.connectedSwitch) {
                              const sw = layoutDevices.find(d => d.id === dev.connectedSwitch);
                              if (sw) targets.push(sw);
                            }
                            if (dev.connectedServer) {
                              const srv = layoutDevices.find(d => d.id === dev.connectedServer);
                              if (srv) targets.push(srv);
                            }
                            if (targets.length === 0 && coreDevice && dev.id !== coreDevice.id) {
                              targets.push(coreDevice);
                            }
                            
                            return targets.map(target => {
                              const cx1 = `${((dev.x - 0.5) / 8) * 100}%`;
                              const cy1 = `${((dev.y - 0.5) / 8) * 100}%`;
                              const cx2 = `${((target.x - 0.5) / 8) * 100}%`;
                              const cy2 = `${((target.y - 0.5) / 8) * 100}%`;
                              
                              let strokeColor = 'var(--primary)';
                              let dash = 'none';
                              if (dev.cablingStatus === 'Puenteado') {
                                strokeColor = 'var(--warning)';
                              } else if (dev.cablingStatus === 'Inactivo') {
                                strokeColor = 'var(--danger)';
                                dash = '4 4';
                              } else if (dev.cablingStatus === 'Requiere Mantenimiento') {
                                strokeColor = 'var(--warning)';
                                dash = '2 2';
                              } else {
                                strokeColor = 'var(--success)';
                              }
                              
                              return (
                                <line 
                                  key={`cable-${dev.id}-${target.id}`}
                                  x1={cx1} 
                                  y1={cy1} 
                                  x2={cx2} 
                                  y2={cy2} 
                                  stroke={strokeColor} 
                                  strokeWidth="2" 
                                  strokeOpacity="0.6"
                                  strokeDasharray={dash}
                                />
                              );
                            });
                          })}
                        </svg>
                      )}

                      {gridCoords.map(cell => {
                        const dev = layoutDevices.find(d => d.x === cell.x && d.y === cell.y);
                        const isFocused = focusedDevice && focusedDevice.id === dev?.id;
                        const meta = dev ? getDeviceMeta(dev.type) : null;

                        return (
                          <div
                            key={`${cell.x}-${cell.y}`}
                            onClick={() => handleCellClick(cell.x, cell.y)}
                            style={{
                              aspectRatio: '1',
                              border: dev ? `1px solid ${meta?.color}` : '1px dashed var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isFocused ? 'var(--primary-glow)' : dev ? meta?.colorLight : 'transparent',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all var(--transition-fast)',
                            }}
                            title={dev ? `${dev.name} (${dev.type})` : `Celda ${['A','B','C','D','E','F','G','H'][cell.x-1]}${cell.y}`}
                          >
                            {dev ? (
                              <>
                                <span style={{ fontSize: '1.5rem' }}>{meta?.icon}</span>
                                {/* Cabling Status Indicator Dot */}
                                {!['Mesa', 'Silla', 'Mobiliario', 'Planta Decorativa'].includes(dev.type) && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: dev.cablingStatus === 'Puenteado' ? 'var(--warning)' :
                                                     dev.cablingStatus === 'Inactivo' ? 'var(--danger)' :
                                                     dev.cablingStatus === 'Requiere Mantenimiento' ? 'var(--warning)' : 'var(--success)',
                                    border: '1px solid var(--card)',
                                    boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                                  }} title={`Cableado: ${dev.cablingStatus || 'Directo'}`} />
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                {['A','B','C','D','E','F','G','H'][cell.x-1]}{cell.y}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3D Isometric View */}
            {activeTab === '3d' && (
              <div className="card" style={{ padding: '40px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '560px', justifyContent: 'center', position: 'relative' }}>
                
                {/* 3D Scene Wrapper */}
                <div className="scene-3d" style={{
                  perspective: '1200px',
                  width: '100%',
                  height: '420px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transformStyle: 'preserve-3d'
                }}>
                   {/* Grid Rotated using rotateX & rotateZ */}
                   <div className="grid-3d" style={{
                     transform: 'rotateX(60deg) rotateZ(-45deg)',
                     transformStyle: 'preserve-3d',
                     width: '380px',
                     height: '380px',
                     backgroundColor: activeClient.floorColor || 'rgba(255,255,255,0.02)',
                     border: '2px solid var(--border)',
                     boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                     display: 'grid',
                     gridTemplateColumns: 'repeat(8, 1fr)',
                     gridTemplateRows: 'repeat(8, 1fr)',
                     gap: '4px',
                     padding: '4px',
                     position: 'relative'
                   }}>
                     {/* 3D SVG Cable lines on floor */}
                     {layoutDevices.length > 0 && (
                       <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                         {layoutDevices.flatMap(dev => {
                           const isFurniture = ['Mesa', 'Silla', 'Mobiliario', 'Planta Decorativa'].includes(dev.type);
                           if (isFurniture) return [];
                           
                           const targets = [];
                           if (dev.connectedSwitch) {
                             const sw = layoutDevices.find(d => d.id === dev.connectedSwitch);
                             if (sw) targets.push(sw);
                           }
                           if (dev.connectedServer) {
                             const srv = layoutDevices.find(d => d.id === dev.connectedServer);
                             if (srv) targets.push(srv);
                           }
                           if (targets.length === 0 && coreDevice && dev.id !== coreDevice.id) {
                             targets.push(coreDevice);
                           }
                           
                           return targets.map(target => {
                             const cx1 = `${((dev.x - 0.5) / 8) * 100}%`;
                             const cy1 = `${((dev.y - 0.5) / 8) * 100}%`;
                             const cx2 = `${((target.x - 0.5) / 8) * 100}%`;
                             const cy2 = `${((target.y - 0.5) / 8) * 100}%`;
                             
                             let strokeColor = 'var(--primary)';
                             let dash = 'none';
                             if (dev.cablingStatus === 'Puenteado') {
                               strokeColor = 'var(--warning)';
                             } else if (dev.cablingStatus === 'Inactivo') {
                               strokeColor = 'var(--danger)';
                               dash = '4 4';
                             } else if (dev.cablingStatus === 'Requiere Mantenimiento') {
                               strokeColor = 'var(--warning)';
                               dash = '2 2';
                             } else {
                               strokeColor = 'var(--success)';
                             }
                             
                             return (
                               <line 
                                 key={`cable-3d-${dev.id}-${target.id}`}
                                 x1={cx1} 
                                 y1={cy1} 
                                 x2={cx2} 
                                 y2={cy2} 
                                 stroke={strokeColor} 
                                 strokeWidth="2" 
                                 strokeOpacity="0.5"
                                 strokeDasharray={dash}
                               />
                             );
                           });
                         })}
                       </svg>
                     )}

                    {gridCoords.map(cell => {
                      const dev = layoutDevices.find(d => d.x === cell.x && d.y === cell.y);
                      const isFocused = focusedDevice && focusedDevice.id === dev?.id;
                      const meta = dev ? getDeviceMeta(dev.type) : null;

                      return (
                        <div
                          key={`3d-${cell.x}-${cell.y}`}
                          onClick={() => {
                            if (dev) {
                              setFocusedDevice(dev);
                            } else {
                              handleCellClick(cell.x, cell.y);
                            }
                          }}
                          style={{
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundColor: isFocused ? 'rgba(255,255,255,0.05)' : 'transparent',
                            position: 'relative',
                            transformStyle: 'preserve-3d',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {/* 3D Isometric Cube Render */}
                          {dev && (
                            <div className="cube-3d" style={{
                              position: 'absolute',
                              inset: '2px',
                              transformStyle: 'preserve-3d',
                              transform: isFocused ? 'translateZ(15px)' : 'translateZ(0px)',
                              transition: 'transform 0.2s ease',
                              height: '100%',
                              width: '100%'
                            }}>
                              {/* Top Face */}
                              <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                background: `linear-gradient(135deg, ${meta?.color}, var(--card))`,
                                border: `1px solid rgba(255,255,255,0.3)`,
                                transform: 'translateZ(28px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                color: '#fff',
                                boxShadow: `0 0 15px ${meta?.color}44`,
                                transformStyle: 'preserve-3d'
                              }}>
                                <span style={{ transform: 'rotateZ(45deg)' }}>{meta?.icon}</span>
                                {/* 3D Cabling Status Dot */}
                                {!['Mesa', 'Silla', 'Mobiliario', 'Planta Decorativa'].includes(dev.type) && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    right: '2px',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: dev.cablingStatus === 'Puenteado' ? 'var(--warning)' :
                                                     dev.cablingStatus === 'Inactivo' ? 'var(--danger)' :
                                                     dev.cablingStatus === 'Requiere Mantenimiento' ? 'var(--warning)' : 'var(--success)',
                                    boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                                    transform: 'translateZ(1px)'
                                  }} title={`Cableado: ${dev.cablingStatus || 'Directo'}`} />
                                )}
                              </div>
                              {/* Left Face */}
                              <div style={{
                                position: 'absolute',
                                width: '28px',
                                height: '100%',
                                background: `linear-gradient(to bottom, ${meta?.color}, rgba(0,0,0,0.8))`,
                                transform: 'rotateY(-90deg)',
                                transformOrigin: 'left center',
                                left: 0
                              }}></div>
                              {/* Front Face */}
                              <div style={{
                                position: 'absolute',
                                height: '28px',
                                width: '100%',
                                background: `linear-gradient(to right, ${meta?.color}, rgba(0,0,0,0.8))`,
                                transform: 'rotateX(-90deg)',
                                transformOrigin: 'center bottom',
                                bottom: 0
                              }}></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Cabling Notes Section */}
            <div className="card" style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px', fontWeight: 800 }}>
                📝 Notas Generales de Cableado de Red
              </h3>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Describa la topología física, la distribución general de los cables de red al servidor, y cualquier puenteo o detalle relevante del cliente..."
                value={cablingNotes}
                onChange={(e) => setCablingNotes(e.target.value)}
                style={{ resize: 'vertical', minHeight: '80px', width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    updateClient(activeClient.id, { cablingNotes });
                    alert('Notas de cableado guardadas con éxito.');
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                  Guardar Notas de Cableado
                </button>
              </div>
            </div>
          </div>

          {/* Details Sidebar panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '8px' }}>
                Información del Dispositivo
              </h3>

              {focusedDevice ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '6px', backgroundColor: getDeviceMeta(focusedDevice.type).colorLight, color: getDeviceMeta(focusedDevice.type).color }}>
                      {focusedDevice.type}
                    </span>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{focusedDevice.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Ubicación: <strong>Cuadrante {['A','B','C','D','E','F','G','H'][focusedDevice.x-1]}{focusedDevice.y}</strong>
                    </span>
                  </div>

                  {focusedDevice.description && (
                    <div style={{ backgroundColor: 'var(--background)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Detalles / Notas:</span>
                      <p style={{ fontSize: '0.75rem', marginTop: '2px', lineHeight: '1.4', color: 'var(--text-muted)' }}>{focusedDevice.description}</p>
                    </div>
                  )}

                  {/* Cabling and Workstation Details */}
                  <div style={{ backgroundColor: 'var(--background)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>🛠️ Inventario del Puesto:</span>
                      <p style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text)' }}>{focusedDevice.inventory || 'No especificado'}</p>
                    </div>
                    {focusedDevice.vposVersion && (
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>💳 Versión de VPOS:</span>
                        <p style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text)', fontWeight: 'bold' }}>{focusedDevice.vposVersion}</p>
                      </div>
                    )}
                    {(focusedDevice.connectedSwitch || focusedDevice.connectedServer) && (
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>🔗 Conectado A:</span>
                        <p style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text)' }}>
                          {focusedDevice.connectedSwitch && `Switch: ${layoutDevices.find(d => d.id === focusedDevice.connectedSwitch)?.name || 'Desconocido'}`}
                          {focusedDevice.connectedSwitch && focusedDevice.connectedServer && ' / '}
                          {focusedDevice.connectedServer && `Servidor: ${layoutDevices.find(d => d.id === focusedDevice.connectedServer)?.name || 'Desconocido'}`}
                        </p>
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>🔌 Ruta del Cableado:</span>
                      <p style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text)' }}>{focusedDevice.cablingPath || 'No especificada'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>⚡ Estado del Cableado:</span>
                      <span className={`badge ${focusedDevice.cablingStatus === 'Puenteado' ? 'badge-warning' : focusedDevice.cablingStatus === 'Inactivo' ? 'badge-danger' : 'badge-success'}`} style={{ marginTop: '2px', display: 'inline-block', fontSize: '0.65rem' }}>
                        {focusedDevice.cablingStatus || 'Directo'}
                      </span>
                    </div>
                  </div>

                  {/* Peripherals List */}
                  {focusedDevice.peripherals && focusedDevice.peripherals.length > 0 && (
                    <div style={{ backgroundColor: 'var(--background)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>⌨️ Periféricos Conectados:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {focusedDevice.peripherals.map((p, idx) => (
                          <div key={idx} style={{ fontSize: '0.75rem', borderBottom: idx < focusedDevice.peripherals.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{p.type}: <strong>{p.name}</strong></span>
                            {p.vposVersion && <span style={{ color: 'var(--primary)', fontSize: '0.65rem' }}>VPOS {p.vposVersion}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Workstation Specific Credentials block */}
                  {focusedDevice.type === 'Puesto de Trabajo' && focusedDevice.username && (
                    <div style={{ backgroundColor: 'var(--background)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(142, 70%, 45%, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--success)', textTransform: 'uppercase' }}>🔐 Credenciales del Puesto</div>
                      <div style={{ fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Usuario:</span> <strong>{focusedDevice.username}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.8125rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Clave:</span>{' '}
                          <strong style={{ fontFamily: revealedPass[focusedDevice.id] ? 'monospace' : 'inherit' }}>
                            {revealedPass[focusedDevice.id] ? revealedPass[focusedDevice.id] : '••••••••'}
                          </strong>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto' }}
                          onClick={() => handleRevealPassword(focusedDevice)}
                          disabled={loadingReveal[focusedDevice.id]}
                        >
                          {loadingReveal[focusedDevice.id] ? '...' : revealedPass[focusedDevice.id] ? 'Ocultar' : 'Ver'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Edit & Delete */}
                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.75rem' }}
                      onClick={() => handleEditClick(focusedDevice)}
                    >
                      ✏️ Editar Detalles
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.75rem' }}
                      onClick={() => handleDeleteDevice(focusedDevice.id, focusedDevice.name)}
                    >
                      🗑️ Eliminar del Plano
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '16px', lineHeight: '1.5' }}>
                  💡 Seleccione un dispositivo en el plano para ver sus detalles técnicos, notas y credenciales de acceso.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEVICE */}
      {showAddModal && selectedCell && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', margin: '20px', zIndex: 1001, animation: 'fadeInPage 0.2s ease forwards' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontWeight: 800 }}>+ Colocar Dispositivo</h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowAddModal(false); setSelectedCell(null); }}
                style={{ padding: '4px 8px', minWidth: 'auto', border: 'none', background: 'none', fontSize: '1.2rem' }}
              >✕</button>
            </div>

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Ubicación seleccionada: <strong>Celda {['A','B','C','D','E','F','G','H'][selectedCell.x - 1]}{selectedCell.y}</strong>
              </p>

              <div className="form-group">
                <label className="form-label">Tipo de Equipo</label>
                <select 
                  className="form-select" 
                  value={devType} 
                  onChange={e => setDevType(e.target.value)}
                >
                  <option value="Servidor">🖥️ Servidor</option>
                  <option value="Rack">🏢 Rack de Red</option>
                  <option value="Router">🌐 Router Core</option>
                  <option value="Switch">🔌 Switch / Distribución</option>
                  <option value="Firewall">🧱 Firewall Físico</option>
                  <option value="UPS">🔋 UPS / Respaldo Eléctrico</option>
                  <option value="Antena / AP">📡 Antena / AP</option>
                  <option value="Impresora">🖨️ Impresora de Red</option>
                  <option value="Puesto de Trabajo">💼 Puesto de Trabajo</option>
                  <option value="Periférico">⌨️ Periférico</option>
                  <option value="Mesa">🟫 Mesa de Oficina</option>
                  <option value="Silla">🪑 Silla de Oficina</option>
                  <option value="Mobiliario">🗄️ Archivador / Mueble</option>
                  <option value="Planta Decorativa">🌱 Planta Decorativa</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Identificador / Nombre</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ej. Switch-Core-01, Puesto-Desarrollo-1" 
                  required 
                  value={devName} 
                  onChange={e => setDevName(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción / Especificaciones</label>
                <textarea 
                  className="form-textarea" 
                  rows={2} 
                  placeholder="ej. Ubicado bajo el escritorio. IP estática: 10.0.1.45"
                  value={devDesc} 
                  onChange={e => setDevDesc(e.target.value)} 
                  style={{ resize: 'vertical', minHeight: '50px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Inventario / Equipamiento (ej. Teclado, mouse, switch)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Teclado, mouse, switch..." 
                  value={devInventory} 
                  onChange={e => setDevInventory(e.target.value)} 
                />
              </div>

              {/* Connected Switch / Server with quick configure */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8125rem' }}>Switch de Conexión</label>
                  {!quickCreateSwitch ? (
                    <select className="form-select" value={connectedSwitch} onChange={e => {
                      if (e.target.value === '__new__') {
                        setQuickCreateSwitch(true);
                        setConnectedSwitch('');
                      } else {
                        setConnectedSwitch(e.target.value);
                      }
                    }}>
                      <option value="">Ninguno / Directo</option>
                      {layoutDevices.filter(d => d.type === 'Switch').map(sw => (
                        <option key={sw.id} value={sw.id}>{sw.name}</option>
                      ))}
                      <option value="__new__" style={{ color: 'var(--warning)', fontWeight: 'bold' }}>+ Configurar Switch...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="text" className="form-input" placeholder="Nombre Switch" value={quickSwitchName} onChange={e => setQuickSwitchName(e.target.value)} required />
                      <button type="button" className="btn btn-secondary" onClick={() => { setQuickCreateSwitch(false); setQuickSwitchName(''); }} style={{ padding: '0 8px', minWidth: 'auto' }}>✕</button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8125rem' }}>Servidor de Destino</label>
                  {!quickCreateServer ? (
                    <select className="form-select" value={connectedServer} onChange={e => {
                      if (e.target.value === '__new__') {
                        setQuickCreateServer(true);
                        setConnectedServer('');
                      } else {
                        setConnectedServer(e.target.value);
                      }
                    }}>
                      <option value="">Ninguno</option>
                      {layoutDevices.filter(d => d.type === 'Servidor').map(srv => (
                        <option key={srv.id} value={srv.id}>{srv.name}</option>
                      ))}
                      <option value="__new__" style={{ color: 'var(--warning)', fontWeight: 'bold' }}>+ Configurar Servidor...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="text" className="form-input" placeholder="Nombre Servidor" value={quickServerName} onChange={e => setQuickServerName(e.target.value)} required />
                      <button type="button" className="btn btn-secondary" onClick={() => { setQuickCreateServer(false); setQuickServerName(''); }} style={{ padding: '0 8px', minWidth: 'auto' }}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* VPOS Version field */}
              {['Puesto de Trabajo', 'Periférico'].includes(devType) && (
                <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <label className="form-label">Versión de VPOS</label>
                  <input type="text" className="form-input" placeholder="ej. v2.3.4" value={vposVersion} onChange={e => setVposVersion(e.target.value)} />
                </div>
              )}

              {/* Peripherals subform */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase' }}>Periféricos Conectados ({peripherals.length})</span>
                {peripherals.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {peripherals.map((p, idx) => (
                      <span key={idx} className="badge badge-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.type}: {p.name} {p.vposVersion && `(VPOS ${p.vposVersion})`}
                        <button type="button" onClick={() => setPeripherals(peripherals.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr auto', gap: '6px', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>Tipo</label>
                    <select className="form-select" style={{ padding: '4px 6px', fontSize: '0.75rem' }} value={newPeriType} onChange={e => setNewPeriType(e.target.value)}>
                      <option value="Impresora Térmica">Impresora Térmica</option>
                      <option value="Impresora Fiscal">Impresora Fiscal</option>
                      <option value="Lector de Barras">Lector de Barras</option>
                      <option value="Lector de Huellas">Lector de Huellas</option>
                      <option value="VPOS">VPOS</option>
                      <option value="Pinpad">Pinpad</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>Modelo</label>
                    <input type="text" className="form-input" style={{ padding: '4px 6px', fontSize: '0.75rem' }} placeholder="ej. Epson T20" value={newPeriName} onChange={e => setNewPeriName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>VPOS</label>
                    <input type="text" className="form-input" style={{ padding: '4px 6px', fontSize: '0.75rem' }} placeholder="ej. v1.0" value={newPeriVposVersion} onChange={e => setNewPeriVposVersion(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => {
                    if (!newPeriName) return;
                    setPeripherals([...peripherals, { type: newPeriType, name: newPeriName, vposVersion: newPeriVposVersion }]);
                    setNewPeriName('');
                    setNewPeriVposVersion('');
                  }} style={{ padding: '6px 10px', minWidth: 'auto', fontSize: '0.75rem' }}>+</button>
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Ruta del Cableado</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="ej. Por canaleta superior..." 
                    value={devCablingPath} 
                    onChange={e => setDevCablingPath(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado del Cableado</label>
                  <select 
                    className="form-select" 
                    value={devCablingStatus} 
                    onChange={e => setDevCablingStatus(e.target.value)}
                  >
                    <option value="Directo">Directo</option>
                    <option value="Puenteado">Puenteado</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Requiere Mantenimiento">Requiere Mantenimiento</option>
                  </select>
                </div>
              </div>

              {/* Puesto de trabajo credentials form section */}
              {devType === 'Puesto de Trabajo' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--success)', textTransform: 'uppercase' }}>Configurar Credenciales del Puesto</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Usuario</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="ej. usuario.admin" 
                        value={workstationUser} 
                        onChange={e => setWorkstationUser(e.target.value)} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Clave Secreta</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="••••••••" 
                        value={workstationPass} 
                        onChange={e => setWorkstationPass(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setSelectedCell(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Colocar Equipo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DEVICE */}
      {showEditModal && editDevId && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', margin: '20px', zIndex: 1001, animation: 'fadeInPage 0.2s ease forwards' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontWeight: 800 }}>✏️ Editar Dispositivo</h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowEditModal(false); }}
                style={{ padding: '4px 8px', minWidth: 'auto', border: 'none', background: 'none', fontSize: '1.2rem' }}
              >✕</button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Tipo de Equipo</label>
                <select 
                  className="form-select" 
                  value={editDevType} 
                  onChange={e => setEditDevType(e.target.value)}
                >
                  <option value="Servidor">🖥️ Servidor</option>
                  <option value="Rack">🏢 Rack de Red</option>
                  <option value="Router">🌐 Router Core</option>
                  <option value="Switch">🔌 Switch / Distribución</option>
                  <option value="Firewall">🧱 Firewall Físico</option>
                  <option value="UPS">🔋 UPS / Respaldo Eléctrico</option>
                  <option value="Antena / AP">📡 Antena / AP</option>
                  <option value="Impresora">🖨️ Impresora de Red</option>
                  <option value="Puesto de Trabajo">💼 Puesto de Trabajo</option>
                  <option value="Periférico">⌨️ Periférico</option>
                  <option value="Mesa">🟫 Mesa de Oficina</option>
                  <option value="Silla">🪑 Silla de Oficina</option>
                  <option value="Mobiliario">🗄️ Archivador / Mueble</option>
                  <option value="Planta Decorativa">🌱 Planta Decorativa</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Identificador / Nombre</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ej. Switch-Core-01" 
                  required 
                  value={editDevName} 
                  onChange={e => setEditDevName(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción / Especificaciones</label>
                <textarea 
                  className="form-textarea" 
                  rows={2} 
                  placeholder="ej. Ubicado bajo el escritorio. IP estática: 10.0.1.45"
                  value={editDevDesc} 
                  onChange={e => setEditDevDesc(e.target.value)} 
                  style={{ resize: 'vertical', minHeight: '50px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Inventario / Equipamiento (ej. Teclado, mouse, switch)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Teclado, mouse, switch..." 
                  value={editDevInventory} 
                  onChange={e => setEditDevInventory(e.target.value)} 
                />
              </div>

              {/* Connected Switch / Server with quick configure */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8125rem' }}>Switch de Conexión</label>
                  {!editQuickCreateSwitch ? (
                    <select className="form-select" value={editConnectedSwitch} onChange={e => {
                      if (e.target.value === '__new__') {
                        setEditQuickCreateSwitch(true);
                        setEditConnectedSwitch('');
                      } else {
                        setEditConnectedSwitch(e.target.value);
                      }
                    }}>
                      <option value="">Ninguno / Directo</option>
                      {layoutDevices.filter(d => d.type === 'Switch' && d.id !== editDevId).map(sw => (
                        <option key={sw.id} value={sw.id}>{sw.name}</option>
                      ))}
                      <option value="__new__" style={{ color: 'var(--warning)', fontWeight: 'bold' }}>+ Configurar Switch...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="text" className="form-input" placeholder="Nombre Switch" value={editQuickSwitchName} onChange={e => setEditQuickSwitchName(e.target.value)} required />
                      <button type="button" className="btn btn-secondary" onClick={() => { setEditQuickCreateSwitch(false); setEditQuickSwitchName(''); }} style={{ padding: '0 8px', minWidth: 'auto' }}>✕</button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8125rem' }}>Servidor de Destino</label>
                  {!editQuickCreateServer ? (
                    <select className="form-select" value={editConnectedServer} onChange={e => {
                      if (e.target.value === '__new__') {
                        setEditQuickCreateServer(true);
                        setEditConnectedServer('');
                      } else {
                        setEditConnectedServer(e.target.value);
                      }
                    }}>
                      <option value="">Ninguno</option>
                      {layoutDevices.filter(d => d.type === 'Servidor' && d.id !== editDevId).map(srv => (
                        <option key={srv.id} value={srv.id}>{srv.name}</option>
                      ))}
                      <option value="__new__" style={{ color: 'var(--warning)', fontWeight: 'bold' }}>+ Configurar Servidor...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="text" className="form-input" placeholder="Nombre Servidor" value={editQuickServerName} onChange={e => setEditQuickServerName(e.target.value)} required />
                      <button type="button" className="btn btn-secondary" onClick={() => { setEditQuickCreateServer(false); setEditQuickServerName(''); }} style={{ padding: '0 8px', minWidth: 'auto' }}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* VPOS Version field */}
              {['Puesto de Trabajo', 'Periférico'].includes(editDevType) && (
                <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <label className="form-label">Versión de VPOS</label>
                  <input type="text" className="form-input" placeholder="ej. v2.3.4" value={editVposVersion} onChange={e => setEditVposVersion(e.target.value)} />
                </div>
              )}

              {/* Peripherals subform */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase' }}>Periféricos Conectados ({editPeripherals.length})</span>
                {editPeripherals.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {editPeripherals.map((p, idx) => (
                      <span key={idx} className="badge badge-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.type}: {p.name} {p.vposVersion && `(VPOS ${p.vposVersion})`}
                        <button type="button" onClick={() => setEditPeripherals(editPeripherals.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr auto', gap: '6px', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>Tipo</label>
                    <select className="form-select" style={{ padding: '4px 6px', fontSize: '0.75rem' }} value={newPeriType} onChange={e => setNewPeriType(e.target.value)}>
                      <option value="Impresora Térmica">Impresora Térmica</option>
                      <option value="Impresora Fiscal">Impresora Fiscal</option>
                      <option value="Lector de Barras">Lector de Barras</option>
                      <option value="Lector de Huellas">Lector de Huellas</option>
                      <option value="VPOS">VPOS</option>
                      <option value="Pinpad">Pinpad</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>Modelo</label>
                    <input type="text" className="form-input" style={{ padding: '4px 6px', fontSize: '0.75rem' }} placeholder="ej. Epson T20" value={newPeriName} onChange={e => setNewPeriName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>VPOS</label>
                    <input type="text" className="form-input" style={{ padding: '4px 6px', fontSize: '0.75rem' }} placeholder="ej. v1.0" value={newPeriVposVersion} onChange={e => setNewPeriVposVersion(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => {
                    if (!newPeriName) return;
                    setEditPeripherals([...editPeripherals, { type: newPeriType, name: newPeriName, vposVersion: newPeriVposVersion }]);
                    setNewPeriName('');
                    setNewPeriVposVersion('');
                  }} style={{ padding: '6px 10px', minWidth: 'auto', fontSize: '0.75rem' }}>+</button>
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Ruta del Cableado</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="ej. Por canaleta superior..." 
                    value={editDevCablingPath} 
                    onChange={e => setEditDevCablingPath(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado del Cableado</label>
                  <select 
                    className="form-select" 
                    value={editDevCablingStatus} 
                    onChange={e => setEditDevCablingStatus(e.target.value)}
                  >
                    <option value="Directo">Directo</option>
                    <option value="Puenteado">Puenteado</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Requiere Mantenimiento">Requiere Mantenimiento</option>
                  </select>
                </div>
              </div>

              {/* Puesto de trabajo credentials form section */}
              {editDevType === 'Puesto de Trabajo' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--success)', textTransform: 'uppercase' }}>Configurar Credenciales del Puesto</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Usuario</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="ej. usuario.admin" 
                        value={editWorkstationUser} 
                        onChange={e => setEditWorkstationUser(e.target.value)} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Clave Secreta (Dejar en blanco para conservar)</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Nueva contraseña" 
                        value={editWorkstationPass} 
                        onChange={e => setEditWorkstationPass(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
