const MAX_PIXELS = 24_000_000;
const decodeText = bytes => new TextDecoder().decode(bytes);
function formatOf(buffer) {
  const b = new Uint8Array(buffer);
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpeg';
  if (decodeText(b.subarray(0,4)) === 'RIFF' && decodeText(b.subarray(8,12)) === 'WEBP') {
    const view = new DataView(buffer);
    for (let p=12; p+8<=b.length;) {
      const type=decodeText(b.subarray(p,p+4)), size=view.getUint32(p+4,true);
      if (type === 'ANIM' || (type === 'VP8X' && (b[p+8] & 2))) throw new Error('Animated WebP is not supported. Choose a still image.');
      p += 8 + size + (size % 2);
    }
    return 'webp';
  }
  if (decodeText(b.subarray(4,8)) === 'ftyp') {
    const view=new DataView(buffer), size=Math.min(view.getUint32(0), b.length, 256), brands=[];
    for (let p=8;p+4<=size;p+=4) if(p!==12) brands.push(decodeText(b.subarray(p,p+4)));
    if(brands.includes('avis')) throw new Error('Image sequences are not supported. Choose a still photo.');
    if(brands.includes('avif'))return 'avif';
    if(brands.some(b=>['heic','heix','heim','heis','mif1'].includes(b)))return 'heic';
  }
  throw new Error('This file is not a supported JPG, WebP, AVIF or HEIC image.');
}
function dimensions(width,height) {
  if(!width || !height || width*height>MAX_PIXELS)throw new Error('This image exceeds the 24-megapixel limit. Your original is unchanged.');
}
async function heicPixels(buffer) {
  let lib;
  try { lib=(await import('./vendor/heif/libheif-bundle.mjs')).default(); lib=await lib; }
  catch { throw new Error('HEIC support could not load. Go online once and try again.'); }
  const decoder=new lib.HeifDecoder();let images=[];
  try {
    images=decoder.decode(new Uint8Array(buffer));
    const image=images.find(image=>image.is_primary()) || images[0];
    if(!image)throw new Error('This HEIC photo could not be read.');
    const width=image.get_width(),height=image.get_height();dimensions(width,height);
    const pixels=await new Promise((resolve,reject)=>image.display({width,height,data:new Uint8ClampedArray(width*height*4)},data=>data?resolve(data):reject(new Error('This HEIC photo could not be decoded.'))));
    return {pixels, primaryOnly:images.length>1};
  } finally {
    for(const image of images)image.free();
    if(decoder.decoder)lib.heif_context_free(decoder.decoder);
  }
}
self.onmessage=async({data:{buffer}})=>{
  let bitmap;
  try {
    const format=formatOf(buffer);
    if(typeof OffscreenCanvas==='undefined')throw new Error('Image conversion needs a newer browser. Please update your browser and try again.');
    try { bitmap=await createImageBitmap(new Blob([buffer],{type:format==='heic'?'image/heic':`image/${format}`})); }
    catch(error) { if(format!=='heic')throw new Error(`This ${format.toUpperCase()} could not be decoded by your browser. Try another image or a newer browser.`); }
    let canvas,primaryOnly=false;
    if(bitmap){
      dimensions(bitmap.width,bitmap.height);
      canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
      canvas.getContext('2d',{colorSpace:'srgb'}).drawImage(bitmap,0,0);
    }else{
      const decoded=await heicPixels(buffer);primaryOnly=decoded.primaryOnly;
      const {width,height,data}=decoded.pixels;canvas=new OffscreenCanvas(width,height);
      canvas.getContext('2d',{colorSpace:'srgb'}).putImageData(new ImageData(data,width,height),0,0);
    }
    const blob=await canvas.convertToBlob({type:'image/png'});
    if(blob.type!=='image/png')throw new Error('Your browser could not create a PNG.');
    const output=await blob.arrayBuffer();
    self.postMessage({ok:true,buffer:output,width:canvas.width,height:canvas.height,primaryOnly},[output]);
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'This image could not be converted. Your original is unchanged.'});}
  finally{bitmap?.close();}
};
