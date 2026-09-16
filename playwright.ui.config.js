import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/ui',workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:4182',viewport:{width:390,height:844},timezoneId:'Asia/Seoul',serviceWorkers:'block'},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4182 --strictPort',url:'http://127.0.0.1:4182',reuseExistingServer:false,
   env:{VITE_SUPABASE_URL:'https://placeholder.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'ui-test-only'}},
});
