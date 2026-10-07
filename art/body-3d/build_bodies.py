"""Rebuild Reed's anatomical family from the archived CC0 authored base data.
Run with Blender --background --python. No network is required.
"""
import bpy, numpy as np, pathlib, json, math, collections, sys, argparse
from mathutils import Vector
import tempfile,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=pathlib.Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
# The v3.3 silhouette revision is an edit of the saved v3.2 meshes. It cannot
# be recreated by the older foundation builder; use refine_bodies.py instead.
asset_version=json.loads((ROOT/'art/body-3d/contract-v3.2.json').read_text())['assetVersion']
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from anatomy import sculpt
_temp=tempfile.TemporaryDirectory(prefix='reed-body-source-');P=pathlib.Path(_temp.name)
with zipfile.ZipFile(ROOT/'art/body-3d/source-data.zip') as archive:archive.extractall(P)
source=np.load(P/'refined-base.npz',allow_pickle=False)
faces=source['faces'].tolist();ids=list(range(len(source['male'])))
neighbors=[set() for _ in ids]
for f in faces:
 for i,j in zip(f,f[1:]+f[:1]):neighbors[i].add(j);neighbors[j].add(i)
edge_a=np.array([i for i,ns in enumerate(neighbors) for j in ns]);edge_b=np.array([j for ns in neighbors for j in ns]);degree=np.maximum(1,np.array([len(ns) for ns in neighbors]))

def normals_of(a):
 me=bpy.data.meshes.new('normals');me.from_pydata(a.tolist(),[],faces);me.update();n=np.array([v.normal[:] for v in me.vertices]);bpy.data.meshes.remove(me);return n

def smooth(a,mask,iterations):
 a=a.copy()
 for _ in range(iterations):
  mean=np.stack([np.bincount(edge_a,weights=a[edge_b,c],minlength=len(a))/degree for c in range(3)],axis=1)
  a+=(mean-a)*mask[:,None]*.5
 return a

def arm_membership(a):
 x=np.abs(a[:,0]);z=a[:,2]
 cutoff=.185+np.clip(1.30-z,0,.5)*.40
 return ((x>cutoff)&(z>.68)).astype(float)

def selection_arm_membership(a):
 # The deformation mask is intentionally conservative, but is not an
 # anatomical selection boundary: it excluded the inner arm and forearm.
 # This authored boundary follows the gap between torso and relaxed arms.
 x=np.abs(a[:,0]);z=a[:,2]
 cutoff=.175+np.clip(1.25-z,0,.55)*.17
 return ((x>cutoff)&(z>.68)).astype(float)

def base_shape(female):
 a=source['male']*(1-female)+source['female']*female
 x=np.abs(a[:,0]);z=a[:,2]
 # Fair only the covered intimate area, keeping abdominal/gluteal anatomy.
 mask=((x<.070)&(z>.76)&(z<.94)).astype(float)*.8
 a=smooth(a,mask,12)
 a[:,2]-=a[:,2].min();a*=1.72/a[:,2].max()
 return a

