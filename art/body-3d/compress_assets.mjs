/** Lossless delivery copies. Never modifies the canonical GLBs or their manifest.
 * node art/body-3d/compress_assets.mjs --meshopt-module /path/to/meshopt_encoder.js
 * Requires meshoptimizer 1.3.0 for the reproducible encoder and decoder.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const inputFlag=process.argv.indexOf('--input');
const input=inputFlag>=0?path.resolve(process.argv[inputFlag+1]):path.join(root,'assets/body-3d');
const output=path.join(input,'compressed');
const gzipOnly=process.argv.includes('--gzip-only');
const flag=process.argv.indexOf('--meshopt-module');
const encoderModule=flag>=0?pathToFileURL(path.resolve(process.argv[flag+1])).href:'meshoptimizer/encoder';
const decoderModule=flag>=0?new URL('./meshopt_decoder.mjs',encoderModule).href:'meshoptimizer/decoder';
const MeshoptEncoder=gzipOnly?null:(await import(encoderModule)).MeshoptEncoder;
const MeshoptDecoder=gzipOnly?null:(await import(decoderModule)).MeshoptDecoder;
if(!gzipOnly)await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const extension='EXT_meshopt_compression';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function readGLB(bytes){
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  const n=bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(20+n+4),0x004e4942);
  return {doc:JSON.parse(bytes.subarray(20,20+n)),bin:bytes.subarray(28+n)};
}
function writeGLB(doc,bin){
  const json=Buffer.from(JSON.stringify(doc));
  const j=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]);
  const b=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);
  header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,j,bh,b]);
}
fs.mkdirSync(output,{recursive:true});
const sourceManifest=JSON.parse(fs.readFileSync(path.join(input,'manifest.json')));
const manifest=structuredClone(sourceManifest);
manifest.delivery={encoding:extension,lossless:true,sourceManifest:'../manifest.json',
  instructions:'Register a Meshopt decoder before loading. No quantization, filters, simplification or triangle reordering. Picking runs are unchanged and apply to these decoded GLBs.',
  originalGzip:'original-gzip.json describes optional plain gzip copies of the canonical GLBs; those need gunzip only.'};
const report=gzipOnly?{encoding:'gzip',level:9,variants:{}}:{encoder:'meshoptimizer 1.3.0',attributeBitstreamVersion:0,filter:'NONE',indexMode:'INDICES',variants:{}};
const gzipManifest={assetVersion:sourceManifest.assetVersion,encoding:'gzip',decodedManifest:'../manifest.json',variants:{}};
for(const [variant,info] of Object.entries(sourceManifest.variants)){
  const original=fs.readFileSync(path.join(input,info.filename));
  assert.equal(hash(original),info.sha256,'Canonical asset must match its manifest');
  const zipped=zlib.gzipSync(original,{level:9});
  assert.deepEqual(zlib.gunzipSync(zipped),original);
  const gzName=info.filename+'.gz';fs.writeFileSync(path.join(output,gzName),zipped);
  gzipManifest.variants[variant]={filename:gzName,bytes:zipped.length,sha256:hash(zipped),decodedBytes:original.length,decodedSha256:info.sha256};
  if(gzipOnly){
    report.variants[variant]={originalBytes:original.length,gzipBytes:zipped.length,gzipRoundtripByteIdentical:true,originalSha256:info.sha256,gzipSha256:hash(zipped)};
    continue;
  }
  const {doc,bin}=readGLB(original);
  const before=structuredClone(doc);
  const chunks=[];let length=0,virtualLength=0,compressedViews=0;
  function append(bytes){const padding=(-length)&3;chunks.push(Buffer.alloc(padding));length+=padding;const offset=length;chunks.push(Buffer.from(bytes));length+=bytes.length;return offset;}
  for(const [i,v] of doc.bufferViews.entries()){
    assert.equal(v.buffer,0);
    const bytes=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
    const accessors=doc.accessors.filter(a=>a.bufferView===i);
    let encoded;
    if(accessors.length===1){
      const a=accessors[0];assert.equal(a.byteOffset||0,0);
      const stride=v.byteLength/a.count;
      const mode=a.type==='SCALAR'?'INDICES':'ATTRIBUTES';
      // INDICES preserves every index exactly. TRIANGLES can rotate a triangle's indices.
      encoded=MeshoptEncoder.encodeGltfBuffer(bytes,a.count,stride,mode,0);
      const decoded=new Uint8Array(bytes.length);
      MeshoptDecoder.decodeGltfBuffer(decoded,a.count,stride,encoded,mode,'NONE');
      assert.deepEqual(Buffer.from(decoded),bytes,`${variant}: view ${i} is not lossless`);
      if(encoded.length+180<bytes.length){
        virtualLength=(virtualLength+3)&~3;
        v.buffer=1;v.byteOffset=virtualLength;virtualLength+=bytes.length;
        v.extensions={[extension]:{buffer:0,byteOffset:append(encoded),byteLength:encoded.length,byteStride:stride,count:a.count,mode,filter:'NONE'}};
        compressedViews++;continue;
      }
    }
    v.buffer=0;v.byteOffset=append(bytes);
  }
  doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),extension])];
  doc.extensionsRequired=[...new Set([...(doc.extensionsRequired||[]),extension])];
  doc.buffers=[{byteLength:length},{byteLength:virtualLength,extensions:{[extension]:{fallback:true}}}];
  const result=writeGLB(doc,Buffer.concat(chunks));
  // Independently decode the serialized result and compare every view, including textures.
  const packed=readGLB(result);
  for(const [i,v] of packed.doc.bufferViews.entries()){
    const e=v.extensions?.[extension];let decoded;
    if(e){decoded=new Uint8Array(v.byteLength);MeshoptDecoder.decodeGltfBuffer(decoded,e.count,e.byteStride,packed.bin.subarray(e.byteOffset,e.byteOffset+e.byteLength),e.mode,e.filter);}
    else decoded=packed.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);
    const old=before.bufferViews[i];assert.deepEqual(Buffer.from(decoded),bin.subarray(old.byteOffset||0,(old.byteOffset||0)+old.byteLength));
  }
  for(const key of ['nodes','meshes','accessors','materials','images','textures','samplers','scenes'])assert.deepEqual(packed.doc[key],before[key]);
  fs.writeFileSync(path.join(output,info.filename),result);
  manifest.variants[variant]={...info,bytes:result.length,sha256:hash(result),sourceSha256:info.sha256,requiredExtensions:[extension]};
  report.variants[variant]={originalBytes:original.length,meshoptBytes:result.length,gzipBytes:zipped.length,
    meshoptReductionPercent:100*(1-result.length/original.length),gzipReductionPercent:100*(1-zipped.length/original.length),
    originalSha256:info.sha256,meshoptSha256:hash(result),gzipSha256:hash(zipped),compressedViews,
    decodedBufferViewsByteIdentical:packed.doc.bufferViews.length,sceneAndAccessorsUnchanged:true,gzipRoundtripByteIdentical:true,
    originalDeflateBytes:zlib.deflateRawSync(original,{level:9}).length,meshoptDeflateBytes:zlib.deflateRawSync(result,{level:9}).length};
  assert.equal(hash(fs.readFileSync(path.join(input,info.filename))),info.sha256);
}
if(!gzipOnly)fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(output,'original-gzip.json'),JSON.stringify(gzipManifest,null,2)+'\n');
fs.writeFileSync(path.join(gzipOnly?output:path.join(root,'art/body-3d'),'compression-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
