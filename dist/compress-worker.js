import { optimizePng } from './png-optimize.js';
self.onmessage = async ({data:{buffer}}) => {
  try {
    const result=await optimizePng(buffer);
    self.postMessage({ok:true,...result},[result.buffer]);
  } catch(error) {
    self.postMessage({ok:false,error:error instanceof Error?error.message:'This PNG could not be read. Your original is unchanged.'});
  }
};
