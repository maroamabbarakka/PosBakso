const KEY='posbakso.terminalCode'
function randomCode(){const n=Math.floor(Math.random()*36*36*36).toString(36).toUpperCase().padStart(3,'0');return n}
export function getTerminalCode(){
  if(typeof localStorage==='undefined')return'WEB'
  let value=localStorage.getItem(KEY)?.trim().toUpperCase()
  if(!value){value=randomCode();localStorage.setItem(KEY,value)}
  return value
}
export function setTerminalCode(value:string){
  const clean=value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)||randomCode();localStorage.setItem(KEY,clean);return clean
}
export function nextLocalSequence(dateKey:string){
  const terminal=getTerminalCode();const key=`posbakso.sequence.${dateKey}.${terminal}`;const next=(Number(localStorage.getItem(key))||0)+1;localStorage.setItem(key,String(next));return next
}
export function createHumanOrderNumber(prefix:string,dateKey:string){
  const [yyyy,mm,dd]=dateKey.split('-');const seq=nextLocalSequence(dateKey);const terminal=getTerminalCode();return `${prefix}-${yyyy.slice(-2)}${mm}${dd}-${terminal}-${String(seq).padStart(4,'0')}`
}
export function createQueueNumber(prefix:string,dateKey:string){
  const terminal=getTerminalCode();const key=`posbakso.queue.${dateKey}.${terminal}`;const next=(Number(localStorage.getItem(key))||0)+1;localStorage.setItem(key,String(next));return `${prefix}${terminal.slice(-2)}-${String(next).padStart(3,'0')}`
}
