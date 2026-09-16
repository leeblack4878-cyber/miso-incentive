export const feedbackBridge={toast:null,confirm:null};
export function showAppToast(message,{tone='success',title=''}={}){feedbackBridge.toast?.({message,title,tone})}
export function showLegacyAlert(message){
  const text=String(message||'');
  const isError=/실패|오류|못했|입력해주세요|선택해주세요|없어요|할 수 없|권한|마감된/.test(text);
  showAppToast(text,{tone:isError?'error':'info',title:isError?'확인해주세요':'안내'});
}
export function showAppConfirm(options={}){
  if(!feedbackBridge.confirm)return Promise.resolve(window.confirm(options.message||options.title||'계속할까요?'));
  return feedbackBridge.confirm(options);
}