def body_variations(a):
 n=normals_of(a);x=np.abs(a[:,0]);z=a[:,2];aw=arm_membership(a)
 t=np.clip((x-.17)/.06,0,1);arm_field=t*t*(3-2*t)
 torso=(1-arm_field)*np.exp(-((z-1.12)/.24)**4)
 legs=np.exp(-((z-.65)/.20)**4)*(1-aw)
 limb=arm_field*np.exp(-((z-1.18)/.20)**4)
 # Softening relaxes the relief while retaining the authored anatomical surface.
 fat=smooth(a,np.clip(torso*.85+legs*.35+limb*.35,0,1),22)
 bulk=.027*torso+.021*np.exp(-((z-.78)/.17)**4)*(1-aw)+.015*limb+.011*np.exp(-((z-.31)/.12)**4)
 bulk+=.022*torso*np.clip(-n[:,1],0,1)*np.exp(-((z-1.07)/.15)**2)
 # Keep the inward thigh boundary clear; fullness grows predominantly outward.
 inner=np.clip(-n[:,0]*np.sign(a[:,0]),0,1)
 clearance=1-inner*np.exp(-((z-.66)/.22)**4)*.85
 broad_n=smooth(n,np.ones(len(a)),18)
 broad_n/=np.maximum(np.linalg.norm(broad_n,axis=1,keepdims=True),1e-8)
 direction=broad_n.copy()
 torso_direction=np.stack([np.sign(a[:,0])*np.clip(x/.17,0,1),np.tanh((a[:,1]+.015)/.050),np.zeros(len(a))],axis=1)
 direction=direction*(1-torso[:,None])+torso_direction*torso[:,None]
 fat+=direction*(bulk*clearance)[:,None]
 mus=sculpt(a,n,strength=.40)
 muscular_bulk=.008*limb+.009*legs*np.exp(-((z-.67)/.18)**4)+.008*torso*np.exp(-((z-1.30)/.15)**4)
 mus+=broad_n*(muscular_bulk*clearance)[:,None]
 # Combined endpoint retains softness with a restrained share of muscle relief.
 both=fat+(mus-a)*.55
 # Approximate body composition does not resize individual fingers. Preserve
 # the small covered groin bridge as well; its thin triangles carry no muscle form.
 tx=np.clip((x-.30)/.035,0,1);tx=tx*tx*(3-2*tx)
 tz=np.clip((z-.91)/.05,0,1);tz=tz*tz*(3-2*tz)
 hand=1-tx*(1-tz)
 groin=1-np.exp(-((x/.05)**4+((z-.79)/.075)**4))
 r=(hand*groin)[:,None]
 # The inner upper arm is narrow and concave; gain volume predominantly on its
 # outer belly instead of expanding that fold into the torso.
 inner_arm=1-.85*np.exp(-((x-.205)/.032)**2-((z-1.17)/.075)**2)
 r*=inner_arm[:,None]
 fat=a+(fat-a)*r;mus=a+(mus-a)*r;both=a+(both-a)*r
 return fat,mus,both

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.name='Reed bodies';scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1

def mat(name,color,alpha=1,vertex=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,alpha);m.use_backface_culling=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.88;bs.inputs['Metallic'].default_value=0;bs.inputs['Alpha'].default_value=alpha
 if vertex:
  n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='coverage';m.node_tree.links.new(n.outputs['Color'],bs.inputs['Base Color'])
 if alpha<1:m.surface_render_method='DITHERED'
 return m
base=mat('reed_body_matte',(.39,.365,.33))
overlay=mat('reed_highlight',(.39,.365,.33),0)
vc=overlay.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='edge_fade'
mult=overlay.node_tree.nodes.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=0
bs=overlay.node_tree.nodes.get('Principled BSDF');overlay.node_tree.links.new(vc.outputs['Alpha'],mult.inputs[0]);overlay.node_tree.links.new(mult.outputs[0],bs.inputs['Alpha'])
# White vertex RGB leaves the runtime tint entirely configurable.
overlay.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
# Use an internal midpoint as the common topology/selection reference.
ref=base_shape(.5)
# Continuous arm membership separates limbs from adjacent torso surfaces.
arm=arm_membership(ref)
selection_arm=selection_arm_membership(ref)
back_safe=np.ones(len(faces),dtype=bool)
face_array=np.array(faces)
for sex in [0,.5,1]:
 coords=base_shape(sex)
 for sample in [coords,*body_variations(coords)]:
  cross=np.cross(sample[face_array[:,1]]-sample[face_array[:,0]],sample[face_array[:,2]]-sample[face_array[:,0]])
  back_safe&=(cross[:,1]/np.maximum(np.linalg.norm(cross,axis=1),1e-12))>.25

