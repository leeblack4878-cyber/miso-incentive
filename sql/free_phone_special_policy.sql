-- Fixed special-sale option: preserve sales/KPI data while withholding plan, VAS and insurance incentives.
insert into public.special_sale_policies(title,start_date,end_date,replacement_amount,description,active)
select '무료폰 특가','2026-01-01'::date,'2099-12-31'::date,0,
       '무료폰 행사: 요금제·VAS·보험 인센티브 미지급, 실적·KPI·성과P 인정',true
where not exists (
  select 1 from public.special_sale_policies where title='무료폰 특가'
);
