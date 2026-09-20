/** Shared interface palette; red/amber/green retain their status meanings. */
export default {
 content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
 theme: { extend: {
  colors: {
   gray: {50:'#f3f8fc',100:'#e9ecef',200:'#dfe3e8',300:'#b0b8c1',400:'#6b7684',500:'#5c6775',600:'#4e5968',700:'#333d4b',800:'#252d38',900:'#191f28',950:'#101318'},
   ink: '#191f28',
   brand: {50:'#eff8ff',100:'#dff1ff',200:'#bfe4ff',300:'#8dceff',400:'#50aff5',500:'#268beb',600:'#1768cf',700:'#1554a8',800:'#174786',900:'#173c6b',950:'#102744'},
  },
  fontFamily: {sans:['Pretendard','Noto Sans KR','-apple-system','BlinkMacSystemFont','Segoe UI','sans-serif']},
  boxShadow: {sm:'0 1px 3px rgb(25 31 40 / 0.03)',card:'0 2px 12px rgb(25 31 40 / 0.025)'},
 } }, plugins: []
};