# Authored boundaries in normalized, feet-centered meters. Later shapes keep membership.
def classify(c,aw,n):
 x,y,z=c;ax=abs(x);side='left' if x>0 else 'right';pre=side+'_';front=n[1]<0
 if z>1.535:return None,None
 if z>1.435 and ax<.09:return 'neck',pre+'trapezius' if not front else None
 if aw>.48 or (ax>.18 and z>1.30):
  pain='shoulder' if z>1.135 else ('elbow' if z>1.035 else 'wrist')
  mus='deltoids' if z>1.295 else (('biceps' if front else 'triceps') if z>1.12 else ('forearms' if z>.88 else None))
  if mus in ('biceps','triceps'):pain=mus
  return pre+pain,pre+mus if mus else None
 if z<.14:return pre+('foot' if z<.08 else 'ankle'),None
 if z<.435:return pre+'calf',pre+('tibialis_anterior' if front else 'calves')
 if z<.535:return pre+'knee',None
 if z<.835:
  mus='adductors' if n[0]*(1 if x>0 else -1)<-.58 and z>.63 else ('quadriceps' if front else 'hamstrings')
  return pre+'thigh',pre+mus
 if z<.985:return pre+'hip',pre+('glutes' if not front else 'adductors')
 if front:return ('chest',pre+'pectorals') if z>1.20 else ('abdomen',pre+('obliques' if ax>.085 else 'abdominals'))
 if z<1.135:return 'lower_back',pre+'spinal_erectors'
 if z>1.38 or (ax<.055 and z>1.265):return 'upper_back',pre+'trapezius'
 if ax>.08 and z<1.29:return 'upper_back',pre+'latissimus_dorsi'
 return 'upper_back',pre+'mid_back'

# Triangulate once. Shared connectivity remains identical for every target and variant.
tris=faces
tri_uvs=source['tri_uvs']
tri_lookup={tuple(t):i for i,t in enumerate(tris)}
classifications=[classify(ref[t].mean(axis=0),selection_arm[t].mean(),np.cross(ref[t[1]]-ref[t[0]],ref[t[2]]-ref[t[0]])/(np.linalg.norm(np.cross(ref[t[1]]-ref[t[0]],ref[t[2]]-ref[t[0]]))+1e-12)) for t in tris]
(P/'classifications.json').write_text(json.dumps(classifications))

# Static point colors make fitted shorts and female chest coverage part of the same draw call.
def coverage(v,female):
 x,y,z=v
 shorts=.805<z<.935
 chest=female and 1.255<z<1.395 and abs(x)<.215
 return (.315,.294,.265,1) if shorts or chest else (.39,.365,.33,1)

def create_mesh(name,arrays,chosen,col,material,colors=False):
 used=sorted(set(i for t in chosen for i in t));mapping={i:j for j,i in enumerate(used)}
 me=bpy.data.meshes.new(name);me.from_pydata(arrays[0][used].tolist(),[],[[mapping[i] for i in t] for t in chosen]);me.update()
 ob=bpy.data.objects.new(name,me);col.objects.link(ob);me.materials.append(material)
 source_ids=me.attributes.new('reed_source_vertex','INT','POINT');source_ids.data.foreach_set('value',used)
 for p in me.polygons:p.use_smooth=True
 for key,a in zip(['Basis','adiposity','muscularity','fullness_corrective'],arrays):
  k=ob.shape_key_add(name=key);k.data.foreach_set('co',a[used].ravel());k.slider_min=0;k.slider_max=1
 if colors:
  uv=me.uv_layers.new(name='UVMap')
  for poly,t in zip(me.polygons,chosen):
   for li,coord in zip(poly.loop_indices,tri_uvs[tri_lookup[tuple(t)]]):uv.data[li].uv=coord
 else:
  me.normals_split_custom_set_from_vertices(normals[0][used].tolist())
  edges=collections.Counter(tuple(sorted((i,j))) for t in chosen for i,j in zip(t,t[1:]+t[:1]))
  boundary=set(i for e,count in edges.items() if count==1 for i in e)
  ca=me.color_attributes.new(name='edge_fade',type='FLOAT_COLOR',domain='POINT')
  ca.data.foreach_set('color',np.array([(1,1,1,0 if i in boundary else 1) for i in used]).ravel())
 ob['reed_role']='body' if name.endswith('_body') else 'highlight'
 return ob

