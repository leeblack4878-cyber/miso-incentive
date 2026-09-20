// Capture before login: the authenticated header may mount after the browser event.
let state={prompt:null,installed:false};
const listeners=new Set();
const publish=next=>{state=next;listeners.forEach(fn=>fn(state));};
export const getInstallState=()=>state;
export const subscribeInstall=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
if(typeof window!=='undefined'){
  state.installed=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();publish({prompt:event,installed:false});});
  window.addEventListener('appinstalled',()=>publish({prompt:null,installed:true}));
}
export async function requestAppInstall(){
  const event=state.prompt;
  if(!event)return 'unavailable';
  publish({...state,prompt:null});
  try{await event.prompt();return (await event.userChoice)?.outcome||'dismissed';}
  catch{return 'error';}
}
