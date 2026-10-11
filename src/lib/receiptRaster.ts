import type { ReceiptRasterMode } from '../types'

export interface RasterImagePayload { width:number; height:number; widthBytes:number; dataBase64:string }

function bytesToBase64(bytes:Uint8Array){
  let binary='';const chunk=0x8000
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)))
  return btoa(binary)
}

export async function createMonochromeRaster(url:string,widthMm:number,paperWidth:58|80,mode:ReceiptRasterMode,threshold:number,printWidthDots?:number):Promise<RasterImagePayload|null>{
  if(typeof document==='undefined'||!url)return null
  const maxDots=Math.max(200,Math.min(640,Math.round(printWidthDots??(paperWidth===58?384:576))));let targetWidth=Math.max(8,Math.min(maxDots,Math.round(widthMm*8)))
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const element=new Image();element.crossOrigin='anonymous';element.onload=()=>resolve(element);element.onerror=()=>reject(new Error('Logo tidak dapat dimuat'));element.src=url})
  const ratio=img.naturalHeight/Math.max(1,img.naturalWidth);let targetHeight=Math.max(1,Math.round(targetWidth*ratio));const maxHeight=720;if(targetHeight>maxHeight){const factor=maxHeight/targetHeight;targetWidth=Math.max(8,Math.round(targetWidth*factor));targetHeight=maxHeight}const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=targetHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null
  ctx.fillStyle='#fff';ctx.fillRect(0,0,targetWidth,targetHeight);ctx.drawImage(img,0,0,targetWidth,targetHeight)
  const image=ctx.getImageData(0,0,targetWidth,targetHeight);const gray=new Float32Array(targetWidth*targetHeight)
  for(let i=0;i<gray.length;i++){const r=image.data[i*4],g=image.data[i*4+1],b=image.data[i*4+2],a=image.data[i*4+3]/255;gray[i]=(0.299*r+0.587*g+0.114*b)*a+255*(1-a)}
  const black=new Uint8Array(gray.length)
  if(mode==='floyd_steinberg'){
    for(let y=0;y<targetHeight;y++)for(let x=0;x<targetWidth;x++){
      const i=y*targetWidth+x;const old=gray[i];const value=old<threshold?0:255;black[i]=value===0?1:0;const error=old-value
      if(x+1<targetWidth)gray[i+1]+=error*7/16
      if(y+1<targetHeight){if(x>0)gray[i+targetWidth-1]+=error*3/16;gray[i+targetWidth]+=error*5/16;if(x+1<targetWidth)gray[i+targetWidth+1]+=error/16}
    }
  }else for(let i=0;i<gray.length;i++)black[i]=gray[i]<threshold?1:0
  const widthBytes=Math.ceil(targetWidth/8);const out=new Uint8Array(widthBytes*targetHeight)
  for(let y=0;y<targetHeight;y++)for(let x=0;x<targetWidth;x++)if(black[y*targetWidth+x])out[y*widthBytes+(x>>3)]|=(0x80>>(x&7))
  return {width:targetWidth,height:targetHeight,widthBytes,dataBase64:bytesToBase64(out)}
}

/**
 * Optimizes an uploaded logo for Firebase Spark without Cloud Storage.
 * Result is a compact WebP data URL suitable for the settings document and ESC/POS rasterization.
 */
export async function optimizeReceiptLogo(file:File):Promise<string>{
  if(typeof document==='undefined')throw new Error('Browser tidak tersedia')
  if(!file.type.startsWith('image/'))throw new Error('File logo harus berupa gambar.')
  if(file.size>8*1024*1024)throw new Error('Logo terlalu besar. Maksimum 8 MB sebelum optimasi.')
  const objectUrl=URL.createObjectURL(file)
  try{
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(new Error('Gambar logo tidak dapat dibaca.'));el.src=objectUrl})
    const maxDimension=640;const scale=Math.min(1,maxDimension/Math.max(img.naturalWidth,img.naturalHeight));const width=Math.max(1,Math.round(img.naturalWidth*scale));const height=Math.max(1,Math.round(img.naturalHeight*scale));const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas logo tidak tersedia.')
    ctx.clearRect(0,0,width,height);ctx.drawImage(img,0,0,width,height)
    let quality=.88;let encoded=canvas.toDataURL('image/webp',quality)
    // Keep the Firestore settings document comfortably below its 1 MiB document limit.
    while(encoded.length>240_000&&quality>.5){quality-=.08;encoded=canvas.toDataURL('image/webp',quality)}
    if(encoded.length>350_000)throw new Error('Logo masih terlalu kompleks setelah optimasi. Gunakan logo dengan resolusi/warna lebih sederhana.')
    return encoded
  } finally { URL.revokeObjectURL(objectUrl) }
}
