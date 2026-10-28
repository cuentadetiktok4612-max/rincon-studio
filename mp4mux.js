/* Rincón Studio · Muxer MP4 mínimo (H.264 + AAC) sin dependencias.
   Escribe un MP4 NO fragmentado con 'moov' al inicio (faststart), duración exacta
   y tablas de muestras completas: lo reproducen Galería de Android, TikTok, Instagram y YouTube. */
(function(root){
 'use strict';
 const enc=new TextEncoder();
 const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const u16=n=>[(n>>>8)&255,n&255];
 function concat(parts){let n=0;for(const p of parts)n+=p.length;const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
 function box(type,...payload){const body=concat(payload.map(p=>p instanceof Uint8Array?p:Uint8Array.from(p)));return concat([Uint8Array.from(u32(body.length+8)),enc.encode(type),body]);}
 function fullbox(type,version,flags,...payload){return box(type,[version,(flags>>16)&255,(flags>>8)&255,flags&255],...payload);}
 function matrix(){const m=[];[0x00010000,0,0,0,0x00010000,0,0,0,0x40000000].forEach(v=>m.push(...u32(v)));return m;}

 // Descriptor MPEG-4 para esds (AAC)
 function descr(tag,...payload){const body=concat(payload.map(p=>p instanceof Uint8Array?p:Uint8Array.from(p)));const len=body.length;return concat([Uint8Array.from([tag,0x80,0x80,0x80,len]),body]);}
 function esds(asc){
  const dec=descr(0x04,[0x40,0x15,0,0,0],u32(0),u32(0),descr(0x05,asc));
  const sl=descr(0x06,[0x02]);
  return fullbox('esds',0,0,descr(0x03,u16(0),[0],dec,sl));
 }

 class Mp4Muxer{
  /* opts:{width,height,timescale?,video:{description:Uint8Array(avcC)},audio?:{codec:'aac'|'opus',sampleRate,channels,description:Uint8Array}} */
  constructor(opts){
   this.o=opts;this.vts=90000;this.v=[];this.a=[];this.audio=opts.audio||null;
  }
  addVideo(data,timestampUs,durationUs,isKey){this.v.push({data:new Uint8Array(data),ts:timestampUs,dur:durationUs,key:!!isKey});}
  addAudio(data,timestampUs,durationUs){this.a.push({data:new Uint8Array(data),ts:timestampUs,dur:durationUs});}
  _vDurations(){
   // Duraciones derivadas de las marcas de tiempo (más fiables que las del codificador).
   const v=this.v,n=v.length,d=new Array(n);
   for(let i=0;i<n;i++){const next=i<n-1?v[i+1].ts:v[i].ts+(v[i].dur||33333);d[i]=Math.max(1,Math.round((next-v[i].ts)*this.vts/1e6));}
   return d;
  }
  _stts(durs){const rows=[];for(const d of durs){const last=rows[rows.length-1];if(last&&last[1]===d)last[0]++;else rows.push([1,d]);}const b=[];b.push(...u32(rows.length));rows.forEach(r=>b.push(...u32(r[0]),...u32(r[1])));return fullbox('stts',0,0,b);}
  _stsz(sizes){const b=[...u32(0),...u32(sizes.length)];sizes.forEach(s=>b.push(...u32(s)));return fullbox('stsz',0,0,b);}
  _videoTrak(durs,chunkOffsets,movieTs){
   const o=this.o,v=this.v,n=v.length;
   const totalVid=durs.reduce((a,b)=>a+b,0);
   const mdur=totalVid,tdur=Math.round(totalVid*movieTs/this.vts);
   const tkhd=fullbox('tkhd',0,3,u32(0),u32(0),u32(1),u32(0),u32(tdur),u32(0),u32(0),u16(0),u16(0),u16(0),u16(0),matrix(),u32(o.width<<16),u32(o.height<<16));
   const mdhd=fullbox('mdhd',0,0,u32(0),u32(0),u32(this.vts),u32(mdur),u16(0x55c4),u16(0));
   const hdlr=fullbox('hdlr',0,0,u32(0),enc.encode('vide'),u32(0),u32(0),u32(0),enc.encode('VideoHandler'),[0]);
   const vmhd=fullbox('vmhd',0,1,u16(0),u16(0),u16(0),u16(0));
   const dinf=box('dinf',fullbox('dref',0,0,u32(1),fullbox('url ',0,1)));
   const avc1=box('avc1',[0,0,0,0,0,0],u16(1),u16(0),u16(0),u32(0),u32(0),u32(0),u16(o.width),u16(o.height),u32(0x00480000),u32(0x00480000),u32(0),u16(1),new Uint8Array(32),u16(0x18),u16(0xffff),box('avcC',o.video.description));
   const stsd=fullbox('stsd',0,0,u32(1),avc1);
   const keys=[];v.forEach((f,i)=>{if(f.key)keys.push(i+1);});
   const stss=fullbox('stss',0,0,u32(keys.length),keys.flatMap(k=>u32(k)));
   // Un fotograma por 'chunk' simplifica las tablas
   const stsc=fullbox('stsc',0,0,u32(1),u32(1),u32(1),u32(1));
   const stco=fullbox('stco',0,0,u32(n),chunkOffsets.flatMap(x=>u32(x)));
   const stbl=box('stbl',stsd,this._stts(durs),keys.length?stss:new Uint8Array(0),stsc,this._stsz(v.map(f=>f.data.length)),stco);
   const minf=box('minf',vmhd,dinf,stbl);
   return {trak:box('trak',tkhd,box('mdia',mdhd,hdlr,minf)),mdur,tdur};
  }
  _audioTrak(chunkOffsets,movieTs){
   const au=this.audio,a=this.a,n=a.length;
   const ts=au.sampleRate;
   // Duración por muestra en unidades de sampleRate
   const durs=a.map((f,i)=>{const next=i<n-1?a[i+1].ts:f.ts+(f.dur||Math.round(1024/ts*1e6));return Math.max(1,Math.round((next-f.ts)*ts/1e6));});
   const total=durs.reduce((x,y)=>x+y,0),tdur=Math.round(total*movieTs/ts);
   const tkhd=fullbox('tkhd',0,3,u32(0),u32(0),u32(2),u32(0),u32(tdur),u32(0),u32(0),u16(0),u16(0),u16(0x0100),u16(0),matrix(),u32(0),u32(0));
   const mdhd=fullbox('mdhd',0,0,u32(0),u32(0),u32(ts),u32(total),u16(0x55c4),u16(0));
   const hdlr=fullbox('hdlr',0,0,u32(0),enc.encode('soun'),u32(0),u32(0),u32(0),enc.encode('SoundHandler'),[0]);
   const smhd=fullbox('smhd',0,0,u16(0),u16(0));
   const dinf=box('dinf',fullbox('dref',0,0,u32(1),fullbox('url ',0,1)));
   let entry;
   const head=[[0,0,0,0,0,0],u16(1),u32(0),u32(0),u16(au.channels),u16(16),u16(0),u16(0),u32(ts*65536>>>0)];
   if(au.codec==='opus'){
    const dOps=box('dOps',[0],[au.channels],u16(au.preSkip||312),u32(au.sampleRate),u16(0),[0]);
    entry=box('Opus',...head,dOps);
   }else{
    entry=box('mp4a',...head,esds(au.description));
   }
   const stsd=fullbox('stsd',0,0,u32(1),entry);
   const stsc=fullbox('stsc',0,0,u32(1),u32(1),u32(1),u32(1));
   const stco=fullbox('stco',0,0,u32(n),chunkOffsets.flatMap(x=>u32(x)));
   const stbl=box('stbl',stsd,this._stts(durs),stsc,this._stsz(a.map(f=>f.data.length)),stco);
   return {trak:box('trak',tkhd,box('mdia',mdhd,hdlr,box('minf',smhd,dinf,stbl))),tdur};
  }
  /* Devuelve un Blob video/mp4 */
  finalize(){
   if(!this.v.length)throw new Error('No hay fotogramas de vídeo para empaquetar.');
   // Normaliza para que el primer fotograma empiece en 0
   const t0=this.v[0].ts;this.v.forEach(f=>f.ts-=t0);
   if(this.audio&&this.a.length){const a0=Math.min(this.a[0].ts,0);this.a.forEach(f=>f.ts-=a0);}
   const hasA=!!(this.audio&&this.a.length),movieTs=1000;
   const durs=this._vDurations();
   const ftyp=box('ftyp',enc.encode('isom'),u32(0x200),enc.encode('isom'),enc.encode('iso2'),enc.encode('avc1'),enc.encode('mp41'));
   // Primera pasada para conocer el tamaño de moov (los offsets ocupan tamaño fijo)
   const build=(base)=>{
    let off=base;const vOff=[],aOff=[];
    // Entrelazado por tiempo: se escribe cada muestra en orden de marca de tiempo
    const order=[];this.v.forEach((f,i)=>order.push({k:'v',i,ts:f.ts}));if(hasA)this.a.forEach((f,i)=>order.push({k:'a',i,ts:f.ts}));
    order.sort((x,y)=>x.ts-y.ts||(x.k==='v'?-1:1));
    for(const e of order){const f=e.k==='v'?this.v[e.i]:this.a[e.i];(e.k==='v'?vOff:aOff)[e.i]=off;off+=f.data.length;}
    const vt=this._videoTrak(durs,vOff,movieTs);
    const at=hasA?this._audioTrak(aOff,movieTs):null;
    const mdur=Math.max(vt.tdur,at?at.tdur:0);
    const mvhd=fullbox('mvhd',0,0,u32(0),u32(0),u32(movieTs),u32(mdur),u32(0x00010000),u16(0x0100),u16(0),u32(0),u32(0),matrix(),new Uint8Array(24),u32(hasA?3:2));
    const moov=box('moov',mvhd,vt.trak,at?at.trak:new Uint8Array(0));
    return {moov,order,totalData:off-base};
   };
   let r=build(0);
   const mdatHeader=8;
   r=build(ftyp.length+r.moov.length+mdatHeader); // offsets finales (moov mantiene su tamaño)
   const mdatSize=r.totalData+mdatHeader;
   if(mdatSize>0xFFFFFFFF)throw new Error('El vídeo supera 4 GB.');
   const parts=[ftyp,r.moov,Uint8Array.from([...u32(mdatSize),...enc.encode('mdat')])];
   for(const e of r.order)parts.push((e.k==='v'?this.v[e.i]:this.a[e.i]).data);
   return new Blob(parts,{type:'video/mp4'});
  }
 }
 root.Mp4Muxer=Mp4Muxer;
 if(typeof module!=='undefined')module.exports={Mp4Muxer};
})(typeof window!=='undefined'?window:globalThis);
