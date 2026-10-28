/* Rincón Studio · Reparador de duración WebM.
   MediaRecorder (Chrome/Android) escribe WebM "en directo" sin el elemento Duration:
   la Galería lo muestra como 0:00 y apps como TikTok/Instagram fallan al decodificarlo.
   Esta función inserta Duration en el bloque Info del archivo. */
(function(root){
 'use strict';
 function readId(b,p){const first=b[p];let len=1;for(let m=0x80;len<=4&&!(first&m);m>>=1)len++;if(len>4)return null;let id=0;for(let i=0;i<len;i++)id=id*256+b[p+i];return {id,len};}
 function readSize(b,p){const first=b[p];let len=1;for(let m=0x80;len<=8&&!(first&m);m>>=1)len++;if(len>8)return null;let v=first&(0xFF>>len),unknown=(first&(0xFF>>len))===(0xFF>>len);for(let i=1;i<len;i++){v=v*256+b[p+i];if(b[p+i]!==0xFF)unknown=false;}return {size:v,len,unknown};}
 function encodeSize(n,minLen){let len=Math.max(1,minLen||1);while(n>=Math.pow(2,7*len)-1&&len<8)len++;const out=new Uint8Array(len);let v=n;for(let i=len-1;i>=0;i--){out[i]=v%256;v=Math.floor(v/256);}out[0]|=(0x80>>(len-1));return out;}
 function fixWebmDurationBytes(bytes,durationMs){
  const b=bytes;let p=0;
  const ebml=readId(b,p);if(!ebml||ebml.id!==0x1A45DFA3)return null;
  p+=ebml.len;const es=readSize(b,p);if(!es||es.unknown)return null;p+=es.len+es.size;
  const seg=readId(b,p);if(!seg||seg.id!==0x18538067)return null;
  const segIdPos=p;p+=seg.len;const ss=readSize(b,p);if(!ss)return null;const segSizePos=p,segDataStart=p+ss.len;p=segDataStart;
  let infoStart=-1,infoSizePos=-1,infoDataStart=-1,infoSize=0,infoSizeLen=0;const seekHeads=[];
  while(p<b.length-2){
   const id=readId(b,p);if(!id)break;const sz=readSize(b,p+id.len);if(!sz)break;
   if(id.id===0x1F43B675)break; // Cluster: Info debe ir antes
   if(id.id===0x114D9B74&&!sz.unknown)seekHeads.push([p+id.len+sz.len,sz.size]);
   if(id.id===0x1549A966){infoStart=p;infoSizePos=p+id.len;infoSizeLen=sz.len;infoDataStart=p+id.len+sz.len;infoSize=sz.size;break;}
   if(sz.unknown)break;
   p+=id.len+sz.len+sz.size;
  }
  if(infoStart<0)return null;
  // Escala de tiempo y duración existente
  let scale=1000000,hasDur=false,q=infoDataStart;const infoEnd=infoDataStart+infoSize;
  while(q<infoEnd){
   const id=readId(b,q);if(!id)break;const sz=readSize(b,q+id.len);if(!sz)break;const ds=q+id.len+sz.len;
   if(id.id===0x2AD7B1){let v=0;for(let i=0;i<sz.size;i++)v=v*256+b[ds+i];if(v>0)scale=v;}
   if(id.id===0x4489){const dv=new DataView(b.buffer,b.byteOffset+ds,sz.size);const d=sz.size===8?dv.getFloat64(0):sz.size===4?dv.getFloat32(0):0;if(d>0)hasDur=true;}
   q=ds+sz.size;
  }
  if(hasDur)return null; // ya tiene duración válida
  const units=durationMs*1e6/scale;
  const dur=new Uint8Array(11);dur[0]=0x44;dur[1]=0x89;dur[2]=0x88;new DataView(dur.buffer).setFloat64(3,units);
  const newInfoSize=infoSize+dur.length,newSizeBytes=encodeSize(newInfoSize,infoSizeLen);
  const delta=dur.length+(newSizeBytes.length-infoSizeLen);
  // Las posiciones del SeekHead son relativas al inicio de los datos del Segment: desplazarlas
  const src=b.slice();const infoRel=infoStart-segDataStart;
  for(const [shData,shSize] of seekHeads){
   let r=shData;const shEnd=shData+shSize;
   while(r<shEnd){
    const sid=readId(src,r);if(!sid)break;const ssz=readSize(src,r+sid.len);if(!ssz)break;const sd=r+sid.len+ssz.len;
    if(sid.id===0x4DBB){
     let t=sd;const seEnd=sd+ssz.size;
     while(t<seEnd){
      const cid=readId(src,t);if(!cid)break;const csz=readSize(src,t+cid.len);if(!csz)break;const cd=t+cid.len+csz.len;
      if(cid.id===0x53AC){let v=0;for(let i=0;i<csz.size;i++)v=v*256+src[cd+i];if(v>infoRel){v+=delta;for(let i=csz.size-1;i>=0;i--){src[cd+i]=v%256;v=Math.floor(v/256);}}}
      t=cd+csz.size;
     }
    }
    r=sd+ssz.size;
   }
  }
  const parts=[];
  // Tamaño del Segment: sólo se actualiza si estaba declarado
  if(!ss.unknown){
   const newSegSize=ss.size+delta,segSizeBytes=encodeSize(newSegSize,ss.len);
   parts.push(src.subarray(0,segSizePos),segSizeBytes,src.subarray(segSizePos+ss.len,infoSizePos));
  }else parts.push(src.subarray(0,infoSizePos));
  parts.push(newSizeBytes,src.subarray(infoDataStart,infoEnd),dur,src.subarray(infoEnd));
  let total=0;parts.forEach(x=>total+=x.length);const out=new Uint8Array(total);let o=0;parts.forEach(x=>{out.set(x,o);o+=x.length;});
  return out;
 }
 async function fixWebmDuration(blob,durationMs){
  try{
   if(!blob||!blob.size||!(durationMs>0))return blob;
   const buf=new Uint8Array(await blob.arrayBuffer());
   const fixed=fixWebmDurationBytes(buf,durationMs);
   return fixed?new Blob([fixed],{type:blob.type||'video/webm'}):blob;
  }catch(e){return blob;}
 }
 root.fixWebmDuration=fixWebmDuration;
 if(typeof module!=='undefined')module.exports={fixWebmDuration,fixWebmDurationBytes};
})(typeof window!=='undefined'?window:globalThis);
