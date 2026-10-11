import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateDiscount, applyStockDelta, calculateOrderTotals, paymentsBalanced, weightedAverageCost } from '../src/lib/domainMath.ts'

test('order totals separate net items from tax/service',()=>{
  assert.deepEqual(calculateOrderTotals(100_000,10_000,true,11,true,5),{subtotal:100000,discount:10000,netBase:90000,tax:9900,service:4500,total:104400})
})
test('discount never exceeds subtotal',()=>{assert.equal(calculateOrderTotals(20_000,99_000,false,0,false,0).total,0)})
test('weighted average purchase cost',()=>{assert.equal(weightedAverageCost(10,10_000,10,20_000),15_000)})
test('stock delta preserves mathematical ledger including negative stock',()=>{assert.equal(applyStockDelta(5,-8),-3)})
test('discount allocation is proportional',()=>{assert.equal(allocateDiscount(50_000,70_000,14_000),10_000)})
test('split tender must balance total',()=>{assert.equal(paymentsBalanced(33_000,[10_000,23_000]),true);assert.equal(paymentsBalanced(33_000,[10_000,22_000]),false)})
