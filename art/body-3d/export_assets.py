"""Re-export Reed's editable source with Blender; no application dependencies.
blender --background art/body-3d/reed-bodies.blend --python art/body-3d/export_assets.py
Optional after --: --variant male, --output /absolute/path
"""
import argparse, collections, hashlib, json, pathlib, struct, sys, os
import bpy
import numpy as np
from mathutils.kdtree import KDTree

ROOT=pathlib.Path(__file__).resolve().parents[2]

def read_glb(path):
 data=path.read_bytes();assert data[:4]==b'glTF'
 n,typ=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+n]);pos=20+n
 length,kind=struct.unpack_from('<II',data,pos);assert kind==0x004e4942
 return doc,bytearray(data[pos+8:pos+8+length])

def accessor(doc,binary,i):
 a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 assert 'sparse' not in a and 'byteStride' not in view
 return np.frombuffer(binary,dtype=dtype,count=a['count']*width,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],width).copy()

def append_accessor(doc,binary,values):
 while len(binary)%4:binary.append(0)
 values=np.asarray(values,dtype='<f4');offset=len(binary);binary.extend(values.tobytes());doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':values.nbytes,'target':34962})
 doc['accessors'].append({'bufferView':len(doc['bufferViews'])-1,'componentType':5126,'count':len(values),'type':'VEC3'})
 return len(doc['accessors'])-1

def compact(doc,binary):
 # Remove superseded patch normals without reordering vertices or triangles.
 used=set()
 for m in doc['meshes']:
  for p in m['primitives']:
   used.add(p['indices']);used.update(p['attributes'].values())
   for t in p.get('targets',[]):used.update(t.values())
 amap={old:new for new,old in enumerate(sorted(used))}
 for m in doc['meshes']:
  for p in m['primitives']:
   p['indices']=amap[p['indices']];p['attributes']={k:amap[v] for k,v in p['attributes'].items()}
   p['targets']=[{k:amap[v] for k,v in t.items()} for t in p.get('targets',[])]
 doc['accessors']=[a for i,a in enumerate(doc['accessors']) if i in used]
 views={a['bufferView'] for a in doc['accessors']}|{i['bufferView'] for i in doc.get('images',[])}
 vmap={old:new for new,old in enumerate(sorted(views))};out=bytearray();newviews=[]
 for i in sorted(views):
  v=dict(doc['bufferViews'][i]);old=v.get('byteOffset',0)
  while len(out)%4:out.append(0)
  v['byteOffset']=len(out);out.extend(binary[old:old+v['byteLength']]);newviews.append(v)
 for a in doc['accessors']:a['bufferView']=vmap[a['bufferView']]
 for im in doc.get('images',[]):im['bufferView']=vmap[im['bufferView']]
 doc['bufferViews']=newviews
 return out

def write_glb(path,doc,binary):
 while len(binary)%4:binary.append(0)
 doc['buffers'][0]['byteLength']=len(binary);js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)

def gltf_coords(a):return np.array(a)[:,[0,2,1]]*np.array([1,1,-1])
def face_key(points):return tuple(sorted(tuple(np.round(v,6)) for v in points))

def synchronize_patches(body,collection):
 """Derived patches follow edits to the visible body's Basis and shape keys."""
 keys=body.data.shape_keys.key_blocks
 arrays={k.name:np.array([v.co[:] for v in k.data]) for k in keys}
 sample=bpy.data.meshes.new('reed_export_normal_sample')
 sample.from_pydata(arrays['Basis'].tolist(),[],[list(p.vertices) for p in body.data.polygons]);sample.update()
 normal=np.array([v.normal[:] for v in sample.vertices]);bpy.data.meshes.remove(sample)
 for ob in collection.all_objects:
  if ob==body:continue
  attribute=ob.data.attributes.get('reed_source_vertex')
  if attribute is None:continue
  ids=np.array([v.value for v in attribute.data],dtype=int)
  for k in ob.data.shape_keys.key_blocks:k.data.foreach_set('co',(arrays[k.name][ids]+normal[ids]*.00035).ravel())
  ob.data.normals_split_custom_set_from_vertices(normal[ids].tolist())
 return arrays['Basis'],normal

