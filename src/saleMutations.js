// Keep the established reversal amounts; persistence is handled by one RPC.
export function dayAfterSaleDeletion(base, sale, free = {}) {
  const meta = sale.source_meta || {};
  if (meta.teamOnly) return null;
  const next = structuredClone(base);
  const subtract = (object, key, amount) => { object[key] = Math.max(0, Number(object[key] || 0) - Number(amount || 0)); };
  if (sale.source_type === 'extra') {
    const count = Number(meta.count || 1);
    if (meta.extraType === 'sono') {
      next.groups.sono ||= {};
      subtract(next.groups.sono, meta.sonoKey, count);
    } else if (meta.extraType === 'tailored') {
      subtract(next, 'tailoredCount', count);
      subtract(next, 'tailoredAmount', meta.amount);
    } else if (meta.extraType === 'customerReg') subtract(next, 'custRegCount', count);
    else throw new Error('SALE_UNSUPPORTED_SOURCE');
  } else if (sale.source_type === 'mobile' && Number.isInteger(meta.ri) && Number.isInteger(meta.ci) && next.matrix?.[meta.ri]?.[meta.ci] != null) {
    subtract(next.matrix[meta.ri], meta.ci, 1);
    const vasKeys = meta.bundleVasCommissionExcluded ? (meta.vasKeys || []) : [...(meta.vasKeys || []), ...Object.values(meta.bundleVasMap || {}).flat()];
    next.groups.vas ||= {};
    next.groups.bundle2nd ||= {};
    next.groups.mnpBundle ||= {};
    vasKeys.filter(key => key !== 'vasNone').forEach(key => subtract(next.groups.vas, key, 1));
    (meta.bundle2ndKeys || []).forEach(key => subtract(next.groups.bundle2nd, key, 1));
    if (meta.usedMnpBundle) subtract(next.groups.mnpBundle, 'usedMnpBundle', 1);
    const sp = meta.specialPolicy || {};
    subtract(next, 'bundleFreeOffset', free.bundleOffset);
    subtract(next, 'bundleFreeVasOffset', free.vasOffset);
    subtract(next, 'specialMatrixOffset', sp.normalMatrixFee);
    subtract(next, 'specialVasOffset', sp.normalVasFee);
    subtract(next, 'specialReplacementPay', sp.exceptionStatus === 'approved' ? sp.exceptionApprovedAmount : sp.exceptionStatus === 'pending' ? 0 : sp.replacementAmount);
  } else throw new Error('SALE_UNSUPPORTED_SOURCE');
  return { ...next, inputConfirmed: false, inputConfirmedAt: null };
}

export async function deleteSaleAtomic(client, { userId, sale, normalizeDay, free }) {
  let expected = null, next = null;
  if (!sale.source_meta?.teamOnly) {
    const { data, error } = await client.from('daily_records').select('data').eq('user_id', userId).eq('work_date', sale.sale_date).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('SALE_DAILY_NOT_FOUND');
    expected = data.data;
    next = dayAfterSaleDeletion(normalizeDay(expected), sale, free);
  }
  const { data, error } = await client.rpc('delete_sale_atomic', {
    p_user_id: userId, p_sale_id: sale.id, p_expected_meta: sale.source_meta,
    p_expected_day: expected, p_next_day: next,
  });
  if (error) throw error;
  if (data?.sale_count !== 1) throw new Error('SALE_DELETE_MISMATCH');
  return data;
}

export async function deleteExpense(client, id, userId) {
  const { data, error } = await client.from('sales_expenses').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('EXPENSE_DELETE_MISMATCH');
}
