import { bytesToBase64 } from '../escpos/encoder'

const BASE='http://127.0.0.1:18181'
const TOKEN_KEY='posbakso.printBridgeToken'
const headers=()=>({'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem(TOKEN_KEY)??''}`})
async function call<T>(path:string,init?:RequestInit):Promise<T>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2500);try{const response=await fetch(`${BASE}${path}`,{...init,headers:{...headers(),...(init?.headers??{})},signal:controller.signal});if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||`Bridge HTTP ${response.status}`);return response.json()}finally{clearTimeout(timer)}}
export const bridgeToken=()=>localStorage.getItem(TOKEN_KEY)??''
export const saveBridgeToken=(token:string)=>localStorage.setItem(TOKEN_KEY,token.trim())
export async function bridgeHealth(){return call<{ok:boolean;version:string;printers:string[]}>('/health')}
export async function bridgePrinters(){return (await call<{printers:string[]}>('/printers')).printers}
export async function bridgePrint(jobId:string,printerName:string,data:Uint8Array){return call<{ok:boolean;duplicate?:boolean}>('/print',{method:'POST',body:JSON.stringify({jobId,printerName,data:bytesToBase64(data)})})}
export async function pairBridge(code:string){const result=await call<{token:string}>('/pair',{method:'POST',body:JSON.stringify({code})});saveBridgeToken(result.token);return result}
