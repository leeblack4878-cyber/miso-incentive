// Read every sale in the bundle. Database row order is not a primary-sale contract.
// Never turn a failed lookup into an empty form that would erase existing children.
export async function loadHomeBundleChildren(client, userId, sales) {
  const ids=[...new Set((sales||[]).map(s=>s.id).filter(Boolean))];
  if(!userId || !ids.length) throw new Error('HOME_BUNDLE_NOT_FOUND');
  const [tasks,expenses]=await Promise.all([
    client.from('customer_tasks').select('*').eq('user_id',userId)
      .in('source_sale_id',ids).not('status','in','(completed,cancelled)').order('created_at').order('id'),
    client.from('sales_expenses').select('*').is('voided_at',null).eq('user_id',userId)
      .in('source_sale_id',ids).order('created_at').order('id'),
  ]);
  if(tasks.error) throw tasks.error;
  if(expenses.error) throw expenses.error;
  return {tasks:tasks.data||[],expenses:expenses.data||[]};
}
