"""Prepare the archived anatomical foundation from Blender Studio's pinned bundle.
Run Blender --background /path/to/human_base_meshes_bundle.blend --python art/body-3d/prepare_base.py
The result is art/body-3d/refined-base.npz; archive it as source-data.zip before rebuilding.
The official CC0 release URL and archive SHA-256 are recorded in PROVENANCE.json.
"""
import bpy,numpy as np,pathlib,sys
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from mathutils import Vector
R=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(R/'art/body-3d'));from anatomy import sculpt
samples={}
for sex,st in [('male',1.8),('female',1.15)]:
 o=bpy.data.objects['GEO-body_'+sex+'_realistic'];o.hide_set(False)
 for m in o.modifiers:
  if m.type=='MULTIRES':m.levels=1;m.show_viewport=True
 bpy.context.view_layer.update();e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=e.to_mesh()
 a=np.array([v.co[:] for v in me.vertices]);a[:,2]-=a[:,2].min();a*=1.72/a[:,2].max()
 n=np.array([v.normal[:] for v in me.vertices]);a=sculpt(a,n,strength=st)
 # Separate neighboring toes through upstream authored face-set membership.
 fs=me.attributes['.sculpt_face_set'];toe=np.zeros(len(a));count=np.zeros(len(a))
 digit_sets=[{31,36,37,46,47},{27,32,38,42,48,49,50,51},{28,33,39,43,52,53,54,55},{29,34,40,44,56,57,58,59},{30,35,41,45,60,61,62,63}]
 for poly,label in zip(me.polygons,fs.data):
  for digit,labels in enumerate(digit_sets):
   if label.value in labels:
    for i in poly.vertices:toe[i]+=digit-1;count[i]+=1
 toe/=np.maximum(count,1)
 edges=[]
 for poly in me.polygons:
  vs=list(poly.vertices)
  for i,j in zip(vs,vs[1:]+vs[:1]):edges.extend([(i,j),(j,i)])
 edges=np.unique(np.array(edges),axis=0);ea,eb=edges.T;deg=np.maximum(np.bincount(ea,minlength=len(a)),1)
 for _ in range(8):toe=.5*toe+.5*np.bincount(ea,weights=toe[eb],minlength=len(a))/deg
 a[:,0]+=np.sign(a[:,0])*toe*.011

 # Reduce the male chest's forward projection while retaining its pectoral fan.
 # This is an anterior displacement, not an all-around inflation of the chest.
 if sex=='male':
  chest=np.exp(-((np.abs(a[:,0])-.085)/.082)**2-((a[:,2]-1.259)/.057)**2)
  a[:,1]+=.012*chest*np.clip(-n[:,1],0,1)
 # Mild forearm pronation presents the backs of the relaxed hands obliquely.
 # Rotate the whole distal hand together; blend the twist through the forearm.
 for side in [-1,1]:
  pivot=np.array([side*.380,-.072,.900]);axis=np.array([side*.35,-.32,-.88]);axis/=np.linalg.norm(axis)
  t=np.clip((1.08-a[:,2])/.16,0,1);t=t*t*(3-2*t)
  mask=np.clip((a[:,0]*side-.23)/.07,0,1);mask=mask*mask*(3-2*mask)*(a[:,2]>.65)
  angle=side*np.deg2rad(28)*t*mask
  v=a-pivot;c=np.cos(angle)[:,None];s=np.sin(angle)[:,None]
  a=pivot+v*c+np.cross(axis,v)*s+axis[None,:]*(v@axis)[:,None]*(1-c)
 samples[sex]=a
 if sex=='male':
  faces=[list(p.vertices) for p in me.polygons];uv=np.array([v.uv[:] for v in me.uv_layers[0].data]);loops=[list(p.loop_indices) for p in me.polygons]
 e.to_mesh_clear()
print('HIGH',len(faces),len(samples['male']))
# The identical vertex correspondence survives different cyclic polygon starts.
bpy.ops.wm.read_factory_settings(use_empty=True);me=bpy.data.meshes.new('reference');mid=(samples['male']+samples['female'])*.5
me.from_pydata(mid.tolist(),[],faces);me.update();o=bpy.data.objects.new('reference',me);bpy.context.scene.collection.objects.link(o)
# Preserve upstream seams but repack UDIM islands into one mobile atlas.
ul=me.uv_layers.new(name='UVMap')
for poly,ls in zip(me.polygons,loops):
 coords=uv[ls];offset=np.floor(coords.mean(axis=0));coords-=offset
 for li,c in zip(poly.loop_indices,coords):ul.data[li].uv=c
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(rotate=True,scale=True,margin=.004);bpy.ops.object.mode_set(mode='OBJECT')
me.calc_loop_triangles();tri=np.array([t.vertices[:] for t in me.loop_triangles]);tree=BVHTree.FromPolygons(mid.tolist(),tri.tolist(),all_triangles=True)
mod=o.modifiers.new('mobile reduction','DECIMATE');mod.ratio=28000/(len(tri));mod.use_collapse_triangulate=True
bpy.context.view_layer.update();e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());low=e.to_mesh();low.calc_loop_triangles()
p=np.array([v.co[:] for v in low.vertices]);fa=np.array([t.vertices[:] for t in low.loop_triangles]);lu=np.array([[low.uv_layers[0].data[l].uv[:] for l in t.loops] for t in low.loop_triangles]);new={}
for sex in ['male','female']:
 vals=[];disp=samples[sex]-mid
 for point in p:
  loc,n,idx,d=tree.find_nearest(Vector(point));t=tri[idx]
  # Interpolate the sex displacement, retaining decimation's chosen neutral point.
  delta=barycentric_transform(loc,*[Vector(mid[j]) for j in t],*[Vector(disp[j]) for j in t]);vals.append(point+np.array(delta))
 new[sex]=np.array(vals)
np.savez_compressed(R/'art/body-3d/refined-base.npz',male=new['male'],female=new['female'],faces=fa,tri_uvs=lu)
print('LOW',len(p),len(fa),'bounds',p.min(axis=0),p.max(axis=0),'uv',lu.min(axis=(0,1)),lu.max(axis=(0,1)))
