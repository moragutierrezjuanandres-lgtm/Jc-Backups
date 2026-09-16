import fs from 'node:fs';
const file=new URL('../../Jc-Backups/backup_gui.py',import.meta.url);
let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const a=s.indexOf('def get_all_portal_clients()'),b=s.indexOf('class LoginWindow',a);
if(a<0||b<0)throw new Error('GUI auth boundaries not found');
s=s.slice(0,a)+'from portal_bridge import get_all_portal_clients, authenticate_user, send_client_heartbeat, background_client_service\n\n\n'+s.slice(b);
s=s.replace('self.config_data = self.load_config()',"self.config_data = self.load_config()\n        self.config_data['_config_file'] = str(CONFIG_FILE)");
s=s.replace('metrics = {"success": True, "duration_seconds": 12.4, "total_mb": 124.5}', 'metrics = {"success": False, "error": "Motor de respaldo no instalado."}');
const start=s.indexOf('    def save_schedule_and_register_task('),end=s.indexOf('    def build_tab_logs(',start);
s=s.slice(0,start)+`    def save_schedule_and_register_task(self):
        # Central scheduling survives UI closure and uses the same queue/lock as manual jobs.
        webbrowser.open(os.environ.get('JC_PORTAL_URL', self.config_data.get('portal_url', 'http://localhost:5000')).rstrip('/') + '/?tab=backups')
        messagebox.showinfo('Programación centralizada', 'Configure la frecuencia y la hora en Respaldos del portal. Desactive tareas antiguas duplicadas en Windows.')

`+s.slice(end);
// Corporate light palette, including entry foregrounds.
s=s.replaceAll('"#0B132B"','"#f3f5f7"').replaceAll('"#1C2541"','"#ffffff"').replaceAll('"#3A506B"','"#dce1e6"').replaceAll('"#f8fafc"','"#182532"').replaceAll('"#94a3b8"','"#5f6d7a"').replaceAll('"Outfit"','"Segoe UI"').replaceAll('"Inter"','"Segoe UI"');
s=s.replace('self.style.configure("Header.TLabel", font=("Segoe UI", 12, "bold"), foreground="#ffffff")','self.style.configure("Header.TLabel", font=("Segoe UI", 12, "bold"), foreground=self.text_primary)');
s=s.replaceAll('fieldbackground=self.bg_card_alt, foreground="#ffffff", insertcolor="#ffffff"','fieldbackground=self.bg_card_alt, foreground=self.text_primary, insertcolor=self.text_primary');
s=s.replaceAll('fieldbackground=self.bg_card_alt, background=self.bg_card, foreground="#ffffff"','fieldbackground=self.bg_card_alt, background=self.bg_card, foreground=self.text_primary');
s=s.replace('self.style.configure("Action.TButton", background=self.bg_card, foreground="#ffffff"','self.style.configure("Action.TButton", background=self.bg_card, foreground=self.text_primary');
s=s.replace('command=self.save_schedule_and_register_task','command=self.save_schedule_and_register_task').replace('⏰ Programar Tarea Automática en Windows','Programar desde el portal');
s=s.replace('self.draw_clock_progress(100, "COMPLETADO")', 'self.draw_clock_progress(100 if metrics.get("success") else 0, "VERIFICADO" if metrics.get("success") else "FALLIDO")');
fs.writeFileSync(file,s);