def export_variant(variant,output):
 body=bpy.data.objects[variant+'_body'];collection=bpy.data.collections[variant]
 source_base,source_normals=synchronize_patches(body,collection)
 for o in bpy.context.selected_objects:o.select_set(False)
 for o in collection.all_objects:
  o.hide_set(False);o.select_set(True)
  if o.data.shape_keys:
   for k in o.data.shape_keys.key_blocks:k.value=0
 path=output/(variant+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=True,export_morph_normal=True,export_extras=True,export_yup=True,export_try_sparse_sk=False,export_attributes=False,export_cameras=False,export_lights=False)
 doc,binary=read_glb(path)
 for node in doc['nodes']:
  if node.get('name','').startswith(variant+'_'):node['name']=node['name'][len(variant)+1:]
 for mesh in doc['meshes']:
  if mesh.get('name','').startswith(variant+'_'):mesh['name']=mesh['name'][len(variant)+1:]
 for material in doc['materials']:
  if material['name']==variant+'_body_matte':material['name']='reed_body_matte'
  material['doubleSided']=False
  material.pop('extensions',None)
  if material['name']=='reed_highlight':
   material['alphaMode']='BLEND';material.pop('alphaCutoff',None);material['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,0]
 body_node=next(n for n in doc['nodes'] if n.get('name')=='body');bm=doc['meshes'][body_node['mesh']];assert len(bm['primitives'])==1
 bp=bm['primitives'][0];positions=accessor(doc,binary,bp['attributes']['POSITION']);indices=accessor(doc,binary,bp['indices']).ravel().reshape(-1,3)
 source_positions=gltf_coords([v.co[:] for v in body.data.vertices]);labels=json.loads(body['reed_pain_labels']);attr=body.data.attributes['reed_pain_id']
 face_tree=KDTree(len(body.data.polygons))
 for p in body.data.polygons:face_tree.insert(source_positions[list(p.vertices)].mean(axis=0),p.index)
 face_tree.balance();selected=[];source_faces=[]
 for t in indices:
  _,fi,distance=face_tree.find(positions[t].mean(axis=0));assert distance<1e-6
  value=attr.data[fi].value;selected.append(labels[value-1] if value else None);source_faces.append(fi)
 assert len(set(source_faces))==len(indices), 'Export triangle correspondence must be bijective.'
 runs=[]
 for i,id in enumerate(selected):
  if runs and runs[-1][2]==id:runs[-1][1]+=1
  else:runs.append([i,1,id])
 # Copy the continuous body's normals to patch borders, including all morph normal deltas.
 # This eliminates dark seams caused by recomputing normals on an open patch.
 tree=KDTree(len(positions))
 for i,p in enumerate(positions):tree.insert(p,i)
 tree.balance();bn=accessor(doc,binary,bp['attributes']['NORMAL']);normal_targets=[accessor(doc,binary,t['NORMAL']) for t in bp['targets']]
 # Match the exact authored offset positions. Exported custom normals can be
 # quantized at patch borders, so they must not determine source correspondence.
 offset_tree=KDTree(len(source_base))
 for i,v in enumerate(gltf_coords(source_base+source_normals*.00035)):offset_tree.insert(v,i)
 offset_tree.balance()
 source_to_export=np.array([tree.find(v)[1] for v in gltf_coords(source_base)])
 patches=[]
 for n in doc['nodes']:
  if 'mesh' not in n or n['name']=='body':continue
  mesh=doc['meshes'][n['mesh']];assert len(mesh['primitives'])==1
  p=mesh['primitives'][0];pos=accessor(doc,binary,p['attributes']['POSITION'])
  matches=[offset_tree.find(v) for v in pos];assert max(m[2] for m in matches)<2e-6
  matches=source_to_export[[m[1] for m in matches]];p['attributes']['NORMAL']=append_accessor(doc,binary,bn[matches])
  for t,normal in zip(p['targets'],normal_targets):t['NORMAL']=append_accessor(doc,binary,normal[matches])
  patches.append({'node':n['name'],'id':n['extras']['reed_id'],'kind':n['extras']['reed_role'],'triangles':doc['accessors'][p['indices']]['count']//3})
 # Export one consistent matte interface. Unused inherited extensions are not required.
 doc['asset']['copyright']='Blender Studio and community Human Base Meshes v1.4.1, CC0-1.0; Reed anatomical relief and adaptations.'
 doc['asset']['extras']={'reedAssetVersion':bpy.context.scene['reed_asset_version'],'front':'+Z','anatomicalLeft':'+X'}
 anchors={}
 for label in labels:
  candidates=[i for i,v in enumerate(selected) if v==label]
  centers=positions[indices[candidates]].mean(axis=1)
  center=centers.mean(axis=0);front=[j for j,p in enumerate(centers) if p[2]>=center[2]]
  choice=min(front or list(range(len(centers))),key=lambda j:np.linalg.norm(centers[j][[0,1]]-center[[0,1]]))
  anchors[label]={'primitive':0,'triangle':candidates[choice],'barycentric':[1/3]*3,'minimumTouchRadiusPixels':22}
 targets=[accessor(doc,binary,t['POSITION']) for t in bp['targets']]
 all_points=np.concatenate([positions,positions+targets[0],positions+targets[1],positions+sum(targets)])
 binary=compact(doc,binary);write_glb(path,doc,binary)
 return {'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'visibleTriangles':len(indices),'highlightTriangles':sum(p['triangles'] for p in patches),'totalStoredTriangles':len(indices)+sum(p['triangles'] for p in patches),'meshCount':len(doc['meshes']),'materialCount':len(doc['materials']),'materials':[m['name'] for m in doc['materials']],'textures':[{'name':im.get('name'),'width':1024,'height':1024,'mimeType':im.get('mimeType'),'embeddedBytes':doc['bufferViews'][im['bufferView']]['byteLength']} for im in doc.get('images',[])],'baseBounds':{'min':positions.min(axis=0).tolist(),'max':positions.max(axis=0).tolist()},'morphEnvelopeBounds':{'min':all_points.min(axis=0).tolist(),'max':all_points.max(axis=0).tolist()},'bodyNode':'body','bodyPrimitive':0,'selectionTriangleRuns':runs,'selectionAnchors':anchors,'highlightNodes':patches,'defaultDrawCalls':1,'allHighlightsDrawCalls':len(doc['meshes'])}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--variant',choices=['male','female']);parser.add_argument('--output',type=pathlib.Path);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 version=bpy.context.scene['reed_asset_version']
 args.output=args.output or (ROOT/'assets/body-3d'/('v'+'.'.join(version.split('.')[:2])) if version!='3.0.0' else ROOT/'assets/body-3d')
 args.output.mkdir(parents=True,exist_ok=True)
 variants=[args.variant] if args.variant else ['male','female']
 path=args.output/'manifest.json'
 archived=ROOT/'art/body-3d'/('contract-v'+'.'.join(version.split('.')[:2])+'.json')
 contract=archived if archived.exists() else ROOT/'art/body-3d/contract.json'
 manifest=json.loads(contract.read_text());assert manifest['assetVersion']==version,'Scene and export contract versions must match'
 manifest['provenance']['sourceArchive']=os.path.relpath(ROOT/'art/body-3d/source-data.zip',args.output)
 manifest['variants']={v:export_variant(v,args.output) for v in variants}
 path.write_text(json.dumps(manifest,indent=2)+'\n')
 (args.output/'regions.json').write_text(json.dumps([{'id':r['id'],'label':r['storedAreaLabel']} for r in manifest['discomfortRegions']],indent=2)+'\n')
 print('EXPORTED',json.dumps({v:{k:d[k] for k in ['bytes','visibleTriangles','totalStoredTriangles','meshCount']} for v,d in manifest['variants'].items()}))

if __name__=='__main__':main()
