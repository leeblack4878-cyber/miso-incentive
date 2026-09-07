import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSalesManagerPayroll } from '../src/salesManagerPolicyEngine.js';

describe('sales manager payroll policy', () => {
  it('uses company totals to select tiers and applies the rate to all HS/home units', () => {
    const result = calculateSalesManagerPayroll({ hs: 780, simMnp: 20, second: 100, home: 83, upsell: 520 });
    assert.equal(result.mobileVolume,820);
    assert.equal(result.mobileTier.rate,5000);
    assert.equal(result.hsIncentive,3900000);
    assert.equal(result.homeTier.rate,15000);
    assert.equal(result.homeIncentive,1245000);
    assert.equal(result.upsellIncentive,1560000);
    assert.equal(result.finalPay,10005000);
  });

  it('guarantees six million won when the calculated total is lower', () => {
    const result = calculateSalesManagerPayroll({ hs: 699, home: 69, upsell: 499 });
    assert.equal(result.calculatedPay,3300000);
    assert.equal(result.guaranteeAdjustment,2700000);
    assert.equal(result.finalPay,6000000);
  });
});
