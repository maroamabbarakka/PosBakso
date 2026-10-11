/** Pure financial/inventory math used by POS flows and Node smoke tests. */
export function calculateOrderTotals(subtotal:number,discount:number,taxEnabled:boolean,taxPercent:number,serviceEnabled:boolean,servicePercent:number){
  const safeSubtotal=Math.max(0,Math.round(subtotal));const safeDiscount=Math.min(safeSubtotal,Math.max(0,Math.round(discount)));const netBase=safeSubtotal-safeDiscount
  const tax=taxEnabled?Math.round(netBase*Math.max(0,taxPercent)/100):0;const service=serviceEnabled?Math.round(netBase*Math.max(0,servicePercent)/100):0
  return {subtotal:safeSubtotal,discount:safeDiscount,netBase,tax,service,total:netBase+tax+service}
}
export function weightedAverageCost(stock:number,averageCost:number,receivedQty:number,receivedUnitCost:number){
  const nextStock=stock+receivedQty;if(nextStock===0)return Math.max(0,Math.round(receivedUnitCost));return Math.max(0,Math.round(((stock*averageCost)+(receivedQty*receivedUnitCost))/nextStock))
}
export function applyStockDelta(before:number,delta:number){return before+delta}
export function allocateDiscount(lineGross:number,orderGross:number,orderDiscount:number){return orderGross>0?orderDiscount*(lineGross/orderGross):0}
export function paymentsBalanced(total:number,amounts:number[]){return Math.abs(amounts.reduce((s,x)=>s+x,0)-total)<0.0001}
