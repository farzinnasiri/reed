"""Validate exported geometry, deformation, metadata and fresh Blender reimports.
Run using Blender --background --python art/body-3d/validate_assets.py.
"""
import pathlib,sys,json,hashlib,argparse
import bpy,numpy as np
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(pathlib.Path(__file__).parent))
from export_assets import read_glb,accessor,gltf_coords,synchronize_patches
parser=argparse.ArgumentParser();parser.add_argument('--input',type=pathlib.Path,default=ROOT/'assets/body-3d');parser.add_argument('--source',type=pathlib.Path,default=ROOT/'art/body-3d/reed-bodies.blend');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
P=args.input.resolve();manifest=json.loads((P/'manifest.json').read_text());results={}
for variant,entry in manifest['variants'].items():
 path=P/entry['filename'];doc,bin=read_glb(path);assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
 nodes={n['name']:n for n in doc['nodes']};assert set(nodes)=={'body'}|{x['node'] for x in entry['highlightNodes']}
 bm=doc['meshes'][nodes['body']['mesh']];p=bm['primitives'][0];base=accessor(doc,bin,p['attributes']['POSITION']);targets=[accessor(doc,bin,t['POSITION']) for t in p['targets']];triangles=accessor(doc,bin,p['indices']).ravel().reshape(-1,3)
 expected=['adiposity','muscularity','fullness_corrective'];assert bm['extras']['targetNames']==expected;assert bm['weights']==[0,0,0]
 assert all('uri' not in b for b in doc['buffers']) and all('bufferView' in im for im in doc['images']);assert len(doc['materials'])==2
 runs=entry['selectionTriangleRuns'];assert sum(r[1] for r in runs)==len(triangles);assert runs[0][0]==0
 for a,b in zip(runs,runs[1:]):assert a[0]+a[1]==b[0]
 labels=[r[2] for r in runs for _ in range(r[1])];centers=base[triangles].mean(axis=1)
 for i,label in enumerate(labels):
  if label and label.startswith('left_'):assert centers[i,0]>0
  if label and label.startswith('right_'):assert centers[i,0]<0
 tree=KDTree(len(base))
 for i,v in enumerate(base):tree.insert(v,i)
 tree.balance();offset_errors=[];normal_errors=[];patchdata=[]
 bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
 source_base,source_normals=synchronize_patches(bpy.data.objects[variant+'_body'],bpy.data.collections[variant])
 offset_tree=KDTree(len(source_base))
 for i,v in enumerate(gltf_coords(source_base+source_normals*.00035)):offset_tree.insert(v,i)
 offset_tree.balance();source_to_export=np.array([tree.find(v)[1] for v in gltf_coords(source_base)])
 for info in entry['highlightNodes']:
  node=nodes[info['node']];m=doc['meshes'][node['mesh']];q=m['primitives'][0];assert m['extras']['targetNames']==expected;assert m['weights']==[0,0,0];assert 'COLOR_0' in q['attributes']
  pos=accessor(doc,bin,q['attributes']['POSITION']);targs=[accessor(doc,bin,t['POSITION']) for t in q['targets']]
  correspondence=[offset_tree.find(v) for v in pos];assert max(m[2] for m in correspondence)<2e-6
  matches=source_to_export[[m[1] for m in correspondence]];offset=pos-base[matches]
  assert np.max(np.linalg.norm(offset,axis=1))<.00036
  for a,b in zip(targs,targets):offset_errors.append(float(np.max(np.linalg.norm(a-b[matches],axis=1))))
  bn=accessor(doc,bin,p['attributes']['NORMAL']);pn=accessor(doc,bin,q['attributes']['NORMAL']);normal_errors.append(float(np.max(np.abs(pn-bn[matches]))))
  assert doc['materials'][q['material']]['alphaMode']=='BLEND';assert not doc['materials'][q['material']].get('doubleSided',False)
  patchdata.append((pos,targs,matches,offset))
 assert max(offset_errors)<3e-7;assert max(normal_errors)==0
 unique,inverse=np.unique(np.round(base,7),axis=0,return_inverse=True);welded_triangles=inverse[triangles]
 morphs=[]
 for f,m in [(0,0),(1,0),(0,1),(1,1),(.5,.5)]:
  a=base+f*targets[0]+m*targets[1]+f*m*targets[2];assert np.isfinite(a).all()
  norms=np.cross(a[triangles[:,1]]-a[triangles[:,0]],a[triangles[:,2]]-a[triangles[:,0]]);areas=np.linalg.norm(norms,axis=1)*.5
  original=np.cross(base[triangles[:,1]]-base[triangles[:,0]],base[triangles[:,2]]-base[triangles[:,0]])
  flipped=int(np.count_nonzero((norms*original).sum(axis=1)<0))
  assert np.min(areas)>1e-12;assert flipped==0,(variant,f,m,flipped)
  # Measured inner-thigh clearance below the connected groin, away from the feet.
  leg=a[(a[:,1]>.50)&(a[:,1]<.70)];gap=2*float(np.min(np.abs(leg[:,0])))
  assert gap>.002,(variant,'thigh gap',gap)
  welded=np.zeros((len(unique),3));welded[inverse]=a
  tree=BVHTree.FromPolygons(welded.tolist(),welded_triangles.tolist(),all_triangles=True)
  overlaps=[(i,j) for i,j in tree.overlap(tree) if i<j and not set(welded_triangles[i])&set(welded_triangles[j]) and welded[welded_triangles[i]].mean(axis=0)[1]<1.48 and welded[welded_triangles[j]].mean(axis=0)[1]<1.48]
  assert not overlaps,(variant,f,m,'nonadjacent surface intersections',len(overlaps))
  morphs.append({'nonadjacentBelowNeckIntersections':len(overlaps),'adiposity':f,'muscularity':m,'fullness_corrective':f*m,'flippedTriangles':flipped,'minimumTriangleAreaM2':float(np.min(areas)),'innerThighClearanceM':gap,'bounds':{'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist()}})
 # Actual import into a fresh Blender scene, independent of the authoring scene.
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==entry['meshCount']
 for o in meshes:assert [k.name for k in o.data.shape_keys.key_blocks][1:]==expected
 assert sum(1 for im in bpy.data.images if im.packed_file)==1
 results[variant]={'sha256':entry['sha256'],'freshBlenderReimport':True,'meshCount':len(meshes),'anatomicalLeftRight':'passed all classified triangles','selectionCoverage':'contiguous final-export triangle runs, including explicit null areas','maximumPatchMorphDeltaErrorM':max(offset_errors),'maximumPatchNormalError':max(normal_errors),'morphChecks':morphs}
path=P/'geometry-validation.json';path.write_text(json.dumps(results,indent=2)+'\n');print('GEOMETRY_VALIDATION_OK',json.dumps({v:{'reimport':r['freshBlenderReimport'],'patchError':r['maximumPatchMorphDeltaErrorM']} for v,r in results.items()}))
