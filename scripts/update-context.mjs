import fs from 'node:fs';
const file=new URL('../src/context/AppContext.jsx',import.meta.url);
let s=fs.readFileSync(file,'utf8');
function between(start,end,replacement) {const a=s.indexOf(start),b=s.indexOf(end,a);if(a<0||b<0)throw new Error(start);s=s.slice(0,a)+replacement+'\n\n'+s.slice(b);}
s=s.replace("import { initializeDatabase, saveDatabase } from '../utils/db';", "import { api } from '../utils/api';\nimport { changesBetween, applyChanges } from '../utils/changes';");
between('export const getApiUrl =','export function AppProvider',"export const getApiUrl = endpoint => endpoint;");
s=s.replace("if (t === 'backups') return 'clients';", "if (t === 'backups') return 'backups';");
s=s.replace('  const lastWriteTimeRef = useRef(0);',`  const [saveError, setSaveError] = useState('');
  const dbRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const generationRef = useRef(0);
  const lastWriteTimeRef = useRef(0);`);
between('  // Load database on mount','  // Show splash',`  // Only authenticated server data is loaded; browser storage is not a database.
  useEffect(() => {
    localStorage.removeItem('jc_enterprise_db_data');
    api('/api/auth/session').then(result => {
      const data=sanitizeDb(result.db); dbRef.current=data;setDb(data);
      setCurrentUser(result.user);setIsAuthenticated(true);lastLoadedModifiedRef.current=result.revision;
    }).catch(() => {}).finally(()=>setLoading(false));
  }, []);`);
between('  // Poll database every','  useEffect(() => {\n    document.documentElement',`  useEffect(() => {
    if(!isAuthenticated) return;
    const timer=setInterval(async()=>{
      if(pendingRef.current) return;
      try {const status=await api('/api/db/status');if(status.lastModified!==lastLoadedModifiedRef.current) await refreshDatabase();}
      catch(e) { if(e.status===401) {setIsAuthenticated(false);setCurrentUser(null);setDb(null);dbRef.current=null;} }
    },5000);
    return ()=>clearInterval(timer);
  },[isAuthenticated]);`);
// Existing comment block uses Windows newlines. Normalize first when matching remaining blocks.
s=s.replaceAll('\r\n','\n');
between('  // Security Logger','  const userCanViewFinancials',`  const logActivity = (action, details, userObject=currentUser, dbState=null) => dbState || db;
  const updateDbState = (newDbData, baseline=db) => {
    const changes=changesBetween(baseline || {},newDbData);
    if(!changes.length) return Promise.resolve(true);
    const optimistic=applyChanges(dbRef.current || baseline,changes);
    dbRef.current=optimistic;setDb(optimistic);setSaveError('');pendingRef.current++;
    const generation=generationRef.current;
    const operation=queueRef.current.then(async()=>{
      if(generation!==generationRef.current) return false;
      try {
        const result=await api('/api/db',{method:'PATCH',body:{changes}});
        lastLoadedModifiedRef.current=result.revision;
        if(pendingRef.current===1) {const fresh=sanitizeDb(result.db);dbRef.current=fresh;setDb(fresh);}
        return true;
      } catch(e) {
        generationRef.current++;
        setSaveError(e.message + ' Los cambios no guardados se descartaron; revisa el registro antes de repetir la operación.');
        await refreshDatabase();return false;
      } finally {pendingRef.current--;}
    });
    queueRef.current=operation.catch(()=>false);
    return operation;
  };
  const login = async (username,password) => {
    try {const result=await api('/api/auth/login',{method:'POST',body:{username,password}});const data=sanitizeDb(result.db);dbRef.current=data;setDb(data);setCurrentUser(result.user);setIsAuthenticated(true);lastLoadedModifiedRef.current=result.revision;return {success:true,user:result.user};}
    catch(e) {return {success:false,error:e.message};}
  };
  const logout = async () => {
    await queueRef.current;
    try {await api('/api/auth/logout',{method:'POST',body:{}});} catch {}
    generationRef.current++;dbRef.current=null;setDb(null);setCurrentUser(null);setIsAuthenticated(false);setActiveTab('dashboard');
  };
  const changeUserRole = () => {setSaveError('Para cambiar de cuenta debes cerrar sesión e iniciar con sus credenciales.');};
  const addNotification = (text,recipientId=null) => {
    const current=dbRef.current;if(!current || currentUser?.role==='Cliente') return;
    if((current.notifications||[]).some(n=>n.text===text && n.recipientId===recipientId)) return;
    const item={id:crypto.randomUUID?.() || 'notif-'+Date.now()+'-'+Math.random(),text,recipientId,read:false,time:new Date().toISOString()};
    updateDbState({...current,notifications:[item,...(current.notifications||[])].slice(0,100)},current);
  };`);
between('  const clearNotifications =','  // --- CRUD WRAPPERS ---',`  const clearNotifications = () => {
    const current=dbRef.current;if(!current || !currentUser)return;
    updateDbState({...current,notifications:current.notifications.map(n=>!n.recipientId || n.recipientId===currentUser.id?{...n,read:true}:n)},current);
  };
  const refreshDatabase = async () => {
    try {const response=await fetch('/api/db');if(!response.ok)return false;const data=sanitizeDb(await response.json());lastLoadedModifiedRef.current=Number(response.headers.get('X-Last-Modified'));dbRef.current=data;setDb(data);return true;}catch{return false;}
  };`);
s=s.replace('        db,\n        loading,','        db,\n        saveError,\n        loading,');
fs.writeFileSync(file,s);
