/** Shared interface palette; red/amber/green retain their status meanings. */
export default {
 content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
 theme: { extend: {
  colors: {
   gray: {50:'#f2f4f6',100:'#e9ecef',200:'#dfe3e8',300:'#b0b8c1',400:'#6b7684',500:'#5c6775',600:'#4e5968',700:'#333d4b',800:'#252d38',900:'#191f28',950:'#101318'},
   ink: '#191f28',
   brand: {50:'#f0f6ff',100:'#e1edff',200:'#c4daff',300:'#92bcff',400:'#5b9aff',500:'#3182f6',600:'#2563db',700:'#1b50b5',800:'#19438f',900:'#1b3a70',950:'#122547'},
  },
  fontFamily: {sans:['Pretendard','Noto Sans KR','-apple-system','BlinkMacSystemFont','Segoe UI','sans-serif']},
  boxShadow: {sm:'0 1px 3px rgb(25 31 40 / 0.03)',card:'0 2px 12px rgb(25 31 40 / 0.025)'},
 } }, plugins: []
};