def coverage_texture(variant):
 size=1024
 # Linear RGBA image; Blender encodes the packed PNG as sRGB.
 pixels=np.zeros((size,size,4),dtype=np.float32);pixels[:]=(.39,.365,.33,1)
 occupied=np.zeros((size,size),dtype=bool)
 for tri,uv in zip(tris,tri_uvs):
  q=uv*(size-1)
  lo=np.maximum(np.floor(q.min(axis=0)).astype(int)-1,0);hi=np.minimum(np.ceil(q.max(axis=0)).astype(int)+1,size-1)
  if np.any(hi<lo):continue
  yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v=np.stack([xx,yy],axis=-1)-q[0]
  e1=q[1]-q[0];e2=q[2]-q[0];det=e1[0]*e2[1]-e1[1]*e2[0]
  if abs(det)<1e-10:continue
  u=(v[...,0]*e2[1]-v[...,1]*e2[0])/det;w=(e1[0]*v[...,1]-e1[1]*v[...,0])/det
  inside=(u>=-.025)&(w>=-.025)&(u+w<=1.025)
  xyz=ref[tri[0]]+u[...,None]*(ref[tri[1]]-ref[tri[0]])+w[...,None]*(ref[tri[2]]-ref[tri[0]])
  z=xyz[...,2];aw=selection_arm[tri[0]]+u*(selection_arm[tri[1]]-selection_arm[tri[0]])+w*(selection_arm[tri[2]]-selection_arm[tri[0]])
  def smoothstep(low,high,value):
   t=np.clip((value-low)/(high-low),0,1);return t*t*(3-2*t)
  # Fitted coverage belongs in the authored atlas. Gentle edges and a near-clay
  # tone keep it from reading as a shadow or obscuring muscle highlights.
  cover=smoothstep(.795,.820,z)*(1-smoothstep(.920,.945,z))
  if variant=='female':
   chest=smoothstep(1.190,1.215,z)*(1-smoothstep(1.345,1.370,z))
   # Coverage follows the front chest; the back remains continuous matte clay.
   chest*=1-smoothstep(-.025,.025,xyz[...,1])
   cover=np.maximum(cover,chest)
  cover*=1-smoothstep(.1,.3,aw)
  region=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
  tint=np.array([.39,.365,.33,1])+(np.array([.375,.351,.317,1])-np.array([.39,.365,.33,1]))*cover[...,None]
  region[inside]=tint[inside]
  occupied[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=inside
 # Pad UV island borders so mipmapping cannot expose the unpainted atlas.
 for _ in range(5):
  sums=np.zeros_like(pixels);counts=np.zeros_like(occupied,dtype=np.float32)
  for axis,direction in [(0,-1),(0,1),(1,-1),(1,1)]:
   valid=np.roll(occupied,direction,axis);color=np.roll(pixels,direction,axis)
   if axis==0:valid[0 if direction==1 else -1,:]=False
   else:valid[:,0 if direction==1 else -1]=False
   sums+=color*valid[...,None];counts+=valid
  fill=(~occupied)&(counts>0);pixels[fill]=sums[fill]/counts[fill,None];occupied|=fill
 image=bpy.data.images.new(variant+'_coverage_1k',width=size,height=size,alpha=True)
 image.colorspace_settings.name='Linear Rec.709';image.pixels.foreach_set(pixels.ravel());image.filepath_raw=str(P/(variant+'-coverage.png'));image.file_format='PNG';image.save();image.pack()
 m=base.copy();m.name=variant+'_body_matte';node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 return m

variants=['male','female']
for variant in variants:
 female={'male':0,'female':1}[variant]
 a=base_shape(female);fat,mus,both=body_variations(a)
 # Keep authored bulk away from the concave axilla after baking the relaxed pose.
 # Smoothly fade deformation to zero in a 4cm core, back to full by 13cm.
 distance=np.sqrt((np.abs(a[:,0])-.150)**2+(a[:,2]-1.285)**2)
 t=np.clip((distance-.04)/.09,0,1);restraint=(t*t*(3-2*t))[:,None]
 fat=a+(fat-a)*restraint;mus=a+(mus-a)*restraint;both=a+(both-a)*restraint
 arrays=[a,fat,mus,a+(both-fat-mus+a)]
 col=bpy.data.collections.new(variant);scene.collection.children.link(col)
 body=create_mesh(variant+'_body',arrays,tris,col,coverage_texture(variant),variant)
 body['reed_variant']=variant
 # Surface patches use the same vertex positions plus a 0.35 mm outward offset.
 normals=[]
 for coords in arrays:
  me=bpy.data.meshes.new('normal_sample');me.from_pydata(coords.tolist(),[],tris);me.update();normals.append(np.array([v.normal[:] for v in me.vertices]));bpy.data.meshes.remove(me)
 # Offsets are fixed across morphs so the patches cannot stretch away from their source vertices.
 patch_arrays=[a+normals[0]*.00035 for a in arrays]
 for kind,index in [('pain',0),('muscle',1)]:
  names=sorted(set(p[index] for p in classifications if p[index]))
  for name in names:
   chosen=[t for t,c in zip(tris,classifications) if c[index]==name]
   if kind=='pain' and name.endswith('shoulder'):chosen=[t for t in chosen if ref[t].mean(axis=0)[2]>1.275]
   if kind=='pain' and name.endswith('wrist'):chosen=[t for t in chosen if .875<ref[t].mean(axis=0)[2]<1.025]
   if kind=='pain' and name in ['lower_back','upper_back']:
    # Keep dorsal tint inside the back-facing surface across the sex variants.
    chosen=[t for t in chosen if back_safe[tri_lookup[tuple(t)]]]
   ob=create_mesh(variant+'_'+kind+'_'+name,patch_arrays,chosen,col,overlay)
   ob['reed_role']=kind;ob['reed_id']=name;ob['reed_default_visible']=False
 # Source retains final triangle membership as face-domain attributes.
 for name,ind in [('pain',0),('muscle',1)]:
  labels=sorted(set(c[ind] for c in classifications if c[ind]));attr=body.data.attributes.new('reed_'+name+'_id','INT','FACE')
  attr.data.foreach_set('value',[labels.index(c[ind])+1 if c[ind] else 0 for c in classifications]);body['reed_'+name+'_labels']=json.dumps(labels)

# Preview stage, excluded from export.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=560;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Reed canvas');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.0056,.0053,.005,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.view_settings.view_transform='AgX'
for name,loc,power,size in [('key',(-3,-4,4),380,4),('fill',(3,-2,2.4),190,3),('back',(1,3,3),230,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Preview camera');cam=bpy.data.objects.new('Preview camera',d);scene.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=2.05;scene.camera=cam
cam.location=(0,-5,.86);cam.rotation_euler=(Vector((0,0,.86))-cam.location).to_track_quat('-Z','Y').to_euler()
for variant in variants:
 for ob in bpy.data.collections[variant].objects:
  ob.hide_render=variant!='male' or ob.get('reed_role')!='body'
  ob.hide_set(variant!='male' or ob.get('reed_role')!='body')
scene['reed_asset_version']=asset_version
scene['reed_export_contract']='See art/body-3d/contract.json and assets/body-3d/README.md'
scene['reed_morph_weights']='adiposity=f, muscularity=m, fullness_corrective=f*m on every mesh'
args.output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()),compress=True)
print('BUILT',len(tris),len(bpy.data.objects))
