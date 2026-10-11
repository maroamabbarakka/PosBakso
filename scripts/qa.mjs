import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const root=process.cwd();const errors=[];const warnings=[];const ok=[]
const requireFile=(p)=>{if(!existsSync(join(root,p)))errors.push(`Missing required file: ${p}`);else ok.push(`file ${p}`)}
const text=async p=>readFile(join(root,p),'utf8')
const expect=(condition,message)=>{if(condition)ok.push(message);else errors.push(message)}
const warn=(condition,message)=>{if(!condition)warnings.push(message)}

for(const p of ['package.json','firebase.json','firestore.rules','firestore.indexes.json','public/manifest.webmanifest','scripts/generate-sw.mjs','src/services/firebaseSync.ts','src/services/printer.ts','src/lib/receiptRaster.ts','src/lib/receiptTemplate.ts','native/android/AndroidManifest.permissions.xml','native/android/com/maroamabbarakka/posbakso/EscPosPrinterPlugin.kt','native/android/com/maroamabbarakka/posbakso/MainActivity.kt','tests/domainMath.test.ts'])requireFile(p)

for(const p of ['package.json','firebase.json','firestore.indexes.json','public/manifest.webmanifest','capacitor.config.json']){
  try{JSON.parse(await text(p));ok.push(`valid JSON ${p}`)}catch(e){errors.push(`Invalid JSON ${p}: ${e.message}`)}
}

const pkg=JSON.parse(await text('package.json'))
expect(!Object.keys({...pkg.dependencies,...pkg.devDependencies}).some(k=>['@firebase/functions','@firebase/storage'].includes(k)),'no Firebase Functions/Storage dependency')
expect(Boolean(pkg.scripts?.build?.includes('generate-sw.mjs')),'build generates final service worker precache')
expect(Boolean(pkg.scripts?.qa),'package exposes npm run qa')

const firebaseJson=await text('firebase.json')
expect(firebaseJson.includes('"public":"dist"'),'Firebase Hosting serves dist')
expect(!firebaseJson.toLowerCase().includes('functions'),'firebase.json has no Cloud Functions target')

const allSource=[]
async function walk(dir){for(const name of await readdir(dir)){const p=join(dir,name);const s=await stat(p);if(s.isDirectory())await walk(p);else if(/\.(ts|tsx|js|mjs|json|rules|kt|md)$/.test(name))allSource.push(p)}}
for(const dir of ['src','native'])if(existsSync(dir))await walk(dir)
const joined=(await Promise.all(allSource.map(async p=>`${relative(root,p)}\n${await readFile(p,'utf8')}`))).join('\n')
expect(!/firebase\/storage|firebase\/functions|httpsCallable|getStorage\s*\(/.test(joined),'source does not import paid Firebase Functions/Storage')
expect(joined.includes('sync_events'),'idempotency marker sync_events present')
expect(joined.includes("op:'increment'")||joined.includes("op: 'increment'"),'inventory uses delta increment sync')
expect(joined.includes('weightedPurchase'),'weighted purchase transaction support present')
expect(joined.includes('stationStatus'),'station-specific KDS status present')
expect(joined.includes('printWidthDots'),'printer head dot calibration present')
expect(joined.includes('logoRaster'),'ESC/POS raster logo payload present')
expect(joined.includes('qrEnabled')&&joined.includes('barcodeEnabled'),'receipt QR/barcode customization present')
expect(joined.includes('printJobs'),'persistent print job queue present')
expect(!joined.includes('},[currentRole,currentUserId])'),'realtime listeners use stable permission dependencies')

const rules=await text('firestore.rules')
expect(rules.includes("request.resource.data.total == request.resource.data.subtotal - request.resource.data.discount + request.resource.data.tax + request.resource.data['service']"),'Rules enforce order money arithmetic')
expect(rules.includes("request.resource.data.discount == 0 || hasPermission('sale.discount')"),'Rules enforce discount permission')
expect(rules.includes("hasOnly(['stationStatus','kitchenStatus','updatedAt'])"),'Rules restrict kitchen mutation fields')
expect(rules.includes('match /sync_events/{docId}'),'Rules protect idempotency markers')
expect(rules.includes('match /{document=**} { allow read, write: if false; }'),'Rules have deny-all fallback')

const manifest=JSON.parse(await text('public/manifest.webmanifest'))
expect(manifest.icons?.some(x=>x.sizes==='192x192'&&x.type==='image/png'),'PWA has PNG 192 icon')
expect(manifest.icons?.some(x=>x.sizes==='512x512'&&x.type==='image/png'),'PWA has PNG 512 icon')
expect(manifest.icons?.some(x=>String(x.purpose).includes('maskable')),'PWA has maskable icon')

const defaults=await text('src/data/defaults.ts');const migrate=await text('src/lib/migrate.ts')
const schemaDefault=defaults.match(/schemaVersion:(\d+)/)?.[1];const schemaMigration=migrate.match(/CURRENT_SCHEMA_VERSION=(\d+)/)?.[1]
expect(Boolean(schemaDefault&&schemaDefault===schemaMigration),`schema version consistent (${schemaDefault??'?'} / ${schemaMigration??'?'})`)

const native=await text('native/android/com/maroamabbarakka/posbakso/EscPosPrinterPlugin.kt')
expect(native.includes('calibrationRaster'),'native printer has full-width calibration raster')
expect(native.includes('0x1D,0x76,0x30'),'native printer emits ESC/POS raster command')
expect(native.includes('barcodeCode128')&&native.includes('fun qr('),'native QR and CODE128 present')
expect(native.includes('Executors.newSingleThreadExecutor'),'blocking Bluetooth I/O moved off UI thread')

warn(existsSync('package-lock.json'),'package-lock.json is not present; generate and commit it after first successful npm install in an internet-enabled workstation.')
console.log(`QA checks passed: ${ok.length}`)
for(const x of warnings)console.warn(`WARN: ${x}`)
if(errors.length){for(const x of errors)console.error(`FAIL: ${x}`);process.exit(1)}
console.log('Static QA: PASS')
