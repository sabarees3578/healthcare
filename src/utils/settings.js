const KEY='hp_settings_v1'
export function loadSettings(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || { theme:'dark', alarm:'beep' } }catch(e){ return { theme:'dark', alarm:'beep' } }
}
export function saveSettings(s){
  localStorage.setItem(KEY, JSON.stringify(s))
}
