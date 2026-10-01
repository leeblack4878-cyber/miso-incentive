// Owner-provided strategic service list. These services never earn a direct fee.
export const ADDITIONAL_STRATEGIC_SERVICES = Object.freeze([
 {key:'vasBellAiGreeting',label:'벨링모아A + AI보이스링(인사말)',code:'LRZ1003226',point:0.3,rate:0},
 {key:'vasBellAiCharacter',label:'벨링모아A + AI보이스링 캐릭터플러스',code:'LRZ1003228',point:0.5,rate:0},
 {key:'vasVcolorBasic',label:'V컬러링 기본',code:'LRZ0002150',point:0.3,rate:0},
 {key:'vasVprofile',label:'V프로필',code:'LRZ1005368',point:0.3,rate:0},
 {key:'vasCallConvenience',label:'통화편의팩',code:'LRZ1007515',point:0.6,rate:0},
 {key:'vasCallFeatureGuide',label:'통화기능안내',code:'LRZ0002941',point:0.1,rate:0},
]);
const RING_SERVICE_KEYS = new Set(['vasBellMoya','vasBellAiGreeting','vasBellAiCharacter','vasVcolorBasic','vasVcolorMusic','vasVcolorBundle','vasVcolor','vasVprofile']);
export function toggleStrategicService(keys=[],key){
 if(keys.includes(key))return keys.filter(k=>k!==key);
 if(key==='vasNone')return ['vasNone'];
 return [...keys.filter(k=>k!=='vasNone'&&!(RING_SERVICE_KEYS.has(key)&&RING_SERVICE_KEYS.has(k))),key];
}
