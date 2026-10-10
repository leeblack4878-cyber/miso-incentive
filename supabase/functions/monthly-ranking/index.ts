import {createClient} from 'npm:@supabase/supabase-js@2.55.0';
import {calculateCompanyMonthlyRanking} from './calculator.js';
import {monthlyRankingRequest} from './handler.js';
Deno.serve(req=>monthlyRankingRequest(req,createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),calculateCompanyMonthlyRanking));
