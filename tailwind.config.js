import colors from 'tailwindcss/colors';
/** Shared interface palette; red/amber/green retain their status meanings. */
export default {
 content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
 theme: { extend: {
  colors: {
   gray: colors.slate,
   ink: '#172b3a',
   brand: {50:'#eff9f7',100:'#d5eee8',200:'#abded3',300:'#79c5b6',400:'#44a998',500:'#248c7d',600:'#14796c',700:'#126357',800:'#155046',900:'#153f39',950:'#092722'},
  },
  fontFamily: {sans:['Pretendard','Noto Sans KR','-apple-system','BlinkMacSystemFont','Segoe UI','sans-serif']},
  boxShadow: {sm:'0 2px 6px rgb(23 43 58 / 0.04)',card:'0 4px 20px rgb(23 43 58 / 0.04)'},
 } }, plugins: []
};
