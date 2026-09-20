import React, { useContext, useState, useEffect } from 'react';
import { AppContext, getApiUrl } from '../context/AppContext';
import { decryptData, encryptData } from '../utils/crypto';
import Modal from '../components/Modal';
import ImageLightbox from '../components/ImageLightbox';
import Layouts from './Layouts';
import Backups from './Backups';

export default function Clients() {
  const { db, updateClientTechnical, logActivity, addClient, currentUser, addClientFollowUp, updateClient, setActiveTab, setPendingTicket, refreshDatabase, userCanViewFinancials } = useContext(AppContext);
  const canManage = currentUser && (currentUser.role === 'Administrador' || currentUser.role === 'Gerente' || currentUser.id === 'emp-master');
  const canSeeMoney = userCanViewFinancials ? userCanViewFinancials(currentUser) : (currentUser?.role === 'Administrador' || currentUser?.role === 'Gerente' || currentUser?.id === 'emp-master');
  const [selectedClient, setSelectedClient] = useState(null);
  const [revealedCreds, setRevealedCreds] = useState({}); // { credId: decryptedPlaintext }
  const [loadingCreds, setLoadingCreds] = useState({}); // { credId: boolean }
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Client Type/Section State
  const [clientSection, setClientSection] = useState('Dashboard'); // 'Dashboard', 'Normal', 'Inactivo', or 'Potencial'
  const [newFollowUpComment, setNewFollowUpComment] = useState('');
  const [newStatus, setNewStatus] = useState('Activo');
  const [editStatus, setEditStatus] = useState('Activo');

  // Add Client Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newRif, setNewRif] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newServiceType, setNewServiceType] = useState('');
  const [newContractStart, setNewContractStart] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDbType, setNewDbType] = useState('DBF');
  const [newGroupName, setNewGroupName] = useState('');

  // Edit Client Form Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClientId, setEditClientId] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editRif, setEditRif] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editServiceType, setEditServiceType] = useState('');
  const [editContractStart, setEditContractStart] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDbType, setEditDbType] = useState('DBF');
  const [editLeadSource, setEditLeadSource] = useState('Recomendación');
  const [editOccupation, setEditOccupation] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editMonthlyFee, setEditMonthlyFee] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  // Add client extra form fields
  const [newMonthlyFee, setNewMonthlyFee] = useState('');

  // Potential client form fields
  const [newLeadSource, setNewLeadSource] = useState('Recomendación');
  const [newOccupation, setNewOccupation] = useState('');
  const [newInstagram, setNewInstagram] = useState('');

  // Edit Tech State
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvIp, setNewSrvIp] = useState('');
  const [newSrvType, setNewSrvType] = useState('');
  const [newSrvVersion, setNewSrvVersion] = useState('');
  const [newSrvAnydesk, setNewSrvAnydesk] = useState('');

  // Edit Server State
  const [showEditServerModal, setShowEditServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [editSrvName, setEditSrvName] = useState('');
  const [editSrvIp, setEditSrvIp] = useState('');
  const [editSrvType, setEditSrvType] = useState('');
  const [editSrvVersion, setEditSrvVersion] = useState('');
  const [editSrvAnydesk, setEditSrvAnydesk] = useState('');
  const [editSrvStatus, setEditSrvStatus] = useState('Activo');

  const [showAddCredModal, setShowAddCredModal] = useState(false);
  const [newCredLabel, setNewCredLabel] = useState('');
  const [newCredUser, setNewCredUser] = useState('');
  const [newCredPass, setNewCredPass] = useState('');

  // Edit Credential State
  const [showEditCredModal, setShowEditCredModal] = useState(false);
  const [editCredId, setEditCredId] = useState('');
  const [editCredLabel, setEditCredLabel] = useState('');
  const [editCredUser, setEditCredUser] = useState('');
  const [editCredPass, setEditCredPass] = useState('');

  // Subtab State
  const [activeSubTab, setActiveSubTab] = useState('general');

  // Deep-linking desde URL (JC Backup -> Portal Principal)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const subtabParam = params.get('subtab');
      const clientParam = params.get('client') || params.get('clientId');
      if (subtabParam) {
        setActiveSubTab(subtabParam);
      }
      if (clientParam && db?.clients && Array.isArray(db.clients)) {
        const found = db.clients.find(c =>
          c.id === clientParam ||
          (c.commercialName && c.commercialName.toLowerCase() === clientParam.toLowerCase()) ||
          (c.businessName && c.businessName.toLowerCase() === clientParam.toLowerCase())
        );
        if (found) {
          setSelectedClient(found);
        }
      }
    } catch (e) {}
  }, [db?.clients]);

  // Client Files States
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileDesc, setNewFileDesc] = useState('');
  const [newFileType, setNewFileType] = useState('Documento PDF');
  const [newFileSize, setNewFileSize] = useState('1.2 MB');
  const [newFileDataUrl, setNewFileDataUrl] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [inlinePreviewFileId, setInlinePreviewFileId] = useState(null);

  // Workstation States
  const [showAddWorkstationModal, setShowAddWorkstationModal] = useState(false);
  const [newWkName, setNewWkName] = useState('');
  const [newWkUser, setNewWkUser] = useState('');
  const [newWkPass, setNewWkPass] = useState('');
  const [newWkAnydesk, setNewWkAnydesk] = useState('');
  const [newWkAnydeskPass, setNewWkAnydeskPass] = useState('');
  const [newWkDetails, setNewWkDetails] = useState('');
  const [newWkFiscalPrinter, setNewWkFiscalPrinter] = useState('');

  // Edit Workstation States
  const [showEditWorkstationModal, setShowEditWorkstationModal] = useState(false);
  const [editWkId, setEditWkId] = useState('');
  const [editWkName, setEditWkName] = useState('');
  const [editWkUser, setEditWkUser] = useState('');
  const [editWkPass, setEditWkPass] = useState('');
  const [editWkAnydesk, setEditWkAnydesk] = useState('');
  const [editWkAnydeskPass, setEditWkAnydeskPass] = useState('');
  const [editWkDetails, setEditWkDetails] = useState('');
  const [editWkFiscalPrinter, setEditWkFiscalPrinter] = useState('');

  const [revealedWkSecrets, setRevealedWkSecrets] = useState({}); // { `${wkId}-${field}`: plaintext }
  const [loadingWkSecrets, setLoadingWkSecrets] = useState({}); // { `${wkId}-${field}`: boolean }
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    triggerToast(message || 'Copiado al portapapeles');
  };

  // Client Layout States
  const [selectedGridCell, setSelectedGridCell] = useState(null);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [newDevDesc, setNewDevDesc] = useState('');
  const [newDevType, setNewDevType] = useState('Servidor');
  const [focusedDevice, setFocusedDevice] = useState(null);

  // Files Management Handlers
  const handleAddFileSubmit = (e) => {
    e.preventDefault();
    if (!newFileName || !activeClient) return;

    const newFile = {
      id: `file-${Date.now()}`,
      name: newFileName,
      description: newFileDesc,
      type: newFileType || 'Documento PDF',
      size: newFileSize || '1.2 MB',
      uploadDate: new Date().toISOString().split('T')[0],
      dataUrl: newFileDataUrl
    };

    const currentFiles = activeClient.files || [];
    const updatedFiles = [...currentFiles, newFile];

    updateClientTechnical(
      activeClient.id, 
      activeClient.infrastructure, 
      activeClient.credentials, 
      updatedFiles, 
      activeClient.layout || [],
      'Gestión de Archivos',
      `Subió archivo "${newFileName}" para el cliente "${activeClient.commercialName}"`
    );

    setNewFileName('');
    setNewFileDesc('');
    setNewFileType('Documento PDF');
    setNewFileSize('1.2 MB');
    setNewFileDataUrl('');
    setShowAddFileModal(false);

    setSelectedClient({ ...activeClient, files: updatedFiles });
  };

  const handleDeleteFile = (fileId, fileName) => {
    if (!activeClient) return;
    const currentFiles = activeClient.files || [];
    const updatedFiles = currentFiles.filter(f => f.id !== fileId);

    updateClientTechnical(
      activeClient.id,
      activeClient.infrastructure,
      activeClient.credentials,
      updatedFiles,
      activeClient.layout || [],
      'Gestión de Archivos',
      `Eliminó archivo "${fileName}" para el cliente "${activeClient.commercialName}"`
    );

    setSelectedClient({ ...activeClient, files: updatedFiles });
  };

  // Layout / Plan Editor Handlers
  const handleAddDeviceSubmit = (e) => {
    e.preventDefault();
    if (!selectedGridCell || !newDevName || !activeClient) return;

    const newDevice = {
      id: `dev-${Date.now()}`,
      x: selectedGridCell.x,
      y: selectedGridCell.y,
      type: newDevType,
      name: newDevName,
      description: newDevDesc
    };

    const currentLayout = activeClient.layout || [];
    const filteredLayout = currentLayout.filter(d => !(d.x === selectedGridCell.x && d.y === selectedGridCell.y));
    const updatedLayout = [...filteredLayout, newDevice];

    updateClientTechnical(
      activeClient.id,
      activeClient.infrastructure,
      activeClient.credentials,
      activeClient.files || [],
      updatedLayout,
      'Plano de Instalación',
      `Agregó dispositivo "${newDevName}" (${newDevType}) en coordenadas (${selectedGridCell.x}, ${selectedGridCell.y}) al plano del cliente "${activeClient.commercialName}"`
    );

    setNewDevName('');
    setNewDevDesc('');
    setNewDevType('Servidor');
    setSelectedGridCell(null);
    setShowAddDeviceModal(false);

    setSelectedClient({ ...activeClient, layout: updatedLayout });
  };

  const handleDeleteDevice = (deviceId, devName) => {
    if (!activeClient) return;
    const currentLayout = activeClient.layout || [];
    const updatedLayout = currentLayout.filter(d => d.id !== deviceId);

    updateClientTechnical(
      activeClient.id,
      activeClient.infrastructure,
      activeClient.credentials,
      activeClient.files || [],
      updatedLayout,
      'Plano de Instalación',
      `Eliminó dispositivo "${devName}" del plano del cliente "${activeClient.commercialName}"`
    );
    setFocusedDevice(null);

    setSelectedClient({ ...activeClient, layout: updatedLayout });
  };

  if (!db) return null;

  const allClients = db.clients || [];

  const activeClientsList = allClients.filter(c => 
    (c.clientType || 'Normal') === 'Normal' && (c.status || 'Activo') !== 'Inactivo'
  );
  const inactiveClientsList = allClients.filter(c => 
    (c.status || 'Activo') === 'Inactivo' || c.clientType === 'Inactivo'
  );
  const potentialClientsList = allClients.filter(c => 
    c.clientType === 'Potencial' && (c.status || 'Activo') !== 'Inactivo'
  );

  const sectionClients = (
    clientSection === 'Inactivo' ? inactiveClientsList :
    clientSection === 'Potencial' ? potentialClientsList :
    activeClientsList
  ).sort((a, b) => (a.commercialName || '').localeCompare(b.commercialName || '', 'es', { sensitivity: 'base' }));

  const activeClient = selectedClient
    ? (db.clients.find(c => c.id === selectedClient.id) || selectedClient)
    : sectionClients[0];

  const filteredClients = sectionClients.filter(cli => 
    (cli.commercialName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cli.rif || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Dashboard Metrics Calculations ---
  const sqlCount = allClients.filter(c => (c.dbType || '').toUpperCase().includes('SQL')).length;
  const dbfCount = allClients.filter(c => (c.dbType || 'DBF').toUpperCase().includes('DBF')).length;
  const otherDbCount = allClients.length - (sqlCount + dbfCount);

  const contractCount = allClients.filter(c => (c.serviceType || '').toUpperCase().includes('CONTRATO')).length;
  const hourlyCount = allClients.filter(c => (c.serviceType || '').toUpperCase().includes('HORA')).length;
  const eventualCount = allClients.filter(c => (c.serviceType || '').toUpperCase().includes('EVENTUAL')).length;
  const otherServiceCount = allClients.length - (contractCount + hourlyCount + eventualCount);

  const serviceTypeBreakdown = [
    { label: 'CONTRATO ANUAL / MENSUAL', count: contractCount, color: '#3b82f6' },
    { label: 'SOPORTE POR HORAS', count: hourlyCount, color: '#8b5cf6' },
    { label: 'EVENTUAL / POR DEMANDA', count: eventualCount, color: '#eab308' },
    { label: 'OTROS / SIN CONTRATO', count: otherServiceCount, color: '#64748b' }
  ];

  const totalServersCount = allClients.reduce((sum, c) => sum + (c.infrastructure?.servers?.length || 0), 0);
  const totalWorkstationsCount = allClients.reduce((sum, c) => sum + (c.infrastructure?.workstations?.length || 0), 0);

  const topInfraClients = [...allClients]
    .map(c => {
      const srvs = c.infrastructure?.servers?.length || 0;
      const wks = c.infrastructure?.workstations?.length || 0;
      return {
        ...c,
        serversCount: srvs,
        workstationsCount: wks,
        totalEquip: srvs + wks
      };
    })
    .sort((a, b) => b.totalEquip - a.totalEquip)
    .slice(0, 5);

  const clientGroupsSummary = Array.from(new Set(allClients.map(c => c.groupName).filter(Boolean))).map(groupName => {
    const count = allClients.filter(c => c.groupName === groupName).length;
    return { name: groupName, count };
  });

  const getClientDeactivatedDate = (cli) => {
    if (!cli) return null;
    if (cli.deactivatedAt) return new Date(cli.deactivatedAt);
    if (cli.statusChangedAt) return new Date(cli.statusChangedAt);
    if (cli.id && cli.id.startsWith('cli-')) {
      const ts = parseInt(cli.id.replace('cli-', ''), 10);
      if (!isNaN(ts)) return new Date(ts);
    }
    return null;
  };

  const getClientActivatedDate = (cli) => {
    if (!cli) return null;
    if (cli.activatedAt) return new Date(cli.activatedAt);
    if (cli.statusChangedAt) return new Date(cli.statusChangedAt);
    if (cli.contractStart) return new Date(cli.contractStart);
    if (cli.id && cli.id.startsWith('cli-')) {
      const ts = parseInt(cli.id.replace('cli-', ''), 10);
      if (!isNaN(ts)) return new Date(ts);
    }
    return null;
  };

  const formatDurationFromNow = (date) => {
    if (!date) return 'Sin fecha registrada';
    const now = new Date();
    const diffMs = now - date;
    if (diffMs < 0) return 'Reciente';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return '1 día';
    if (diffDays < 30) return `${diffDays} días`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      const remDays = diffDays % 30;
      return `${diffMonths} mes${diffMonths === 1 ? '' : 'es'}${remDays > 0 ? ` (${diffDays}d)` : ''}`;
    }

    const diffYears = Math.floor(diffDays / 365);
    const remMonths = Math.floor((diffDays % 365) / 30);
    return `${diffYears} año${diffYears === 1 ? '' : 's'}${remMonths > 0 ? `, ${remMonths} mes${remMonths === 1 ? '' : 'es'}` : ''}`;
  };

  const nowMs = new Date().getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const yearMs = 365 * 24 * 60 * 60 * 1000;

  const deactivatedLastMonth = inactiveClientsList.filter(cli => {
    const d = getClientDeactivatedDate(cli);
    return d && (nowMs - d.getTime() <= thirtyDaysMs);
  }).length;

  const deactivatedLastYear = inactiveClientsList.filter(cli => {
    const d = getClientDeactivatedDate(cli);
    return d && (nowMs - d.getTime() <= yearMs);
  }).length;

  const activatedLastMonth = activeClientsList.filter(cli => {
    const d = getClientActivatedDate(cli);
    return d && (nowMs - d.getTime() <= thirtyDaysMs);
  }).length;

  const activatedLastYear = activeClientsList.filter(cli => {
    const d = getClientActivatedDate(cli);
    return d && (nowMs - d.getTime() <= yearMs);
  }).length;

  const parseContractStartDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'string') {
      const cleanStr = dateVal.trim();
      if (cleanStr.includes('-')) {
        const parts = cleanStr.split('T')[0].split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return new Date(y, m, d);
          }
        }
      } else if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          let y, m, d;
          if (parts[0].length === 4) {
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10) - 1;
            d = parseInt(parts[2], 10);
          } else {
            d = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10) - 1;
            y = parseInt(parts[2], 10);
          }
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return new Date(y, m, d);
          }
        }
      }
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  };

  const getClientContractDate = (cli) => {
    if (!cli) return null;
    if (cli.contractStart) {
      const d = parseContractStartDate(cli.contractStart);
      if (d) return d;
    }
    if (cli.id && typeof cli.id === 'string' && cli.id.startsWith('cli-')) {
      const ts = parseInt(cli.id.replace('cli-', ''), 10);
      if (!isNaN(ts)) return new Date(ts);
    }
    return null;
  };

  const parseFeeNumber = (fee) => {
    if (!fee) return 0;
    const str = String(fee).replace(/[^0-9.]/g, '');
    return parseFloat(str) || 0;
  };

  const todayDate = new Date();
  const endOfCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0, 23, 59, 59);

  // Active clients whose contract has already started (contractStart <= end of current month)
  const effectiveActiveClientsList = activeClientsList.filter(cli => {
    const cStart = getClientContractDate(cli);
    return !cStart || cStart <= endOfCurrentMonth;
  });

  // Active clients whose contract starts in a future month (contractStart > end of current month)
  const futureClientsList = activeClientsList.filter(cli => {
    const cStart = getClientContractDate(cli);
    return cStart && cStart > endOfCurrentMonth;
  });

  const expectedMonthlyRevenue = effectiveActiveClientsList.reduce((sum, c) => sum + parseFeeNumber(c.monthlyFee || c.billingFee), 0);
  const futureCommittedRevenue = futureClientsList.reduce((sum, c) => sum + parseFeeNumber(c.monthlyFee || c.billingFee), 0);
  const lostMonthlyRevenue = inactiveClientsList.reduce((sum, c) => sum + parseFeeNumber(c.monthlyFee || c.billingFee), 0);

  const goalRevenue2Percent = expectedMonthlyRevenue * 1.02;
  const goalRevenue5Percent = expectedMonthlyRevenue * 1.05;
  const delta2Percent = expectedMonthlyRevenue * 0.02;
  const delta5Percent = expectedMonthlyRevenue * 0.05;

  const generateMonthlyRevenueHistory = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleDateString('es-ES', { month: 'short' });
      const year = d.getFullYear();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${monthName.toUpperCase().replace('.', '')} ${year}`;
      
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      let monthRevenue = 0;
      let newContractRevenue = 0;
      let newContractsCount = 0;
      let lostRevenue = 0;
      let lostClientsCount = 0;

      allClients.forEach((cli) => {
        const fee = parseFeeNumber(cli.monthlyFee || cli.billingFee);
        const cStart = getClientContractDate(cli);

        let wasContracted = true;
        if (cStart) {
          if (cStart > endOfMonth) wasContracted = false;
        }

        let wasDeactivated = false;
        let deactivatedInThisMonth = false;
        if (cli.status === 'Inactivo' || cli.clientType === 'Inactivo') {
          const deacDate = getClientDeactivatedDate(cli);
          if (!deacDate || deacDate < startOfMonth) {
            wasDeactivated = true;
          } else if (deacDate >= startOfMonth && deacDate <= endOfMonth) {
            deactivatedInThisMonth = true;
          }
        }

        if (wasContracted && !wasDeactivated) {
          monthRevenue += fee;
        }

        // New contracts starting in this specific month
        if (cStart && cStart >= startOfMonth && cStart <= endOfMonth && (cli.status || 'Activo') !== 'Inactivo') {
          if (fee > 0) {
            newContractRevenue += fee;
          }
          newContractsCount++;
        }

        // Contracts deactivated in this specific month
        if (deactivatedInThisMonth) {
          if (fee > 0) {
            lostRevenue += fee;
          }
          lostClientsCount++;
        }
      });

      const netGrowth = newContractRevenue - lostRevenue;

      months.push({
        key: monthKey,
        label: monthLabel,
        revenue: monthRevenue,
        newContractRevenue,
        newContractsCount,
        lostRevenue,
        lostClientsCount,
        netGrowth,
        date: startOfMonth
      });
    }

    let maxGrowth = 0;
    let maxRevenue = 0;

    months.forEach((m, idx) => {
      if (m.revenue > maxRevenue) maxRevenue = m.revenue;

      if (idx === 0) {
        m.growthRate = 0;
        m.isPeak = false;
      } else {
        const prevRev = months[idx - 1].revenue;
        if (prevRev > 0) {
          m.growthRate = ((m.revenue - prevRev) / prevRev) * 100;
        } else {
          m.growthRate = m.revenue > 0 ? 100 : 0;
        }
        if (m.growthRate > maxGrowth) {
          maxGrowth = m.growthRate;
        }
      }
    });

    months.forEach((m, idx) => {
      if (m.growthRate > 0 && m.growthRate === maxGrowth && idx > 0) {
        m.isPeak = true;
      } else if (m.revenue === maxRevenue && maxRevenue > 0) {
        m.isRevenuePeak = true;
      }
    });

    const firstMonthRev = months[0]?.revenue || 0;
    const currentMonthRev = months[11]?.revenue || 0;
    const accumulatedGrowth = firstMonthRev > 0 ? ((currentMonthRev - firstMonthRev) / firstMonthRev) * 100 : 0;

    return { months, maxRevenue, maxGrowth, accumulatedGrowth, firstMonthRev, currentMonthRev };
  };

  const revenueHistoryData = generateMonthlyRevenueHistory();

  const handleChangeClientStatus = (cli, targetStatus) => {
    if (!cli || !targetStatus) return;
    
    const nowIso = new Date().toISOString();
    let updates = {};
    let statusLabel = '';
    let targetSection = 'Normal';
    
    if (targetStatus === 'Activo') {
      updates = { clientType: 'Normal', status: 'Activo', statusChangedAt: nowIso, activatedAt: nowIso };
      statusLabel = 'Activo';
      targetSection = 'Normal';
    } else if (targetStatus === 'Inactivo') {
      updates = { status: 'Inactivo', statusChangedAt: nowIso, deactivatedAt: nowIso };
      statusLabel = 'Inactivo';
      targetSection = 'Inactivo';
    } else if (targetStatus === 'Prospecto' || targetStatus === 'Potencial') {
      updates = { clientType: 'Potencial', status: 'Activo', statusChangedAt: nowIso, activatedAt: nowIso };
      statusLabel = 'Prospecto';
      targetSection = 'Potencial';
    }

    // Immediate UI feedback
    setClientSection(targetSection);
    setSelectedClient({ ...cli, ...updates });
    triggerToast(`Cliente ${cli.commercialName} actualizado a ${statusLabel}`);

    // Background update & logging
    updateClient(cli.id, updates);
    logActivity(
      'Cambio de Estado de Cliente',
      `Cambió el estado del cliente "${cli.commercialName}" a ${statusLabel}`,
      currentUser
    );
  };

  // Reveal Credential and Log
  const handleRevealCredential = async (cred) => {
    if (revealedCreds[cred.id]) {
      const updated = { ...revealedCreds };
      delete updated[cred.id];
      setRevealedCreds(updated);
      return;
    }

    setLoadingCreds(prev => ({ ...prev, [cred.id]: true }));
    const plainText = await decryptData(cred.password);
    
    setRevealedCreds(prev => ({ ...prev, [cred.id]: plainText }));
    setLoadingCreds(prev => ({ ...prev, [cred.id]: false }));

    logActivity(
      'Librería de Credenciales', 
      `Consultó credencial "${cred.label}" (usuario: ${cred.username}) para el cliente "${activeClient.commercialName}"`
    );
  };

  // Add Client
  const handleAddClientSubmit = (e) => {
    e.preventDefault();
    if (!newClientName || !newRif) return;

    const isProspect = newStatus === 'Prospecto' || clientSection === 'Potencial';
    const isInactive = newStatus === 'Inactivo';

    const clientPayload = {
      clientType: isProspect ? 'Potencial' : 'Normal',
      status: isInactive ? 'Inactivo' : 'Activo',
      commercialName: newClientName,
      businessName: newBusinessName,
      rif: newRif,
      address: newAddress,
      phone: newPhone,
      email: newEmail,
      contactPerson: newContact,
      notes: newNotes,
      groupName: newGroupName,
      monthlyFee: newMonthlyFee,
      followUps: []
    };

    if (isProspect) {
      clientPayload.leadSource = newLeadSource;
      clientPayload.occupation = newOccupation;
      clientPayload.instagram = newInstagram;
      setNewLeadSource('Recomendación');
      setNewOccupation('');
      setNewInstagram('');
    } else {
      clientPayload.serviceType = newServiceType;
      clientPayload.contractStart = newContractStart;
      clientPayload.dbType = newDbType;
    }

    addClient(clientPayload);

    // Reset fields
    setNewClientName(''); setNewBusinessName(''); setNewRif('');
    setNewAddress(''); setNewPhone(''); setNewEmail('');
    setNewContact(''); setNewServiceType(''); setNewContractStart(''); setNewNotes('');
    setNewDbType('DBF');
    setNewGroupName('');
    setNewMonthlyFee('');
    setNewStatus('Activo');
    setShowAddModal(false);
  };

  // Edit Client Handlers
  const handleOpenEdit = (cli) => {
    setEditClientId(cli.id);
    setEditClientName(cli.commercialName || '');
    setEditBusinessName(cli.businessName || '');
    setEditRif(cli.rif || '');
    setEditAddress(cli.address || '');
    setEditPhone(cli.phone || '');
    setEditEmail(cli.email || '');
    setEditContact(cli.contactPerson || '');
    setEditServiceType(cli.serviceType || '');
    setEditContractStart(cli.contractStart || '');
    setEditNotes(cli.notes || '');
    setEditDbType(cli.dbType || 'DBF');
    setEditLeadSource(cli.leadSource || 'Recomendación');
    setEditOccupation(cli.occupation || '');
    setEditInstagram(cli.instagram || '');
    setEditGroupName(cli.groupName || '');
    setEditMonthlyFee(cli.monthlyFee || cli.billingFee || '');

    const currentStatusVal = (cli.status === 'Inactivo' || cli.clientType === 'Inactivo') ? 'Inactivo' : (cli.clientType === 'Potencial' ? 'Prospecto' : 'Activo');
    setEditStatus(currentStatusVal);
    setShowEditModal(true);
  };

  const handleEditClientSubmit = (e) => {
    e.preventDefault();
    if (!editClientName || !editRif) return;

    const isProspect = editStatus === 'Prospecto';
    const isInactive = editStatus === 'Inactivo';
    const targetSection = isInactive ? 'Inactivo' : (isProspect ? 'Potencial' : 'Normal');

    const updates = {
      commercialName: editClientName,
      businessName: editBusinessName,
      rif: editRif,
      address: editAddress,
      phone: editPhone,
      email: editEmail,
      contactPerson: editContact,
      notes: editNotes,
      groupName: editGroupName,
      monthlyFee: editMonthlyFee,
      clientType: isProspect ? 'Potencial' : 'Normal',
      status: isInactive ? 'Inactivo' : 'Activo',
    };

    if (isProspect || (activeClient && activeClient.clientType === 'Potencial')) {
      updates.leadSource = editLeadSource;
      updates.occupation = editOccupation;
      updates.instagram = editInstagram;
    }
    if (!isProspect) {
      updates.serviceType = editServiceType;
      updates.contractStart = editContractStart;
      updates.dbType = editDbType;
    }

    updateClient(editClientId, updates);
    setClientSection(targetSection);
    setSelectedClient(prev => prev ? { ...prev, ...updates } : null);
    setShowEditModal(false);
    triggerToast(`Ficha del cliente "${editClientName}" actualizada`);
  };

  // Add Server to Current Client
  const handleAddServer = (e) => {
    e.preventDefault();
    if (!newSrvName || !newSrvIp) return;

    const newSrv = {
      id: `srv-${Date.now()}`,
      name: newSrvName,
      ip: newSrvIp,
      type: newSrvType,
      version: newSrvVersion,
      anydesk: newSrvAnydesk,
      status: 'Activo'
    };

    const currentServers = activeClient.infrastructure?.servers || [];
    const updatedInfra = {
      ...(activeClient.infrastructure || { servers: [], vpn: { ip: '', type: '', user: '' } }),
      servers: [...currentServers, newSrv]
    };

    updateClientTechnical(
      activeClient.id, 
      updatedInfra, 
      activeClient.credentials,
      activeClient.files || [],
      activeClient.layout || [],
      'Infraestructura Servidor',
      `Agregó servidor "${newSrvName}" (${newSrvIp}) al cliente "${activeClient.commercialName}"`
    );

    setNewSrvName('');
    setNewSrvIp('');
    setNewSrvType('');
    setNewSrvVersion('');
    setNewSrvAnydesk('');
    setShowAddServerModal(false);
    
    setSelectedClient({ ...activeClient, infrastructure: updatedInfra });
  };

  // Open Edit Server Modal
  const handleOpenEditServer = (srv) => {
    setEditingServer(srv);
    setEditSrvName(srv.name || '');
    setEditSrvIp(srv.ip || '');
    setEditSrvType(srv.type || '');
    setEditSrvVersion(srv.version || '');
    setEditSrvAnydesk(srv.anydesk || '');
    setEditSrvStatus(srv.status || 'Activo');
    setShowEditServerModal(true);
  };

  // Submit Edit Server
  const handleEditServerSubmit = (e) => {
    e.preventDefault();
    if (!editingServer || !editSrvName || !editSrvIp) return;

    const updatedServers = (activeClient.infrastructure?.servers || []).map(srv => {
      if (srv.id === editingServer.id) {
        return {
          ...srv,
          name: editSrvName,
          ip: editSrvIp,
          type: editSrvType,
          version: editSrvVersion,
          anydesk: editSrvAnydesk,
          status: editSrvStatus
        };
      }
      return srv;
    });

    const updatedInfra = {
      ...(activeClient.infrastructure || { servers: [], vpn: { ip: '', type: '', user: '' } }),
      servers: updatedServers
    };

    updateClientTechnical(
      activeClient.id,
      updatedInfra,
      activeClient.credentials,
      activeClient.files || [],
      activeClient.layout || [],
      'Modificación Servidor',
      `Modificó servidor "${editSrvName}" (${editSrvIp}) del cliente "${activeClient.commercialName}"`
    );

    setShowEditServerModal(false);
    setEditingServer(null);
    setSelectedClient({ ...activeClient, infrastructure: updatedInfra });
  };

  // Delete Server
  const handleDeleteServer = (srvId, srvName) => {
    if (!window.confirm(`¿Está seguro que desea eliminar el servidor "${srvName}"?`)) return;

    const updatedServers = (activeClient.infrastructure?.servers || []).filter(srv => srv.id !== srvId);
    const updatedInfra = {
      ...(activeClient.infrastructure || { servers: [], vpn: { ip: '', type: '', user: '' } }),
      servers: updatedServers
    };

    updateClientTechnical(
      activeClient.id,
      updatedInfra,
      activeClient.credentials,
      activeClient.files || [],
      activeClient.layout || [],
      'Eliminación Servidor',
      `Eliminó servidor "${srvName}" del cliente "${activeClient.commercialName}"`
    );

    setSelectedClient({ ...activeClient, infrastructure: updatedInfra });
  };

  // Add Workstation to Current Client
  const handleAddWorkstation = async (e) => {
    e.preventDefault();
    if (!newWkName) return;

    const cipherWkPass = newWkPass ? await encryptData(newWkPass) : '';
    const cipherWkAnydeskPass = newWkAnydeskPass ? await encryptData(newWkAnydeskPass) : '';

    const newWk = {
      id: `wk-${Date.now()}`,
      name: newWkName,
      username: newWkUser,
      password: cipherWkPass,
      anydesk: newWkAnydesk,
      anydeskPassword: cipherWkAnydeskPass,
      details: newWkDetails,
      fiscalPrinter: newWkFiscalPrinter,
      status: 'Activo'
    };

    const currentWorkstations = activeClient.infrastructure?.workstations || [];
    const updatedInfra = {
      ...(activeClient.infrastructure || { servers: [], vpn: { ip: '', type: '', user: '' } }),
      workstations: [...currentWorkstations, newWk]
    };

    updateClientTechnical(
      activeClient.id, 
      updatedInfra, 
      activeClient.credentials,
      activeClient.files || [],
      activeClient.layout || [],
      'Infraestructura Puesto de Trabajo',
      `Agregó puesto de trabajo "${newWkName}" al cliente "${activeClient.commercialName}"`
    );

    setNewWkName('');
    setNewWkUser('');
    setNewWkPass('');
    setNewWkAnydesk('');
    setNewWkAnydeskPass('');
    setNewWkDetails('');
    setNewWkFiscalPrinter('');
    setShowAddWorkstationModal(false);
    
    setSelectedClient({ ...activeClient, infrastructure: updatedInfra });
  };

  // Open Edit Workstation Modal (Decrypting passwords first)
  const handleOpenEditWorkstation = async (wk) => {
    setEditWkId(wk.id);
    setEditWkName(wk.name || '');
    setEditWkUser(wk.username || '');
    setEditWkDetails(wk.details || '');
    setEditWkFiscalPrinter(wk.fiscalPrinter || '');
    setEditWkAnydesk(wk.anydesk || '');
    
    let decryptedPass = '';
    if (wk.password) {
      decryptedPass = await decryptData(wk.password);
    }
    setEditWkPass(decryptedPass);

    let decryptedAnydeskPass = '';
    if (wk.anydeskPassword) {
      decryptedAnydeskPass = await decryptData(wk.anydeskPassword);
    }
    setEditWkAnydeskPass(decryptedAnydeskPass);

    setShowEditWorkstationModal(true);
  };

  // Edit Workstation
  const handleEditWorkstation = async (e) => {
    e.preventDefault();
    if (!editWkName) return;

    const cipherWkPass = editWkPass ? await encryptData(editWkPass) : '';
    const cipherWkAnydeskPass = editWkAnydeskPass ? await encryptData(editWkAnydeskPass) : '';

    const currentWorkstations = activeClient.infrastructure?.workstations || [];
    const updatedWorkstations = currentWorkstations.map(w => {
      if (w.id === editWkId) {
        return {
          ...w,
          name: editWkName,
          username: editWkUser,
          password: cipherWkPass,
          anydesk: editWkAnydesk,
          anydeskPassword: cipherWkAnydeskPass,
          details: editWkDetails,
          fiscalPrinter: editWkFiscalPrinter
        };
      }
      return w;
    });

    const updatedInfra = {
      ...(activeClient.infrastructure || {}),
      workstations: updatedWorkstations
    };

    updateClientTechnical(
      activeClient.id,
      updatedInfra,
      activeClient.credentials,
      activeClient.files || [],
      activeClient.layout || [],
      'Editar Puesto de Trabajo',
      `Modificó puesto de trabajo "${editWkName}" para el cliente "${activeClient.commercialName}"`
    );

    setShowEditWorkstationModal(false);
    setSelectedClient({ ...activeClient, infrastructure: updatedInfra });
  };

  // Export Workstations Report for current client
  const handleExportWorkstations = () => {
    const workstations = activeClient.infrastructure?.workstations || [];
    if (workstations.length === 0) {
      triggerToast('No hay puestos de trabajo para exportar');
      return;
    }
    const header = "Puesto de Trabajo,Usuario OS,ID AnyDesk,Impresora Fiscal,Detalles\r\n";
    const rows = workstations.map(w => 
      `"${w.name}","${w.username || ''}","${w.anydesk || ''}","${w.fiscalPrinter || ''}","${w.details ? w.details.replace(/"/g, '""') : ''}"`
    ).join('\r\n');
    const blob = new Blob(["\ufeff" + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `puestos_trabajo_${activeClient.commercialName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Reporte de puestos descargado');
  };

  // Delete Workstation from Current Client
  const handleDeleteWorkstation = (wkId, wkName) => {
    if (!window.confirm(`¿Está seguro de eliminar el puesto de trabajo "${wkName}"?`)) return;

    const currentWorkstations = activeClient.infrastructure?.workstations || [];
    const updatedWorkstations = currentWorkstations.filter(w => w.id !== wkId);
    const updatedInfra = {
      ...(activeClient.infrastructure || {}),
      workstations: updatedWorkstations
    };

    updateClientTechnical(
      activeClient.id,
      updatedInfra,
      activeClient.credentials,
      activeClient.files || [],
      activeClient.layout || [],
      'Eliminar Puesto de Trabajo',
      `Eliminó puesto de trabajo "${wkName}" del cliente "${activeClient.commercialName}"`
    );

    setSelectedClient({ ...activeClient, infrastructure: updatedInfra });
  };

  // Reveal Workstation secret (password or anydesk password)
  const handleRevealWkSecret = async (wkId, field, cipherText) => {
    const key = `${wkId}-${field}`;
    if (revealedWkSecrets[key]) {
      const updated = { ...revealedWkSecrets };
      delete updated[key];
      setRevealedWkSecrets(updated);
      return;
    }

    setLoadingWkSecrets(prev => ({ ...prev, [key]: true }));
    const plainText = await decryptData(cipherText);
    
    setRevealedWkSecrets(prev => ({ ...prev, [key]: plainText }));
    setLoadingWkSecrets(prev => ({ ...prev, [key]: false }));

    logActivity(
      'Infraestructura Puesto de Trabajo', 
      `Consultó ${field === 'password' ? 'clave de usuario' : 'clave de AnyDesk'} del puesto de trabajo para el cliente "${activeClient.commercialName}"`
    );
  };

  // Add Credential to Current Client Library (Encrypting it)
  const handleAddCredential = async (e) => {
    e.preventDefault();
    if (!newCredLabel || !newCredPass) return;

    const cipherText = await encryptData(newCredPass);

    const newCred = {
      id: `c-${Date.now()}`,
      label: newCredLabel,
      username: newCredUser,
      password: cipherText
    };

    const currentCreds = activeClient.credentials || [];
    const updatedCreds = [...currentCreds, newCred];

    updateClientTechnical(
      activeClient.id, 
      activeClient.infrastructure, 
      updatedCreds,
      activeClient.files || [],
      activeClient.layout || [],
      'Librería de Credenciales',
      `Registró nueva credencial segura "${newCredLabel}" para el cliente "${activeClient.commercialName}"`
    );

    setNewCredLabel('');
    setNewCredUser('');
    setNewCredPass('');
    setShowAddCredModal(false);

    setSelectedClient({ ...activeClient, credentials: updatedCreds });
  };

  // Edit Credential
  const handleEditCredential = async (e) => {
    e.preventDefault();
    if (!editCredLabel || !activeClient) return;

    let cipherText = activeClient.credentials.find(c => c.id === editCredId)?.password;
    if (editCredPass) {
      cipherText = await encryptData(editCredPass);
    }

    const updatedCreds = activeClient.credentials.map(c => 
      c.id === editCredId 
        ? { ...c, label: editCredLabel, username: editCredUser, password: cipherText }
        : c
    );

    updateClientTechnical(
      activeClient.id,
      activeClient.infrastructure,
      updatedCreds,
      activeClient.files || [],
      activeClient.layout || [],
      'Librería de Credenciales',
      `Modificó credencial segura "${editCredLabel}" para el cliente "${activeClient.commercialName}"`
    );

    setEditCredId('');
    setEditCredLabel('');
    setEditCredUser('');
    setEditCredPass('');
    setShowEditCredModal(false);

    setSelectedClient({ ...activeClient, credentials: updatedCreds });
  };

  // Delete Credential
  const handleDeleteCredential = (credId, label) => {
    if (!activeClient) return;
    if (!window.confirm(`¿Está seguro de eliminar la credencial "${label}"?`)) return;

    const updatedCreds = activeClient.credentials.filter(c => c.id !== credId);

    updateClientTechnical(
      activeClient.id,
      activeClient.infrastructure,
      updatedCreds,
      activeClient.files || [],
      activeClient.layout || [],
      'Librería de Credenciales',
      `Eliminó credencial segura "${label}" para el cliente "${activeClient.commercialName}"`
    );

    setSelectedClient({ ...activeClient, credentials: updatedCreds });
  };

  const getWhatsAppLink = (phone, occupation) => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const cleanOccupation = (occupation || '').toLowerCase().trim();
    
    let message = '';
    if (cleanOccupation.includes('ferreteria') || cleanOccupation.includes('ferretería')) {
      message = 'Hola, nos comunicamos de JC Services. Queremos ofrecerle nuestras soluciones integrales de software administrativo y facturación a2 para ferreterías, ideal para controlar inventarios, compras y ventas.';
    } else if (cleanOccupation.includes('farmacia') || cleanOccupation.includes('drogueria') || cleanOccupation.includes('droguería')) {
      message = 'Hola, nos comunicamos de JC Services. Queremos ofrecerle nuestras soluciones de facturación y control de lotes/vencimientos a2 para farmacias, garantizando rapidez y cumplimiento fiscal.';
    } else if (cleanOccupation.includes('supermercado') || cleanOccupation.includes('abasto') || cleanOccupation.includes('tienda') || cleanOccupation.includes('bodega')) {
      message = 'Hola, nos comunicamos de JC Services. Queremos ofrecerle nuestro sistema de puntos de venta a2 para supermercados y abastos, optimizado para alto volumen de transacciones y servidores locales.';
    } else {
      message = 'Hola, nos comunicamos de JC Services. Queremos ofrecerle soluciones en sistemas administrativos a2 y soporte técnico de servidores para impulsar los procesos de su negocio.';
    }
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const getInstagramLink = (handle) => {
    if (!handle) return '';
    const cleanHandle = handle.replace('@', '').trim();
    return `https://instagram.com/${cleanHandle}`;
  };

  const existingGroups = Array.from(new Set((db?.clients || []).map(c => c.groupName).filter(Boolean)));
  const allExistingServers = (db?.clients || []).flatMap(c => {
    if (activeClient && c.id === activeClient.id) return [];
    return (c.infrastructure?.servers || []).map(s => ({
      clientName: c.commercialName,
      clientId: c.id,
      server: s
    }));
  });

  return (
    <div className="page-container clients-workspace" style={{ padding: '0 24px 24px 24px' }}>
      <div className="page-heading"><div><span className="eyebrow">GESTIÓN</span><h1>Clientes e infraestructura</h1><p className="muted">Información comercial, equipos, credenciales y continuidad operativa.</p></div></div>
      {showReportModal && <Modal onClose={() => setShowReportModal(false)} maxWidth="1000px"><div className="modal-header"><h2>Reporte de clientes</h2><p className="muted">{allClients.length} registrados · {activeClientsList.length} activos · {inactiveClientsList.length} inactivos · {potentialClientsList.length} potenciales</p></div><div className="table-wrapper"><table className="data-table"><thead><tr><th>Cliente</th><th>Razón social</th><th>RIF</th><th>Tipo</th><th>Estado</th><th>Teléfono</th></tr></thead><tbody>{allClients.map(c=><tr key={c.id}><td>{c.commercialName}</td><td>{c.businessName}</td><td>{c.rif}</td><td>{c.clientType}</td><td>{c.status}</td><td>{c.phone}</td></tr>)}</tbody></table></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowReportModal(false)}>Cerrar</button><button className="btn btn-primary" onClick={()=>window.print()}>Imprimir reporte</button></div></Modal>}
      
      {/* Top Header Navigation Tabs */}
      <div className="clients-toolbar">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${clientSection === 'Dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setClientSection('Dashboard');
              setSelectedClient(null);
            }}
            style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 500 }}
          >
            Resumen
          </button>
          <button
            type="button"
            className={`btn ${clientSection === 'Normal' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setClientSection('Normal');
              setSelectedClient(null);
              setActiveSubTab('general');
            }}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Activos ({activeClientsList.length})
          </button>
          <button
            type="button"
            className={`btn ${clientSection === 'Inactivo' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setClientSection('Inactivo');
              setSelectedClient(null);
              setActiveSubTab('general');
            }}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Inactivos ({inactiveClientsList.length})
          </button>
          <button
            type="button"
            className={`btn ${clientSection === 'Potencial' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setClientSection('Potencial');
              setSelectedClient(null);
              setActiveSubTab('general');
            }}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Potenciales ({potentialClientsList.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              setIsRefreshing(true);
              const ok = await refreshDatabase();
              setIsRefreshing(false);
              if (ok) {
                triggerToast('Datos de clientes sincronizados y actualizados');
              } else {
                triggerToast('No se pudo actualizar. Comprueba la conexión con el servidor.');
              }
            }}
            style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Sincronizar y actualizar datos desde el servidor"
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>
              ↻
            </span>
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowReportModal(true)}
            style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 500 }}
          >
            Reporte de clientes
          </button>

          {canManage && clientSection !== 'Dashboard' && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              + Nuevo {clientSection === 'Potencial' ? 'Prospecto' : 'Cliente'}
            </button>
          )}
        </div>
      </div>

      {clientSection === 'Dashboard' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            
            {/* Card 1: Total Clientes */}
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
                Total Clientes Registrados
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--text)' }}>
                {allClients.length}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '0.75rem', marginTop: '4px' }}>
                <span style={{ backgroundColor: 'rgba(0, 230, 115, 0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  {activeClientsList.length} Activos
                </span>
                <span style={{ backgroundColor: 'rgba(255, 77, 77, 0.15)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  {inactiveClientsList.length} Inactivos
                </span>
                <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  {potentialClientsList.length} Prospectos
                </span>
              </div>
            </div>

            {/* Card 2: Contratos / Tipos de Servicio */}
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
                Tipos de Servicio y Contratos
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--text)' }}>
                {contractCount} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>con contrato activo</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {hourlyCount} por horas • {eventualCount} eventuales
              </div>
            </div>

            {/* Card 3: Bases de Datos */}
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #eab308', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
                Motores de Base de Datos
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--text)' }}>
                {sqlCount + dbfCount + otherDbCount} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>instalaciones</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                SQL Server: {sqlCount} • DBF: {dbfCount} • Otros: {otherDbCount}
              </div>
            </div>

            {/* Card 4: Equipos */}
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #06b6d4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
                Infraestructura de Equipos
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--text)' }}>
                {totalServersCount + totalWorkstationsCount} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>equipos</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {totalServersCount} Servidores • {totalWorkstationsCount} Puestos de Trabajo
              </div>
            </div>

            {/* Card 5: Movimiento de Clientes */}
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
                Movimiento de Clientes
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 500 }}>Desactivados:</span>
                <span><strong>{deactivatedLastMonth}</strong> (Mes) • <strong>{deactivatedLastYear}</strong> (Año)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--success)', fontWeight: 500 }}>Activados:</span>
                <span><strong>{activatedLastMonth}</strong> (Mes) • <strong>{activatedLastYear}</strong> (Año)</span>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowReportModal(true)} 
                style={{ fontSize: '0.75rem', padding: '4px 8px', marginTop: '4px', textAlign: 'center' }}
              >
                Ver Detalle de Tiempos
              </button>
            </div>

          </div>

          {/* Proyección Financiera y Metas de Crecimiento (+2% y +5%) */}
          {canSeeMoney && (
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    Proyección Financiera y Metas de Ingreso (+2% y +5%)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculado estrictamente desde la fecha de inicio de contrato (Vigentes a la Fecha)</span>
                </div>
                <button className="btn btn-secondary" onClick={() => setShowReportModal(true)} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  Ver Detalle en Reporte
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                {/* Ingresos Esperados Efectivos */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(0, 230, 115, 0.08)', border: '1px solid rgba(0, 230, 115, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Ingresos Mensuales Efectivos
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--success)', marginTop: '4px' }}>
                    $ {expectedMonthlyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {effectiveActiveClientsList.length} clientes con contrato iniciado a la fecha
                  </div>
                </div>

                {/* Ingresos Futuros Contratados (Por Iniciar) */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Ingresos Futuros (Por Iniciar)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 500, color: '#06b6d4', marginTop: '4px' }}>
                    $ {futureCommittedRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {futureClientsList.length > 0 ? `${futureClientsList.length} contrato(s) con fecha inicio futura` : 'Sin contratos futuros pendientes'}
                  </div>
                </div>

                {/* Pérdidas por Inactividad */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pérdidas por Inactivación
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--danger)', marginTop: '4px' }}>
                    $ {lostMonthlyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Fuga de ingresos ({inactiveClientsList.length} clientes inactivos)
                  </div>
                </div>

                {/* Meta +2% */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Meta Crecimiento (+2%)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--primary)', marginTop: '4px' }}>
                    $ {goalRevenue2Percent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Objetivo (+ $ {delta2Percent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </div>
                </div>

                {/* Meta +5% */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Meta Crecimiento (+5%)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 500, color: '#8b5cf6', marginTop: '4px' }}>
                    $ {goalRevenue5Percent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Objetivo (+ $ {delta5Percent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historial de Crecimiento e Ingresos Mensuales (Picos de Crecimiento) */}
          {canSeeMoney && (
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    Historial de Crecimiento Mensual e Identificación de Picos
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vigencia acumulada de contratos por fecha de inicio y métricas MoM</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0, 230, 115, 0.15)', color: 'var(--success)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                    Pico Máximo Crecimiento: +{revenueHistoryData.maxGrowth > 0 ? revenueHistoryData.maxGrowth.toFixed(1) : '0'}%
                  </span>
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                    Crecimiento Acumulado: {revenueHistoryData.accumulatedGrowth >= 0 ? `+${revenueHistoryData.accumulatedGrowth.toFixed(1)}%` : `${revenueHistoryData.accumulatedGrowth.toFixed(1)}%`}
                  </span>
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                    Pico Facturación: $ {revenueHistoryData.maxRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Visual Bar Chart for 12 Months */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '220px', padding: '24px 12px 12px 12px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                {revenueHistoryData.months.map((m, idx) => {
                  const heightPercent = revenueHistoryData.maxRevenue > 0 ? (m.revenue / revenueHistoryData.maxRevenue) * 100 : 0;
                  const isPeak = m.isPeak || m.isRevenuePeak;
                  return (
                    <div key={idx} style={{ flex: 1, minWidth: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                      {/* Badge top */}
                      {m.growthRate !== 0 && (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          color: m.growthRate > 0 ? 'var(--success)' : 'var(--danger)',
                          marginBottom: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          {m.growthRate > 0 ? `+${m.growthRate.toFixed(1)}%` : `${m.growthRate.toFixed(1)}%`}
                        </span>
                      )}

                      {/* Peak Indicator Banner */}
                      {isPeak && (
                        <span style={{
                          position: 'absolute',
                          top: '-10px',
                          fontSize: '0.6rem',
                          fontWeight: 500,
                          backgroundColor: 'var(--primary)',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          boxShadow: 'none',
                          whiteSpace: 'nowrap',
                          zIndex: 2
                        }}>
                          PICO
                        </span>
                      )}

                      {/* Bar Column */}
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '38px',
                          height: `${Math.max(heightPercent, 8)}%`,
                          backgroundColor: isPeak ? 'var(--primary)' : 'rgba(59, 130, 246, 0.4)',
                          borderTop: isPeak ? '3px solid var(--success)' : 'none',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease, background-color 0.3s ease',
                          position: 'relative'
                        }}
                        title={`${m.label}\nMRR: $ ${m.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}\nNuevos Contratos: +$ ${m.newContractRevenue.toLocaleString('es-ES')} (${m.newContractsCount})\nBajas: -$ ${m.lostRevenue.toLocaleString('es-ES')} (${m.lostClientsCount})\nVariación Neta: ${m.netGrowth >= 0 ? '+' : ''}$ ${m.netGrowth.toLocaleString('es-ES')}`}
                      />

                      {/* Month Label */}
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: isPeak ? 'bold' : 'normal', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {m.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Monthly Growth Breakdown Detail Table */}
              <div className="table-wrapper" style={{ marginTop: '8px' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Facturación MRR</th>
                      <th>Crecimiento MoM (%)</th>
                      <th>Nuevos Contratos Ganados</th>
                      <th>Bajas / Inactivaciones</th>
                      <th>Variación Neta ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueHistoryData.months.map((m, idx) => (
                      <tr key={idx} style={{ backgroundColor: (m.isPeak || m.isRevenuePeak) ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                        <td style={{ fontWeight: 500 }}>
                          {m.label}
                          {(m.isPeak || m.isRevenuePeak) && (
                            <span className="badge badge-primary" style={{ marginLeft: '6px', fontSize: '0.6rem', padding: '2px 6px' }}>
                              {m.isPeak ? 'Pico Crecimiento' : 'Pico Facturación'}
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                          $ {m.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontWeight: 500, color: m.growthRate > 0 ? 'var(--success)' : (m.growthRate < 0 ? 'var(--danger)' : 'var(--text-muted)') }}>
                          {idx === 0 ? 'Base' : (m.growthRate > 0 ? `+${m.growthRate.toFixed(1)}%` : `${m.growthRate.toFixed(1)}%`)}
                        </td>
                        <td style={{ color: m.newContractRevenue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {m.newContractRevenue > 0 ? `+$ ${m.newContractRevenue.toLocaleString('es-ES')} (${m.newContractsCount})` : '—'}
                        </td>
                        <td style={{ color: m.lostRevenue > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {m.lostRevenue > 0 ? `-$ ${m.lostRevenue.toLocaleString('es-ES')} (${m.lostClientsCount})` : '—'}
                        </td>
                        <td style={{ fontWeight: 500, color: m.netGrowth > 0 ? 'var(--success)' : (m.netGrowth < 0 ? 'var(--danger)' : 'var(--text-muted)') }}>
                          {m.netGrowth > 0 ? `+$ ${m.netGrowth.toLocaleString('es-ES')}` : (m.netGrowth < 0 ? `-$ ${Math.abs(m.netGrowth).toLocaleString('es-ES')}` : '$ 0.00')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Donut Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            
            {/* Donut 1: Estado General de Clientes */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Estado General de Clientes
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gráfico de Pastel</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                  <svg width="180" height="180" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--border)" strokeWidth="4.5" />
                    {(() => {
                      const total = allClients.length || 1;
                      const pAct = (activeClientsList.length / total) * 100;
                      const pIna = (inactiveClientsList.length / total) * 100;
                      const pPot = (potentialClientsList.length / total) * 100;

                      const strokeDashAct = `${pAct} ${100 - pAct}`;
                      const strokeDashIna = `${pIna} ${100 - pIna}`;
                      const strokeDashPot = `${pPot} ${100 - pPot}`;

                      const offsetAct = 25;
                      const offsetIna = 25 - pAct;
                      const offsetPot = 25 - pAct - pIna;

                      return (
                        <>
                          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#00e673" strokeWidth="5" strokeDasharray={strokeDashAct} strokeDashoffset={offsetAct} />
                          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ff4d4d" strokeWidth="5" strokeDasharray={strokeDashIna} strokeDashoffset={offsetIna} />
                          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#3b82f6" strokeWidth="5" strokeDasharray={strokeDashPot} strokeDashoffset={offsetPot} />
                        </>
                      );
                    })()}
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
                      {allClients.length}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                      Clientes
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '160px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00e673', display: 'inline-block' }}></span>
                      <span>Activos</span>
                    </div>
                    <strong style={{ fontSize: '0.875rem' }}>{activeClientsList.length} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({Math.round((activeClientsList.length / (allClients.length || 1)) * 100)}%)</span></strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff4d4d', display: 'inline-block' }}></span>
                      <span>Inactivos</span>
                    </div>
                    <strong style={{ fontSize: '0.875rem' }}>{inactiveClientsList.length} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({Math.round((inactiveClientsList.length / (allClients.length || 1)) * 100)}%)</span></strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span>
                      <span>Potenciales</span>
                    </div>
                    <strong style={{ fontSize: '0.875rem' }}>{potentialClientsList.length} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({Math.round((potentialClientsList.length / (allClients.length || 1)) * 100)}%)</span></strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Donut 2: Motores de Base de Datos */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Motores de Base de Datos
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gráfico de Pastel</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                  <svg width="180" height="180" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--border)" strokeWidth="4.5" />
                    {(() => {
                      const total = (sqlCount + dbfCount + otherDbCount) || 1;
                      const pSql = (sqlCount / total) * 100;
                      const pDbf = (dbfCount / total) * 100;
                      const pOth = (otherDbCount / total) * 100;

                      const strokeDashSql = `${pSql} ${100 - pSql}`;
                      const strokeDashDbf = `${pDbf} ${100 - pDbf}`;
                      const strokeDashOth = `${pOth} ${100 - pOth}`;

                      const offsetSql = 25;
                      const offsetDbf = 25 - pSql;
                      const offsetOth = 25 - pSql - pDbf;

                      return (
                        <>
                          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#00c853" strokeWidth="5" strokeDasharray={strokeDashSql} strokeDashoffset={offsetSql} />
                          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ff9100" strokeWidth="5" strokeDasharray={strokeDashDbf} strokeDashoffset={offsetDbf} />
                          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#7c4dff" strokeWidth="5" strokeDasharray={strokeDashOth} strokeDashoffset={offsetOth} />
                        </>
                      );
                    })()}
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
                      {sqlCount + dbfCount + otherDbCount}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                      Bases DB
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '160px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00c853', display: 'inline-block' }}></span>
                      <span>SQL Server</span>
                    </div>
                    <strong style={{ fontSize: '0.875rem' }}>{sqlCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({Math.round((sqlCount / ((sqlCount + dbfCount + otherDbCount) || 1)) * 100)}%)</span></strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff9100', display: 'inline-block' }}></span>
                      <span>DBF (Archivos)</span>
                    </div>
                    <strong style={{ fontSize: '0.875rem' }}>{dbfCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({Math.round((dbfCount / ((sqlCount + dbfCount + otherDbCount) || 1)) * 100)}%)</span></strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#7c4dff', display: 'inline-block' }}></span>
                      <span>Otros / MySQL</span>
                    </div>
                    <strong style={{ fontSize: '0.875rem' }}>{otherDbCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({Math.round((otherDbCount / ((sqlCount + dbfCount + otherDbCount) || 1)) * 100)}%)</span></strong>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Bar Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            
            {/* Bar Chart 1: Distribución por Tipo de Servicio */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Clientes por Tipo de Servicio / Contrato
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gráfico de Barras</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
                {serviceTypeBreakdown.map((item, idx) => {
                  const maxVal = Math.max(...serviceTypeBreakdown.map(s => s.count)) || 1;
                  const pct = Math.round((item.count / maxVal) * 100);
                  const totalPct = Math.round((item.count / (allClients.length || 1)) * 100);

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 500 }}>
                        <span>{item.label}</span>
                        <span>{item.count} cliente{item.count === 1 ? '' : 's'} ({totalPct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '14px', backgroundColor: 'var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: item.color,
                            borderRadius: '7px',
                            transition: 'width 0.5s ease-in-out'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bar Chart 2: Top Clientes por Equipos */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Top Clientes por Equipos Registrados
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Servidores + Puestos</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
                {topInfraClients.map((cli, idx) => {
                  const maxEquip = topInfraClients[0]?.totalEquip || 1;
                  const pct = Math.round((cli.totalEquip / maxEquip) * 100);

                  return (
                    <div
                      key={cli.id}
                      onClick={() => {
                        setClientSection(cli.status === 'Inactivo' ? 'Inactivo' : (cli.clientType === 'Potencial' ? 'Potencial' : 'Normal'));
                        setSelectedClient(cli);
                      }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                          {idx + 1}. {cli.commercialName} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({cli.groupName || 'Individual'})</span>
                        </span>
                        <span style={{ fontWeight: 500, color: 'var(--primary)' }}>
                          {cli.totalEquip} equipo{cli.totalEquip === 1 ? '' : 's'} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({cli.serversCount} srv / {cli.workstationsCount} wk)</span>
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '14px', backgroundColor: 'var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'var(--card-hover)',
                            borderRadius: '7px',
                            transition: 'width 0.5s ease-in-out'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Grupos Empresariales y Acciones Rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Resumen por Grupos Empresariales */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Resumen por Grupos Empresariales
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {clientGroupsSummary.map((grp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--primary-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                      Grupo: {grp.name}
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                      {grp.count} Sucursal{grp.count === 1 ? '' : 'es'}
                    </span>
                  </div>
                ))}
                {clientGroupsSummary.length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No hay grupos empresariales registrados.</span>
                )}
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Acciones Rápidas
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setClientSection('Normal')}
                  style={{ padding: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  Ver Activos ({activeClientsList.length})
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setClientSection('Inactivo')}
                  style={{ padding: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  Ver Inactivos ({inactiveClientsList.length})
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setClientSection('Potencial')}
                  style={{ padding: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  Ver Prospectos ({potentialClientsList.length})
                </button>

                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setClientSection('Normal');
                      setShowAddModal(true);
                    }}
                    style={{ padding: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    + Nuevo Cliente
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="clients-directory" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', marginTop: '12px' }}>
          {/* Left Side: Client List Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {clientSection === 'Inactivo' ? 'Lista de Clientes Inactivos' : clientSection === 'Potencial' ? 'Lista de Prospectos' : 'Lista de Clientes Activos'}
              </div>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Buscar cliente o RIF... (Presione Enter)"
                  className="form-input"
                  value={localSearch}
                  onChange={(e) => {
                    setLocalSearch(e.target.value);
                    if (e.target.value === '') {
                      setSearchQuery('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchQuery(localSearch);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', minWidth: 'auto' }}
                  onClick={() => setSearchQuery(localSearch)}
                >
                  Buscar
                </button>
              </div>
            </div>

          <div className="client-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '65vh', overflowY: 'auto' }}>
            {(() => {
              const groups = {};
              const individuals = [];
              
              filteredClients.forEach(cli => {
                if (cli.groupName && cli.groupName.trim() !== '') {
                  const g = cli.groupName.trim();
                  if (!groups[g]) groups[g] = [];
                  groups[g].push(cli);
                } else {
                  individuals.push(cli);
                }
              });

              return (
                <>
                  {/* Grouped Clients */}
                  {Object.keys(groups).sort().map(grpName => (
                    <div key={grpName} style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '2px solid var(--primary)', paddingLeft: '8px', marginLeft: '2px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Grupo: {grpName}
                      </div>
                      {groups[grpName].map(cli => (
                        <div
                          key={cli.id}
                          onClick={() => {
                            setSelectedClient(cli);
                            setRevealedCreds({});
                          }}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: activeClient && activeClient.id === cli.id ? 'var(--primary-glow)' : 'var(--card)',
                            border: `1px solid ${activeClient && activeClient.id === cli.id ? 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          {clientSection === 'Potencial' ? (
                            cli.occupation && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{cli.occupation}</div>
                            )
                          ) : (
                            cli.serviceType && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{cli.serviceType}</div>
                            )
                          )}
                          <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text)' }}>
                            {cli.commercialName} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Sucursal)</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RIF: {cli.rif}</div>
                          {clientSection === 'Inactivo' && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>
                              Inactivo hace: {formatDurationFromNow(getClientDeactivatedDate(cli))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Individual Clients */}
                  {individuals.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.keys(groups).length > 0 && (
                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '6px', marginBottom: '2px' }}>
                          Clientes Individuales
                        </div>
                      )}
                      {individuals.map(cli => (
                        <div
                          key={cli.id}
                          onClick={() => {
                            setSelectedClient(cli);
                            setRevealedCreds({});
                          }}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: activeClient && activeClient.id === cli.id ? 'var(--primary-glow)' : 'var(--card)',
                            border: `1px solid ${activeClient && activeClient.id === cli.id ? 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          {clientSection === 'Potencial' ? (
                            cli.occupation && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{cli.occupation}</div>
                            )
                          ) : (
                            cli.serviceType && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{cli.serviceType}</div>
                            )
                          )}
                          <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text)' }}>{cli.commercialName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RIF: {cli.rif}</div>
                          {clientSection === 'Inactivo' && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>
                              Inactivo hace: {formatDurationFromNow(getClientDeactivatedDate(cli))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredClients.length === 0 && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                      No se encontraron {clientSection === 'Potencial' ? 'prospectos' : 'clientes'}.
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Right Side: Detailed Customer Profile Sheet */}
        {activeClient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header info */}
            <div className="card client-profile-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge" style={{
                  marginBottom: '6px',
                  backgroundColor: (activeClient.status === 'Inactivo' || activeClient.clientType === 'Inactivo') ? 'rgba(255, 77, 77, 0.2)' : (activeClient.clientType === 'Potencial' ? 'var(--primary)' : 'rgba(0, 230, 115, 0.2)'),
                  color: (activeClient.status === 'Inactivo' || activeClient.clientType === 'Inactivo') ? 'var(--danger)' : (activeClient.clientType === 'Potencial' ? '#fff' : 'var(--success)'),
                  fontWeight: 500
                }}>
                  {(activeClient.status === 'Inactivo' || activeClient.clientType === 'Inactivo') ? 'Cliente Inactivo' : (activeClient.clientType === 'Potencial' ? 'Prospecto / Potencial' : `Cliente Activo`)}
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {activeClient.commercialName}
                  {activeClient.groupName && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                      Grupo: {activeClient.groupName}
                    </span>
                  )}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{activeClient.businessName}</p>
                {(activeClient.status === 'Inactivo' || activeClient.clientType === 'Inactivo') && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 500, marginTop: '4px' }}>
                    Desactivado el: {getClientDeactivatedDate(activeClient) ? getClientDeactivatedDate(activeClient).toLocaleDateString('es-ES') : 'Fecha no registrada'} (Hace: {formatDurationFromNow(getClientDeactivatedDate(activeClient))})
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', fontSize: '0.8125rem' }}>
                  <div><strong>RIF:</strong> {activeClient.rif}</div>
                  <div><strong>Contacto:</strong> {activeClient.contactPerson}</div>
                  {activeClient.clientType === 'Potencial' && activeClient.occupation && (
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      Rubro: <strong style={{ color: 'var(--primary)', textTransform: 'capitalize' }}>{activeClient.occupation}</strong>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                  {canManage && (
                    <>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleOpenEdit(activeClient)}
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Editar Ficha
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Estado:</span>
                        <select
                          className="form-select"
                          value={
                            (activeClient.status === 'Inactivo' || activeClient.clientType === 'Inactivo') ? 'Inactivo' :
                            activeClient.clientType === 'Potencial' ? 'Prospecto' : 'Activo'
                          }
                          onChange={(e) => handleChangeClientStatus(activeClient, e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 500, cursor: 'pointer', height: '30px', borderColor: 'var(--primary)' }}
                        >
                          <option value="Activo">Activo</option>
                          <option value="Inactivo">Inactivo</option>
                          <option value="Prospecto">Prospecto</option>
                        </select>
                      </div>
                    </>
                  )}
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => window.print()}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    Reporte PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Friendly Vertical Nav Bar & Interactive Quick Chips */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Ventana Técnica del Cliente</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Último Respaldo: <strong style={{ color: 'var(--success)' }}>{activeClient.lastBackupTime || '31/07/2026 14:15'}</strong> • IP VPN: <code style={{ color: 'var(--primary)' }}>{activeClient.infrastructure?.vpn?.ip || '26.186.172.165'}</code>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select
                    className="form-select"
                    value={activeSubTab}
                    onChange={(e) => {
                      setActiveSubTab(e.target.value);
                      setRevealedCreds({});
                    }}
                    style={{
                      fontWeight: 500,
                      color: 'var(--primary)',
                      borderColor: 'var(--primary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      padding: '6px 12px',
                      maxWidth: '280px'
                    }}
                  >
                    <option value="all">Ver Todo (Modo Acordeón Vertical)</option>
                    <option value="general">Ficha e Información General</option>
                    {activeClient.clientType !== 'Potencial' && (
                      <>
                        <option value="servers">Servidores & VPN ({activeClient.infrastructure?.servers?.length || 0})</option>
                        <option value="workstations">Directorio de Puestos ({activeClient.infrastructure?.workstations?.length || 0})</option>
                        <option value="credentials">Bóveda de Credenciales ({activeClient.credentials?.length || 0})</option>
                        <option value="layout">Plano de Red 2D/3D ({activeClient.layout?.length || 0})</option>
                        <option value="files">Documentos y Archivos ({activeClient.files?.length || 0})</option>
                        <option value="visitas">Reportes de Visita y Calendario</option>
                        <option value="backups">Respaldos (A:\Jce\Jc-Backups)</option>
                      </>
                    )}
                    <option value="followUps">Bitácora de Seguimiento ({activeClient.followUps?.length || 0})</option>
                  </select>

                  <button
                    type="button"
                    className={`btn ${activeSubTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveSubTab(activeSubTab === 'all' ? 'general' : 'all')}
                    style={{ fontSize: '0.75rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  >
                    {activeSubTab === 'all' ? 'Vista Única' : 'Desplegar Todo'}
                  </button>
                </div>
              </div>

              {/* Quick Navigation Chips */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingTop: '4px' }}>
                {[
                  { id: 'general', label: 'General' },
                  ...(activeClient.clientType !== 'Potencial' ? [
                    { id: 'servers', label: `Servidores (${activeClient.infrastructure?.servers?.length || 0})` },
                    { id: 'workstations', label: `Puestos (${activeClient.infrastructure?.workstations?.length || 0})` },
                    { id: 'credentials', label: `Credenciales (${activeClient.credentials?.length || 0})` },
                    { id: 'layout', label: 'Plano 2D/3D' },
                    { id: 'files', label: `Archivos (${activeClient.files?.length || 0})` },
                    { id: 'visitas', label: 'Visitas' },
                    { id: 'backups', label: 'Respaldos' },
                  ] : []),
                  { id: 'followUps', label: `Seguimiento (${activeClient.followUps?.length || 0})` }
                ].map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(chip.id);
                      setRevealedCreds({});
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: activeSubTab === chip.id ? 'bold' : '500',
                      border: '1px solid',
                      borderColor: activeSubTab === chip.id ? 'var(--primary)' : 'var(--border)',
                      backgroundColor: activeSubTab === chip.id ? 'rgba(15, 98, 254, 0.15)' : 'var(--background)',
                      color: activeSubTab === chip.id ? 'var(--primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtab Content: General */}
            {activeSubTab === 'general' && activeClient.clientType === 'Potencial' && (
              <div className="grid-cols-2">
                <div className="card">
                  <h3 style={{ fontSize: '0.9375rem', marginBottom: '12px' }}>Datos del Prospecto</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Persona de Contacto:</span> <strong>{activeClient.contactPerson || 'Sin contacto'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Empresa / Razón Social:</span> <strong>{activeClient.businessName || 'Sin razón social'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Teléfono:</span> <strong>{activeClient.phone || 'Sin número'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Origen del Lead:</span> <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{activeClient.leadSource || 'Recomendación'}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Rubro / Ocupación:</span> <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{activeClient.occupation || 'Otro'}</span></div>
                    
                    {activeClient.instagram && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Instagram:</span>{' '}
                        <a 
                          href={getInstagramLink(activeClient.instagram)} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: 'hsl(330, 80%, 60%)', fontWeight: 500, textDecoration: 'none' }}
                        >
                          {activeClient.instagram}
                        </a>
                      </div>
                    )}

                    {activeClient.notes && (
                      <div style={{ marginTop: '6px', padding: '8px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Nota: {activeClient.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '2.5rem' }}> Contáctalo en WhatsApp</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px', margin: 0 }}>
                    Presione el botón para abrir un chat de WhatsApp con un mensaje personalizado pre-redactado según su ocupación ({activeClient.occupation || 'General'}).
                  </p>
                  {activeClient.phone ? (
                    <a
                      href={getWhatsAppLink(activeClient.phone, activeClient.occupation)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ 
                        padding: '10px 20px', 
                        fontSize: '0.8125rem', 
                        backgroundColor: '#25D366', 
                        borderColor: '#25D366',
                        color: '#fff',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <span> Enviar Mensaje a WhatsApp</span>
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Requiere ingresar un número de teléfono</span>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'general' && activeClient.clientType !== 'Potencial' && (
              <div className="grid-cols-2">
                <div className="card">
                  <h3 style={{ fontSize: '0.9375rem', marginBottom: '12px' }}>Datos Generales</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Dirección:</span> {activeClient.address}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Teléfonos:</span> {activeClient.phone}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {activeClient.email}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Representante:</span> {activeClient.contactPerson}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Base de Datos (a2):</span> <span style={{ color: 'var(--info)', fontWeight: 600 }}>{activeClient.dbType || 'DBF'}</span></div>
                    {activeClient.serviceType && <div><span style={{ color: 'var(--text-muted)' }}>Tipo de Servicio:</span> <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{activeClient.serviceType}</span></div>}
                    {activeClient.contractStart && <div><span style={{ color: 'var(--text-muted)' }}>Inicio de Contrato:</span> {activeClient.contractStart}</div>}
                    {(activeClient.monthlyFee || activeClient.billingFee) && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Cuota de Cobro / Honorarios:</span>{' '}
                        <strong style={{ color: 'var(--success)', fontWeight: 500 }}>
                          {typeof activeClient.monthlyFee === 'number'
                            ? `$ ${activeClient.monthlyFee.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
                            : String(activeClient.monthlyFee || activeClient.billingFee).startsWith('$') ? (activeClient.monthlyFee || activeClient.billingFee) : `$ ${activeClient.monthlyFee || activeClient.billingFee}`
                          }
                        </strong>
                      </div>
                    )}

                    {activeClient.notes && <div style={{ marginTop: '6px', padding: '8px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>📌 {activeClient.notes}</div>}
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '3rem', marginBottom: '12px' }}>🏢</span>
                  <h4 style={{ color: 'var(--text)', marginBottom: '4px' }}>Ficha Unificada</h4>
                  <p style={{ fontSize: '0.75rem', maxWidth: '280px' }}>
                    Use las pestañas superiores para ver servidores activos, credenciales cifradas y documentos.
                  </p>
                </div>
              </div>
            )}

            {/* Subtab Content: Servers & VPN */}
            {activeSubTab === 'servers' && (
              <>
                <div className="card">
                  <h3 style={{ fontSize: '0.9375rem', marginBottom: '12px' }}>Acceso Remoto (VPN)</h3>
                  {activeClient.infrastructure.vpn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Dirección IP/Gateway:</span> {activeClient.infrastructure.vpn.ip}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Tipo de VPN:</span> {activeClient.infrastructure.vpn.type}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Usuario Asignado:</span> {activeClient.infrastructure.vpn.user}</div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No configurado</span>
                  )}
                </div>

                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>
                      Servidores e Infraestructura Crítica
                    </h3>
                    <button className="btn btn-secondary" onClick={() => setShowAddServerModal(true)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                      + Agregar Servidor
                    </button>
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                       <thead>
                        <tr>
                          <th>Nombre Servidor</th>
                          <th>Dirección IP</th>
                          <th>Tipo / Rol</th>
                          <th>SO / Versión</th>
                          <th>AnyDesk</th>
                          <th>Estado</th>
                          {canManage && <th style={{ textAlign: 'center' }}>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {activeClient.infrastructure.servers && activeClient.infrastructure.servers.map((srv, idx) => (
                          <tr key={srv.id || idx}>
                            <td style={{ fontWeight: 500 }}>{srv.name}</td>
                            <td style={{ fontFamily: 'monospace' }}>{srv.ip}</td>
                            <td>{srv.type}</td>
                            <td>{srv.version}</td>
                            <td style={{ fontWeight: '500' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {srv.anydesk ? (
                                  <>
                                    <a 
                                      href={`anydesk://${srv.anydesk.replace(/\s+/g, '')}`} 
                                      style={{ color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      title="Conectarse y copiar ID de AnyDesk"
                                      onClick={() => copyToClipboard(srv.anydesk, 'ID de AnyDesk copiado y abriendo AnyDesk...')}
                                    >
                                      ⚡ {srv.anydesk}
                                    </a>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                      onClick={() => copyToClipboard(srv.anydesk, 'ID de AnyDesk copiado')}
                                      title="Copiar ID de AnyDesk"
                                    >
                                      📋
                                    </button>
                                  </>
                                ) : (
                                  'N/A'
                                )}
                              </div>
                            </td>
                            <td><span className="badge badge-success">{srv.status}</span></td>
                            {canManage && (
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto', cursor: 'pointer' }}
                                    onClick={() => handleOpenEditServer(srv)}
                                    title="Editar servidor"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto', backgroundColor: 'hsla(0,84%,60%,0.1)', color: 'var(--danger)', border: '1px solid hsla(0,84%,60%,0.3)', cursor: 'pointer' }}
                                    onClick={() => handleDeleteServer(srv.id, srv.name)}
                                    title="Eliminar servidor"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}

                        {(!activeClient.infrastructure.servers || activeClient.infrastructure.servers.length === 0) && (
                          <tr>
                            <td colSpan={canManage ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay servidores registrados.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="backup-callout" style={{marginTop:20}}>
                    <div><span className="eyebrow">CONTINUIDAD OPERATIVA</span><h2>Respaldos del cliente</h2><p>Consulta la conexión, las ejecuciones y la integridad de las copias.</p></div>
                    <button className="btn btn-primary" onClick={() => setActiveSubTab('backups')}>Gestionar respaldos →</button>
                  </div>
                </div>
              </>
            )}

            {/* Subtab Content: Workstations */}
            {activeSubTab === 'workstations' && (
              <>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                      Directorio de Puestos de Trabajo
                    </h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-secondary" onClick={handleExportWorkstations} style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                         Exportar CSV
                      </button>
                      <button className="btn btn-primary" onClick={() => setShowAddWorkstationModal(true)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                        + Agregar Puesto
                      </button>
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                       <thead>
                        <tr>
                          <th>Nombre del Puesto</th>
                          <th>Usuario OS</th>
                          <th>Clave de Acceso</th>
                          <th>ID AnyDesk</th>
                          <th>Clave AnyDesk</th>
                          <th>Impresora Fiscal</th>
                          <th>Detalles</th>
                          {canManage && <th style={{ textAlign: 'center' }}>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {activeClient.infrastructure?.workstations && activeClient.infrastructure.workstations.map((wk, idx) => {
                          const userPassKey = `${wk.id}-password`;
                          const anydeskPassKey = `${wk.id}-anydeskPassword`;
                          return (
                            <tr key={wk.id || idx}>
                              <td style={{ fontWeight: 500 }}>{wk.name}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{wk.username || 'N/A'}</span>
                                  {wk.username && (
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                      onClick={() => copyToClipboard(wk.username, 'Usuario copiado')}
                                      title="Copiar usuario"
                                    >
                                      📋
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontFamily: 'monospace' }}>
                                    {loadingWkSecrets[userPassKey] ? (
                                      'Cargando...'
                                    ) : revealedWkSecrets[userPassKey] ? (
                                      revealedWkSecrets[userPassKey]
                                    ) : (
                                      '••••••••'
                                    )}
                                  </span>
                                  {wk.password && (
                                    <>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                        onClick={() => handleRevealWkSecret(wk.id, 'password', wk.password)}
                                        title={revealedWkSecrets[userPassKey] ? "Ocultar clave" : "Revelar clave"}
                                      >
                                        {revealedWkSecrets[userPassKey] ? '👁️‍🗨️' : '👁️'}
                                      </button>
                                      {revealedWkSecrets[userPassKey] && (
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                          onClick={() => copyToClipboard(revealedWkSecrets[userPassKey], 'Clave copiada')}
                                          title="Copiar clave"
                                        >
                                          📋
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td style={{ fontWeight: '500' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {wk.anydesk ? (
                                    <>
                                      <a 
                                        href={`anydesk://${wk.anydesk.replace(/\s+/g, '')}`} 
                                        style={{ color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        title="Conectarse y copiar ID de AnyDesk"
                                        onClick={() => copyToClipboard(wk.anydesk, 'ID de AnyDesk copiado y abriendo AnyDesk...')}
                                      >
                                        ⚡ {wk.anydesk}
                                      </a>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                        onClick={() => copyToClipboard(wk.anydesk, 'ID de AnyDesk copiado')}
                                        title="Copiar ID de AnyDesk"
                                      >
                                        📋
                                      </button>
                                    </>
                                  ) : (
                                    'N/A'
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontFamily: 'monospace' }}>
                                    {loadingWkSecrets[anydeskPassKey] ? (
                                      'Cargando...'
                                    ) : revealedWkSecrets[anydeskPassKey] ? (
                                      revealedWkSecrets[anydeskPassKey]
                                    ) : (
                                      '••••••••'
                                    )}
                                  </span>
                                  {wk.anydeskPassword && (
                                    <>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                        onClick={() => handleRevealWkSecret(wk.id, 'anydeskPassword', wk.anydeskPassword)}
                                        title={revealedWkSecrets[anydeskPassKey] ? "Ocultar clave AnyDesk" : "Revelar clave AnyDesk"}
                                      >
                                        {revealedWkSecrets[anydeskPassKey] ? '👁️‍🗨️' : '👁️'}
                                      </button>
                                      {revealedWkSecrets[anydeskPassKey] && (
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                          onClick={() => copyToClipboard(revealedWkSecrets[anydeskPassKey], 'Clave de AnyDesk copiada')}
                                          title="Copiar clave de AnyDesk"
                                        >
                                          📋
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td>{wk.fiscalPrinter || '—'}</td>
                              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{wk.details || '—'}</td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto', cursor: 'pointer' }}
                                      onClick={() => handleOpenEditWorkstation(wk)}
                                      title="Editar puesto de trabajo"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      className="btn"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto', backgroundColor: 'hsla(0,84%,60%,0.1)', color: 'var(--danger)', border: '1px solid hsla(0,84%,60%,0.3)', cursor: 'pointer' }}
                                      onClick={() => handleDeleteWorkstation(wk.id, wk.name)}
                                      title="Eliminar puesto de trabajo"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {(!activeClient.infrastructure?.workstations || activeClient.infrastructure.workstations.length === 0) && (
                          <tr>
                            <td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay puestos de trabajo registrados.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Subtab Content: Credentials */}
            {activeSubTab === 'credentials' && (
              <div className="card" style={{ border: '1px solid hsla(var(--danger-h), var(--danger-s), var(--danger-l), 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     Librería de Credenciales Cifradas (AES-256)
                  </h3>
                  <button className="btn btn-danger" onClick={() => setShowAddCredModal(true)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    + Nueva Credencial
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeClient.credentials && activeClient.credentials.map(cred => (
                    <div
                      key={cred.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{cred.label}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usuario: {cred.username}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="vault-secret-container" style={{ minWidth: '180px' }}>
                          <span className="vault-secret-text">
                            {loadingCreds[cred.id] ? (
                              'Descifrando...'
                            ) : revealedCreds[cred.id] ? (
                              revealedCreds[cred.id]
                            ) : (
                              '••••••••••••••••'
                            )}
                          </span>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                          onClick={() => handleRevealCredential(cred)}
                          disabled={loadingCreds[cred.id]}
                        >
                          {revealedCreds[cred.id] ? 'Ocultar' : 'Revelar'}
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem', minWidth: 'auto' }}
                              onClick={async () => {
                                setEditCredId(cred.id);
                                setEditCredLabel(cred.label);
                                setEditCredUser(cred.username || '');
                                const plainText = await decryptData(cred.password);
                                setEditCredPass(plainText);
                                setShowEditCredModal(true);
                              }}
                              title="Editar credencial"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: '6px 10px', fontSize: '0.75rem', minWidth: 'auto', backgroundColor: 'hsla(0,84%,60%,0.1)', color: 'var(--danger)', border: '1px solid hsla(0,84%,60%,0.3)' }}
                              onClick={() => handleDeleteCredential(cred.id, cred.label)}
                              title="Eliminar credencial"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!activeClient.credentials || activeClient.credentials.length === 0) && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay credenciales guardadas.</span>
                  )}
                </div>
              </div>
            )}

            {/* Subtab Content: Files Manager */}
            {activeSubTab === 'files' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     Expediente de Documentos del Cliente
                  </h3>
                  <button className="btn btn-primary" onClick={() => setShowAddFileModal(true)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    + Agregar Documento
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(!activeClient.files || activeClient.files.length === 0) ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                      No hay documentos cargados. Presione "Agregar Documento" para registrar manuales, contratos o reportes.
                    </span>
                  ) : (
                    activeClient.files.map(file => (
                      <div key={file.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* File Card Row */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '1.75rem', flexShrink: 0 }}>
                              {file.name.toLowerCase().endsWith('.pdf') ? '📕' : 
                               file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md') ? '📝' :
                               file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg') ? '🖼️' : '📄'}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.description || 'Sin descripción.'}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Tipo: {file.type} | Tamaño: {file.size} | Subido: {file.uploadDate}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                            <button 
                              type="button"
                              onClick={() => {
                                setInlinePreviewFileId(inlinePreviewFileId === file.id ? null : file.id);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', color: inlinePreviewFileId === file.id ? 'var(--primary)' : 'var(--text)' }}
                            >
                              {inlinePreviewFileId === file.id ? 'Contraer' : '👁️ Previsualizar'}
                            </button>
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: 'hsla(0,84%,60%,0.1)', color: 'var(--danger)', border: '1px solid hsla(0,84%,60%,0.3)' }}
                              onClick={() => handleDeleteFile(file.id, file.name)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Inline Preview Box */}
                        {inlinePreviewFileId === file.id && (
                          <div style={{
                            padding: '16px',
                            backgroundColor: 'var(--card-hover)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            animation: 'fadeInPage 0.2s ease'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.8125rem', color: 'var(--primary)' }}>Vista previa inline</strong>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto' }}
                                onClick={() => setInlinePreviewFileId(null)}
                              >
                                Ocultar
                              </button>
                            </div>

                            <div style={{
                              width: '100%',
                              minHeight: '200px',
                              maxHeight: '380px',
                              overflow: 'auto',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#000000',
                              border: '1px dashed var(--border)',
                              borderRadius: 'var(--radius-xs)',
                              padding: '10px'
                            }}>
                              {file.dataUrl ? (
                                file.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.name) ? (
                                  <img 
                                    src={file.dataUrl} 
                                    alt={file.name} 
                                    style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain' }} 
                                  />
                                ) : file.dataUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(file.name) ? (
                                  <object
                                    data={file.dataUrl}
                                    type="application/pdf"
                                    width="100%"
                                    height="320px"
                                  >
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Visualización directa de PDF no disponible.</p>
                                      <a href={file.dataUrl} download={file.name} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>Descargar PDF</a>
                                    </div>
                                  </object>
                                ) : file.dataUrl.startsWith('data:text/') || /\.txt$/i.test(file.name) ? (
                                  <pre style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', textAlign: 'left', margin: 0 }}>
                                    {decodeURIComponent(escape(atob(file.dataUrl.split(',')[1] || '')))}
                                  </pre>
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Previsualización no disponible para este formato.</p>
                                    <a href={file.dataUrl} download={file.name} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>Descargar Archivo</a>
                                  </div>
                                )
                              ) : (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin contenido para previsualizar (solo metadatos).</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Subtab Content: Layout / Plano 2D/3D */}
            {activeSubTab === 'layout' && (
              <Layouts embeddedClientId={activeClient.id} isEmbedded={true} />
            )}

            {activeSubTab === 'followUps' && (
              <div className="card">
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   Bitácora de Seguimiento
                </h3>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFollowUpComment.trim()) return;
                  addClientFollowUp(activeClient.id, newFollowUpComment.trim());
                  setNewFollowUpComment('');
                  setTimeout(() => {
                    const updatedClient = db.clients.find(c => c.id === activeClient.id);
                    setSelectedClient(updatedClient);
                  }, 100);
                }} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Escriba una nueva nota de seguimiento..."
                    value={newFollowUpComment}
                    onChange={(e) => setNewFollowUpComment(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    + Registrar Nota
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px', borderLeft: '2px solid var(--border)' }}>
                  {(!activeClient.followUps || activeClient.followUps.length === 0) ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                      No hay notas de seguimiento registradas para este cliente.
                    </span>
                  ) : (
                    [...activeClient.followUps].reverse().map(note => (
                      <div key={note.id} style={{ position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: '-27px',
                          top: '4px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          border: '2px solid var(--card)'
                        }} />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <strong>{note.user}</strong>
                          <span>•</span>
                          <span>{note.date}</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', lineHeight: '1.4', margin: 0, color: 'var(--text)' }}>
                          {note.comment}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {(activeSubTab === 'all' || activeSubTab === 'visitas') && activeClient.clientType !== 'Potencial' && (
              <ClientVisitsCalendar
                activeClient={activeClient}
                db={db}
                currentUser={currentUser}
                setActiveTab={setActiveTab}
                setPendingTicket={setPendingTicket}
                copyToClipboard={copyToClipboard}
              />
            )}

            {(activeSubTab === 'all' || activeSubTab === 'backups') && activeClient.clientType !== 'Potencial' && (
              <ClientBackupsManager
                activeClient={activeClient}
                copyToClipboard={copyToClipboard}
              />
            )}
          </div>
        )}
      </div>
      )}

      {/* ================= MODAL: ADD CLIENT ================= */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} maxWidth="560px">
          <div className="modal-header">
            <h3 style={{ fontWeight: 600 }}>+ Agregar Nuevo {clientSection === 'Potencial' ? 'Prospecto' : 'Cliente'}</h3>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleAddClientSubmit}>
            <div className="modal-body" style={{ gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nombre / Razón Comercial *</label>
                  <input type="text" className="form-input" required placeholder="Ej: TecnoCorp C.A." value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Razón Social Legal / Empresa</label>
                  <input type="text" className="form-input" placeholder="Ej: Tecnología Corp. TecnoCorp, C.A." value={newBusinessName} onChange={e => setNewBusinessName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">RIF / Identificación *</label>
                  <input type="text" className="form-input" placeholder="J-00000000-0" required value={newRif} onChange={e => setNewRif(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Grupo / Corporación (Opcional)</label>
                  <input
                    type="text"
                    list="group-names-add"
                    className="form-input"
                    placeholder="Ej: Grupo Epa"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                  />
                  <datalist id="group-names-add">
                    {existingGroups.map(grp => (
                      <option key={grp} value={grp} />
                    ))}
                  </datalist>
                </div>
                
                {clientSection === 'Potencial' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Rubro / Ocupación *</label>
                      <input type="text" className="form-input" placeholder="Ej: Ferretería, Farmacia, Supermercado" required value={newOccupation} onChange={e => setNewOccupation(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Instagram (ej. @mi_negocio)</label>
                      <input type="text" className="form-input" placeholder="@empresa" value={newInstagram} onChange={e => setNewInstagram(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Origen del Prospecto</label>
                      <select className="form-select" value={newLeadSource} onChange={e => setNewLeadSource(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', padding: '0 10px' }}>
                        <option value="Recomendación">Recomendación</option>
                        <option value="Redes Sociales">Redes Sociales</option>
                        <option value="Volantes / Publicidad">Volantes / Publicidad</option>
                        <option value="Sitio Web">Sitio Web</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Tipo de Base de Datos</label>
                      <select className="form-select" value={newDbType} onChange={e => setNewDbType(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', padding: '0 10px' }}>
                        <option value="DBF">DBF (a2 Estándar)</option>
                        <option value="SQL">SQL (SQL Server)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo de Servicio</label>
                      <input type="text" className="form-input" placeholder="Ej: Soporte Técnico & Cloud" value={newServiceType} onChange={e => setNewServiceType(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Inicio de Contrato</label>
                      <input type="date" className="form-input" value={newContractStart} onChange={e => setNewContractStart(e.target.value)} />
                    </div>
                    {canSeeMoney && (
                      <div className="form-group">
                        <label className="form-label">Cuota de Cobro / Honorarios ($)</label>
                        <input type="text" className="form-input" placeholder="Ej: $ 150.00 / mes" value={newMonthlyFee} onChange={e => setNewMonthlyFee(e.target.value)} />
                      </div>
                    )}
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Estado del Cliente</label>
                  <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', padding: '0 10px' }}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Prospecto">Prospecto</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Persona de Contacto</label>
                  <input type="text" className="form-input" placeholder="Ing. / Lic. Nombre" value={newContact} onChange={e => setNewContact(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono *</label>
                  <input type="text" className="form-input" placeholder="+58 212 000 0000" required value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Correo Electrónico</label>
                  <input type="email" className="form-input" placeholder="contacto@empresa.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Dirección</label>
                  <input type="text" className="form-input" placeholder="Av. Principal, Edif., Ciudad" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notas Internas</label>
                  <textarea className="form-input" rows={3} placeholder="Observaciones, condiciones especiales, etc." value={newNotes} onChange={e => setNewNotes(e.target.value)} style={{ resize: 'vertical', minHeight: '70px' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Ficha</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: EDIT CLIENT ================= */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)} maxWidth="560px">
          <div className="modal-header">
            <h3 style={{ fontWeight: 600 }}>Editar Ficha de Cliente</h3>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleEditClientSubmit}>
            <div className="modal-body" style={{ gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nombre / Razón Comercial *</label>
                  <input type="text" className="form-input" required placeholder="Ej: TecnoCorp C.A." value={editClientName} onChange={e => setEditClientName(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Razón Social Legal / Empresa</label>
                  <input type="text" className="form-input" placeholder="Ej: Tecnología Corp. TecnoCorp, C.A." value={editBusinessName} onChange={e => setEditBusinessName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">RIF / Identificación *</label>
                  <input type="text" className="form-input" placeholder="J-00000000-0" required value={editRif} onChange={e => setEditRif(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Grupo / Corporación (Opcional)</label>
                  <input
                    type="text"
                    list="group-names-edit"
                    className="form-input"
                    placeholder="Ej: Grupo Epa"
                    value={editGroupName}
                    onChange={e => setEditGroupName(e.target.value)}
                  />
                  <datalist id="group-names-edit">
                    {existingGroups.map(grp => (
                      <option key={grp} value={grp} />
                    ))}
                  </datalist>
                </div>
                
                {activeClient.clientType === 'Potencial' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Rubro / Ocupación *</label>
                      <input type="text" className="form-input" placeholder="Ej: Ferretería, Farmacia, Supermercado" required value={editOccupation} onChange={e => setEditOccupation(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Instagram (ej. @mi_negocio)</label>
                      <input type="text" className="form-input" placeholder="@empresa" value={editInstagram} onChange={e => setEditInstagram(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Origen del Prospecto</label>
                      <select className="form-select" value={editLeadSource} onChange={e => setEditLeadSource(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', padding: '0 10px' }}>
                        <option value="Recomendación">Recomendación</option>
                        <option value="Redes Sociales">Redes Sociales</option>
                        <option value="Volantes / Publicidad">Volantes / Publicidad</option>
                        <option value="Sitio Web">Sitio Web</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Tipo de Base de Datos</label>
                      <select className="form-select" value={editDbType} onChange={e => setEditDbType(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', padding: '0 10px' }}>
                        <option value="DBF">DBF (a2 Estándar)</option>
                        <option value="SQL">SQL (SQL Server)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo de Servicio</label>
                      <input type="text" className="form-input" placeholder="Ej: Soporte Técnico & Cloud" value={editServiceType} onChange={e => setEditServiceType(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Inicio de Contrato</label>
                      <input type="date" className="form-input" value={editContractStart} onChange={e => setEditContractStart(e.target.value)} />
                    </div>
                    {canSeeMoney && (
                      <div className="form-group">
                        <label className="form-label">Cuota de Cobro / Honorarios ($)</label>
                        <input type="text" className="form-input" placeholder="Ej: $ 150.00 / mes" value={editMonthlyFee} onChange={e => setEditMonthlyFee(e.target.value)} />
                      </div>
                    )}
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Estado del Cliente</label>
                  <select className="form-select" value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', padding: '0 10px' }}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Prospecto">Prospecto</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Persona de Contacto</label>
                  <input type="text" className="form-input" placeholder="Ing. / Lic. Nombre" value={editContact} onChange={e => setEditContact(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono *</label>
                  <input type="text" className="form-input" placeholder="+58 212 000 0000" required value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Correo Electrónico</label>
                  <input type="email" className="form-input" placeholder="contacto@empresa.com" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Dirección</label>
                  <input type="text" className="form-input" placeholder="Av. Principal, Edif., Ciudad" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notas Internas</label>
                  <textarea className="form-input" rows={3} placeholder="Observaciones, condiciones especiales, etc." value={editNotes} onChange={e => setEditNotes(e.target.value)} style={{ resize: 'vertical', minHeight: '70px' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ADD SERVER ================= */}
      {showAddServerModal && (
        <Modal onClose={() => setShowAddServerModal(false)}>
          <div className="modal-header">
            <h3>Agregar Servidor</h3>
            <button className="btn btn-secondary" onClick={() => setShowAddServerModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleAddServer}>
            <div className="modal-body">
              {allExistingServers.length > 0 && (
                <div className="form-group" style={{ marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <label className="form-label">Asociar Servidor Existente de la Red</label>
                  <select
                    className="form-select"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const [cId, sIp] = val.split('|');
                      const foundClient = db.clients.find(c => c.id === cId);
                      const foundSrv = foundClient?.infrastructure?.servers?.find(s => s.ip === sIp);
                      if (foundSrv) {
                        setNewSrvName(foundSrv.name || '');
                        setNewSrvIp(foundSrv.ip || '');
                        setNewSrvType(foundSrv.type || '');
                        setNewSrvVersion(foundSrv.version || '');
                        setNewSrvAnydesk(foundSrv.anydesk || '');
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">-- Seleccionar servidor registrado para copiar datos --</option>
                    {allExistingServers.map((item, idx) => (
                      <option key={idx} value={`${item.clientId}|${item.server.ip}`}>
                        {item.clientName} - {item.server.name} ({item.server.ip})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nombre del Servidor</label>
                <input type="text" placeholder="ej. srv-app-01" className="form-input" required value={newSrvName} onChange={e => setNewSrvName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección IP</label>
                <input type="text" placeholder="ej. 192.168.1.50" className="form-input" required value={newSrvIp} onChange={e => setNewSrvIp(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo / Rol del Servidor</label>
                <input type="text" placeholder="ej. Servidor Web Nginx" className="form-input" value={newSrvType} onChange={e => setNewSrvType(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">SO / Versión</label>
                <input type="text" placeholder="ej. Ubuntu Linux 22.04" className="form-input" value={newSrvVersion} onChange={e => setNewSrvVersion(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">ID AnyDesk (Soporte)</label>
                <input type="text" placeholder="ej. 123 456 789" className="form-input" value={newSrvAnydesk} onChange={e => setNewSrvAnydesk(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddServerModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Registrar Servidor</button>
            </div>

          </form>
        </Modal>
      )}

      {/* ================= MODAL: EDIT SERVER ================= */}
      {showEditServerModal && (
        <Modal onClose={() => { setShowEditServerModal(false); setEditingServer(null); }}>
          <div className="modal-header">
            <h3>Editar Servidor</h3>
            <button className="btn btn-secondary" onClick={() => { setShowEditServerModal(false); setEditingServer(null); }} style={{ padding: '6px 12px', minWidth: 'auto', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          <form onSubmit={handleEditServerSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre del Servidor</label>
                <input type="text" placeholder="ej. srv-app-01" className="form-input" required value={editSrvName} onChange={e => setEditSrvName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección IP</label>
                <input type="text" placeholder="ej. 192.168.1.50" className="form-input" required value={editSrvIp} onChange={e => setEditSrvIp(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo / Rol del Servidor</label>
                <input type="text" placeholder="ej. Servidor Web Nginx" className="form-input" value={editSrvType} onChange={e => setEditSrvType(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">SO / Versión</label>
                <input type="text" placeholder="ej. Ubuntu Linux 22.04" className="form-input" value={editSrvVersion} onChange={e => setEditSrvVersion(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">ID AnyDesk (Soporte)</label>
                <input type="text" placeholder="ej. 123 456 789" className="form-input" value={editSrvAnydesk} onChange={e => setEditSrvAnydesk(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-select" value={editSrvStatus} onChange={e => setEditSrvStatus(e.target.value)}>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowEditServerModal(false); setEditingServer(null); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ADD WORKSTATION ================= */}
      {showAddWorkstationModal && (
        <Modal onClose={() => setShowAddWorkstationModal(false)}>
          <div className="modal-header">
            <h3>Agregar Puesto de Trabajo</h3>
            <button className="btn btn-secondary" onClick={() => setShowAddWorkstationModal(false)} style={{ padding: '6px 12px', minWidth: 'auto', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          <form onSubmit={handleAddWorkstation}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre del Puesto</label>
                <input type="text" placeholder="ej. Recepción / Caja 1" className="form-input" required value={newWkName} onChange={e => setNewWkName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Usuario OS</label>
                <input type="text" placeholder="ej. Administrador" className="form-input" value={newWkUser} onChange={e => setNewWkUser(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Clave de Usuario</label>
                <input type="password" placeholder="ej. 123456" className="form-input" value={newWkPass} onChange={e => setNewWkPass(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">ID AnyDesk (Soporte)</label>
                <input type="text" placeholder="ej. 123 456 789" className="form-input" value={newWkAnydesk} onChange={e => setNewWkAnydesk(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Clave de AnyDesk</label>
                <input type="password" placeholder="ej. abc123def" className="form-input" value={newWkAnydeskPass} onChange={e => setNewWkAnydeskPass(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo Impresora Fiscal (Opcional)</label>
                <input type="text" placeholder="ej. Bixolon SRP-350 / HKA" className="form-input" value={newWkFiscalPrinter} onChange={e => setNewWkFiscalPrinter(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Detalles / Observaciones</label>
                <textarea placeholder="ej. Ubicado en el mostrador principal, conectado al switch A." className="form-input" rows={2} value={newWkDetails} onChange={e => setNewWkDetails(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddWorkstationModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Registrar Puesto</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: EDIT WORKSTATION ================= */}
      {showEditWorkstationModal && (
        <Modal onClose={() => setShowEditWorkstationModal(false)}>
          <div className="modal-header">
            <h3>Editar Puesto de Trabajo</h3>
            <button className="btn btn-secondary" onClick={() => setShowEditWorkstationModal(false)} style={{ padding: '6px 12px', minWidth: 'auto', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          <form onSubmit={handleEditWorkstation}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre del Puesto</label>
                <input type="text" placeholder="ej. Recepción / Caja 1" className="form-input" required value={editWkName} onChange={e => setEditWkName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Usuario OS</label>
                <input type="text" placeholder="ej. Administrador" className="form-input" value={editWkUser} onChange={e => setEditWkUser(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Clave de Usuario</label>
                <input type="text" placeholder="ej. 123456" className="form-input" value={editWkPass} onChange={e => setEditWkPass(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">ID AnyDesk (Soporte)</label>
                <input type="text" placeholder="ej. 123 456 789" className="form-input" value={editWkAnydesk} onChange={e => setEditWkAnydesk(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Clave de AnyDesk</label>
                <input type="text" placeholder="ej. abc123def" className="form-input" value={editWkAnydeskPass} onChange={e => setEditWkAnydeskPass(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo Impresora Fiscal (Opcional)</label>
                <input type="text" placeholder="ej. Bixolon SRP-350 / HKA" className="form-input" value={editWkFiscalPrinter} onChange={e => setEditWkFiscalPrinter(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Detalles / Observaciones</label>
                <textarea placeholder="ej. Ubicado en el mostrador principal, conectado al switch A." className="form-input" rows={2} value={editWkDetails} onChange={e => setEditWkDetails(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditWorkstationModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ADD CREDENTIAL ================= */}
      {showAddCredModal && (
        <Modal onClose={() => setShowAddCredModal(false)}>
          <div className="modal-header">
            <h3>Agregar Credencial a Librería</h3>
            <button className="btn btn-secondary" onClick={() => setShowAddCredModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleAddCredential}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Etiqueta / Rol</label>
                <input type="text" placeholder="ej. Base de Datos Postgres" className="form-input" required value={newCredLabel} onChange={e => setNewCredLabel(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input type="text" placeholder="ej. sa_admin" className="form-input" required value={newCredUser} onChange={e => setNewCredUser(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña en Texto Plano (Será cifrada localmente)</label>
                <input type="password" placeholder="••••••••••••" className="form-input" required value={newCredPass} onChange={e => setNewCredPass(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddCredModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-danger">Encriptar y Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ADD FILE ================= */}
      {showAddFileModal && (
        <Modal onClose={() => setShowAddFileModal(false)}>
          <div className="modal-header">
            <h3>Agregar Documento</h3>
            <button className="btn btn-secondary" onClick={() => setShowAddFileModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleAddFileSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Seleccionar Archivo</label>
                <input
                  type="file"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setNewFileName(file.name);
                      setNewFileType(file.type || 'Documento PDF');
                      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
                      setNewFileSize(sizeInMb > 0.1 ? `${sizeInMb} MB` : `${(file.size / 1024).toFixed(2)} KB`);
                      
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setNewFileDataUrl(evt.target.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre del Archivo</label>
                <input type="text" placeholder="ej. Manual de Usuario.pdf" className="form-input" required value={newFileName} onChange={e => setNewFileName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción / Notas</label>
                <input type="text" placeholder="ej. Manual de configuración del switch core" className="form-input" value={newFileDesc} onChange={e => setNewFileDesc(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Tipo de Archivo</label>
                  <input type="text" placeholder="ej. PDF, TXT, Backup" className="form-input" value={newFileType} onChange={e => setNewFileType(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tamaño</label>
                  <input type="text" placeholder="ej. 2.4 MB" className="form-input" value={newFileSize} onChange={e => setNewFileSize(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddFileModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Subir Documento</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: ADD DEVICE TO LAYOUT ================= */}
      {showAddDeviceModal && (
        <Modal onClose={() => { setShowAddDeviceModal(false); setSelectedGridCell(null); }}>
          <div className="modal-header">
            <h3>Agregar Equipo al Plano</h3>
            <button className="btn btn-secondary" onClick={() => { setShowAddDeviceModal(false); setSelectedGridCell(null); }} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleAddDeviceSubmit}>
            <div className="modal-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Ubicación seleccionada: <strong>Cuadrante {['A','B','C','D','E','F'][selectedGridCell?.x - 1]}{selectedGridCell?.y}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Tipo de Equipo</label>
                <select className="form-select" value={newDevType} onChange={e => setNewDevType(e.target.value)}>
                  <option value="Servidor"> Servidor</option>
                  <option value="Router"> Router</option>
                  <option value="Switch"> Switch</option>
                  <option value="Firewall"> Firewall</option>
                  <option value="UPS"> UPS</option>
                  <option value="Antena / AP"> Antena / AP</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre del Equipo</label>
                <input type="text" placeholder="ej. Router Principal" className="form-input" required value={newDevName} onChange={e => setNewDevName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción / Detalles Técnicos</label>
                <textarea placeholder="ej. Router Mikrotik RB4011, IP 192.168.1.1, ubicado en el rack principal." className="form-input" rows={3} value={newDevDesc} onChange={e => setNewDevDesc(e.target.value)} style={{ resize: 'vertical', minHeight: '70px' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAddDeviceModal(false); setSelectedGridCell(null); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Agregar al Plano</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: EDIT CREDENTIAL ================= */}
      {showEditCredModal && (
        <Modal onClose={() => setShowEditCredModal(false)}>
          <div className="modal-header">
            <h3>Editar Credencial</h3>
            <button className="btn btn-secondary" onClick={() => setShowEditCredModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleEditCredential}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Etiqueta / Rol</label>
                <input type="text" placeholder="ej. Base de Datos Postgres" className="form-input" required value={editCredLabel} onChange={e => setEditCredLabel(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input type="text" placeholder="ej. sa_admin" className="form-input" required value={editCredUser} onChange={e => setEditCredUser(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva Contraseña (Dejar vacío para no cambiar)</label>
                <input type="password" placeholder="••••••••••••" className="form-input" value={editCredPass} onChange={e => setEditCredPass(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditCredModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Printable Report Markup */}
      {activeClient && (
        <div className="print-report-container">
          <div className="print-report-header">
            <div>
              <h1 className="print-report-title">Reporte Técnico de Cliente</h1>
              <p style={{ fontSize: '10pt', margin: '4px 0 0 0' }}>JC Enterprise Portal</p>
            </div>
            <div className="print-report-meta">
              <div>Fecha: {new Date().toLocaleDateString()}</div>
              <div>Estado: {activeClient.status}</div>
            </div>
          </div>

          <div className="print-section">
            <h2 className="print-section-title">Datos Generales</h2>
            <div className="print-grid">
              <div className="print-field"><strong>Nombre Comercial:</strong> {activeClient.commercialName}</div>
              <div className="print-field"><strong>Razón Social:</strong> {activeClient.businessName}</div>
              <div className="print-field"><strong>RIF:</strong> {activeClient.rif}</div>
              <div className="print-field"><strong>Contacto:</strong> {activeClient.contactPerson}</div>
              <div className="print-field"><strong>Teléfono:</strong> {activeClient.phone}</div>
              <div className="print-field"><strong>Correo:</strong> {activeClient.email}</div>
              <div className="print-field" style={{ gridColumn: 'span 2' }}><strong>Dirección:</strong> {activeClient.address}</div>
            </div>
          </div>

          {activeClient.clientType !== 'Potencial' && (
            <>
              <div className="print-section">
                <h2 className="print-section-title">Servidores e Infraestructura</h2>
                {!activeClient.infrastructure || !activeClient.infrastructure.servers || activeClient.infrastructure.servers.length === 0 ? (
                  <p style={{ fontSize: '10pt', fontStyle: 'italic' }}>No hay servidores registrados.</p>
                ) : (
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Servidor</th>
                        <th>Dirección IP</th>
                        <th>Sistema Operativo</th>
                        <th>Base de Datos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeClient.infrastructure.servers.map((srv, idx) => (
                        <tr key={idx}>
                          <td>{srv.name}</td>
                          <td>{srv.ip}</td>
                          <td>{srv.os}</td>
                          <td>{srv.dbEngine}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="print-section">
                <h2 className="print-section-title">Plano de Red y Puestos</h2>
                {!activeClient.layout || activeClient.layout.length === 0 ? (
                  <p style={{ fontSize: '10pt', fontStyle: 'italic' }}>No hay equipos registrados en el plano.</p>
                ) : (
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Ubicación</th>
                        <th>Equipo</th>
                        <th>Tipo</th>
                        <th>Inventario</th>
                        <th>Ruta del Cableado</th>
                        <th>Estado del Cableado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeClient.layout.map((dev, idx) => (
                        <tr key={idx}>
                          <td>{['A','B','C','D','E','F','G','H'][dev.x-1]}{dev.y}</td>
                          <td>{dev.name}</td>
                          <td>{dev.type}</td>
                          <td>{dev.inventory || '—'}</td>
                          <td>{dev.cablingPath || '—'}</td>
                          <td>{dev.cablingStatus || 'Directo'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {activeClient.cablingNotes && (
                <div className="print-section">
                  <h2 className="print-section-title">Notas de Cableado de Red</h2>
                  <p style={{ fontSize: '10pt', whiteSpace: 'pre-line', lineHeight: '1.4', padding: '10px', background: '#f9f9f9', border: '1px solid #ddd' }}>
                    {activeClient.cablingNotes}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="print-section">
            <h2 className="print-section-title">Notas de Seguimiento</h2>
            {!activeClient.followUps || activeClient.followUps.length === 0 ? (
              <p style={{ fontSize: '10pt', fontStyle: 'italic' }}>No hay notas de seguimiento.</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Fecha</th>
                    <th style={{ width: '100px' }}>Usuario</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClient.followUps.map((f, idx) => (
                    <tr key={idx}>
                      <td>{f.date}</td>
                      <td>{f.user}</td>
                      <td>{f.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: PREVIEW FILE ================= */}
      {previewFile && (
        <Modal onClose={() => setPreviewFile(null)} maxWidth="700px">
          <div className="modal-header">
            <h3 style={{ fontWeight: 600 }}> Previsualización de Documento</h3>
            <button className="btn btn-secondary" onClick={() => setPreviewFile(null)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '100%' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 4px 0' }}>{previewFile.name}</h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                {previewFile.description || 'Sin descripción adicional.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <span><strong>Tipo:</strong> {previewFile.type}</span>
                <span>•</span>
                <span><strong>Tamaño:</strong> {previewFile.size}</span>
                <span>•</span>
                <span><strong>Subido:</strong> {previewFile.uploadDate}</span>
              </div>
            </div>

            {/* Preview Area */}
            <div style={{
              width: '100%',
              minHeight: '250px',
              maxHeight: '450px',
              backgroundColor: 'var(--background)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              padding: '10px'
            }}>
              {previewFile.dataUrl ? (
                previewFile.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(previewFile.name) ? (
                  <img 
                    src={previewFile.dataUrl} 
                    alt={previewFile.name} 
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: 'var(--radius-xs)' }} 
                  />
                ) : previewFile.dataUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(previewFile.name) ? (
                  <object
                    data={previewFile.dataUrl}
                    type="application/pdf"
                    width="100%"
                    height="400px"
                  >
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <span style={{ fontSize: '3rem' }}>📕</span>
                      <p style={{ fontSize: '0.875rem', margin: '10px 0' }}>El navegador no admite la visualización directa de PDF.</p>
                      <a href={previewFile.dataUrl} download={previewFile.name} className="btn btn-primary">Descargar PDF</a>
                    </div>
                  </object>
                ) : previewFile.dataUrl.startsWith('data:text/') || /\.txt$/i.test(previewFile.name) ? (
                  <pre style={{ width: '100%', fontSize: '0.8125rem', color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', textAlign: 'left', margin: 0 }}>
                    {decodeURIComponent(escape(atob(previewFile.dataUrl.split(',')[1] || '')))}
                  </pre>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <span style={{ fontSize: '3rem' }}>💾</span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '12px 0' }}>
                      Previsualización no disponible para este formato de archivo ({previewFile.type || 'Desconocido'}).
                    </p>
                    <a href={previewFile.dataUrl} download={previewFile.name} className="btn btn-primary">Descargar Archivo</a>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2.5rem' }}>📭</span>
                  <p style={{ fontSize: '0.8125rem', marginTop: '10px' }}>
                    Este archivo solo tiene metadatos registrados (no contiene datos cargados para previsualización).
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer" style={{ gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setPreviewFile(null)}>Cerrar</button>
            {previewFile.dataUrl && (
              <a href={previewFile.dataUrl} download={previewFile.name} className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Descargar
              </a>
            )}
          </div>
        </Modal>
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--success)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 'var(--radius-sm)',
          zIndex: 9999,
          fontWeight: 500,
          boxShadow: 'none',
          animation: 'fadeInPage 0.2s ease'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function ClientVisitsCalendar({ activeClient, db, currentUser, setActiveTab, setPendingTicket, copyToClipboard }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const formatDateStr = (dYear, dMonth, dDay) => {
    const mm = String(dMonth + 1).padStart(2, '0');
    const dd = String(dDay).padStart(2, '0');
    return `${dYear}-${mm}-${dd}`;
  };

  const clientReports = (db.serviceReports || []).filter(rep => rep.clientId === activeClient.id);

  const reportsByDay = clientReports.reduce((acc, rep) => {
    const datePart = rep.createdAt.split(' ')[0];
    if (!acc[datePart]) acc[datePart] = [];
    acc[datePart].push(rep);
    return acc;
  }, {});

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDateStr(null);
  };

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ day: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(year, month, d);
    calendarCells.push({ day: d, dateStr });
  }

  const selectedDayReports = selectedDateStr ? (reportsByDay[selectedDateStr] || []) : [];

  const handleCreateTicketFromReport = (report, imageSrc) => {
    if (setPendingTicket) {
      setPendingTicket({
        clientId: report.clientId,
        title: `Reporte de Servicio - ${report.clientName}`,
        description: `Detalles del trabajo realizado:\n${report.workDetails}`,
        imageUrl: imageSrc
      });
    }
    if (setActiveTab) {
      setActiveTab('tickets');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={handlePrevMonth} style={{ padding: '4px 10px', minWidth: 'auto' }}>◀</button>
          <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 500 }}>
            {monthNames[month]} {year}
          </h3>
          <button type="button" className="btn btn-secondary" onClick={handleNextMonth} style={{ padding: '4px 10px', minWidth: 'auto' }}>▶</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {calendarCells.map((cell, idx) => {
            const hasReports = cell.dateStr && reportsByDay[cell.dateStr]?.length > 0;
            const isSelected = cell.dateStr && selectedDateStr === cell.dateStr;
            const reportsCount = cell.dateStr && reportsByDay[cell.dateStr] ? reportsByDay[cell.dateStr].length : 0;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (cell.dateStr) {
                    setSelectedDateStr(isSelected ? null : cell.dateStr);
                  }
                }}
                style={{
                  height: '45px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected 
                    ? 'rgba(245, 158, 11, 0.15)' 
                    : cell.day 
                      ? 'var(--card)' 
                      : 'transparent',
                  border: isSelected 
                    ? '1px solid var(--warning)' 
                    : cell.day 
                      ? '1px solid var(--border)' 
                      : 'none',
                  borderRadius: 'var(--radius-xs)',
                  cursor: cell.day ? 'pointer' : 'default',
                  position: 'relative',
                  color: cell.day ? 'var(--text)' : 'transparent',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {cell.day && (
                  <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? 'bold' : 'normal' }}>
                    {cell.day}
                  </span>
                )}
                {hasReports && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--warning)',
                    boxShadow: 'none'
                  }} title={`${reportsCount} visita(s) técnica(s)`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: '20px', minHeight: '320px', display: 'flex', flexDirection: 'column' }}>
        {selectedDateStr ? (
          <div>
            <h3 style={{ fontSize: '0.9375rem', color: 'var(--warning)', borderBottom: '1px dashed var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>
               Visitas del {selectedDateStr} ({selectedDayReports.length})
            </h3>
            {selectedDayReports.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedDayReports.map(rep => (
                  <div key={rep.id} style={{ borderLeft: '3px solid var(--warning)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Técnico: <strong>{rep.createdBy}</strong></span>
                      <span>Hora: {rep.createdAt.split(' ')[1]}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'pre-wrap', backgroundColor: 'var(--background)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                      {rep.workDetails}
                    </div>

                    {rep.images && rep.images.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                        {rep.images.map((img, imgIdx) => (
                          <div key={imgIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <img
                              src={img}
                              alt="Report attachment"
                              onClick={() => setLightboxImage(img)}
                              style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleCreateTicketFromReport(rep, img)}
                              style={{ padding: '2px 4px', fontSize: '0.6rem', minWidth: 'auto', borderColor: 'var(--success)', color: 'var(--success)' }}
                            >
                               Ticket
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No se registraron visitas técnicas en esta fecha.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📅</span>
            <h4 style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '4px' }}>Historial de Visitas Técnicas</h4>
            <p style={{ fontSize: '0.75rem', maxWidth: '280px' }}>
              Seleccione un día marcado con un punto naranja en el calendario de la izquierda para ver el detalle de los trabajos realizados.
            </p>

            {clientReports.length > 0 && (
              <div style={{ marginTop: '24px', width: '100%', textAlign: 'left' }}>
                <h5 style={{ fontSize: '0.75rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '8px' }}>
                  Últimos reportes registrados:
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {clientReports.slice(-3).reverse().map(rep => (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedDateStr(rep.createdAt.split(' ')[0])}
                      style={{ fontSize: '0.75rem', padding: '6px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-xs)', cursor: 'pointer', border: '1px solid var(--border)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, color: 'var(--warning)', marginBottom: '2px' }}>
                        <span>{rep.createdAt.split(' ')[0]}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>{rep.createdBy}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {rep.workDetails}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}

function ClientBackupsManager({ activeClient }) {
  return <Backups key={activeClient.id} client={activeClient} />;
}
