"""Authored surface relief on a continuous anatomical mesh, in Blender meters.

Muscle bellies, insertions and shallow divisions are displacements, never separate
primitive geometry. Coordinates refer to the relaxed 1.72 m reference pose.
"""
import numpy as np

def sculpt(points, normals, strength=1.0):
    p=np.asarray(points);x=np.abs(p[:,0]);y=p[:,1];z=p[:,2]
    front=np.clip(-normals[:,1],0,1)**2
    back=np.clip(normals[:,1],0,1)**2
    side=np.abs(normals[:,0])
    d=np.zeros(len(p))
    def oval(cx,cz,rx,rz,angle=0):
        u=x-cx;v=z-cz;c=np.cos(angle);s=np.sin(angle)
        return np.exp(-((u*c-v*s)/rx)**2-((u*s+v*c)/rz)**2)
    # Pectoral fan and sternum. Inferior edge slopes up toward the axilla.
    d+=front*(.008*oval(.090,1.265,.082,.065,-.14)
        -.0015*oval(.086,1.209,.082,.019,-.10)
        -.0015*oval(0,1.287,.014,.08))
    # Paired rectus abdominis bellies, linea alba, tendinous intersections.
    for h,w in [(1.161,.036),(1.101,.038),(1.042,.035)]:
        d+=front*(.006*oval(.042,h,w*1.25,.038)
            -.0008*oval(.048,h-.028,.059,.012))
    d-=front*.0015*oval(0,1.096,.012,.115)
    d+=front*.003*oval(.040,.981,.043,.048)
    # External oblique sweep; three serratus slips below the pectoral fan.
    d+=front*.004*oval(.118,1.066,.045,.100,-.40)
    for h in [1.204,1.172,1.140]:
        d+=front*.0015*oval(.135,h,.037,.017,.50)
    # Deltoid cap and the distinct anterior/posterior arm bellies.
    d+=.006*oval(.190,1.350,.058,.075,.3)*np.clip((z-1.26)/.08,0,1)
    d+=front*.005*oval(.245,1.216,.041,.100,-.36)
    d+=back*.006*oval(.244,1.211,.043,.103,-.36)
    d+=front*.003*oval(.341,1.002,.030,.090,-.30)
    d+=back*.003*oval(.338,1.018,.032,.090,-.30)
    # Trapezius diamond, scapular forms, latissimus sweep and spinal columns.
    d+=back*(.015*oval(.044,1.408,.045,.060,-.5)
        +.016*oval(.053,1.307,.035,.067,.38)
        +.019*oval(.105,1.327,.050,.043,-.30)
        -.0045*oval(.109,1.280,.048,.011,-.35)
        -.003*oval(.075,1.343,.010,.055,-.35)
        +.019*oval(.115,1.194,.039,.103,.26)
        +.008*oval(.035,1.080,.019,.135)
        -.003*oval(0,1.274,.010,.178))
    # Quadriceps: rectus, lateral sweep and medial teardrop above the knee.
    d+=front*(.018*oval(.103,.664,.032,.115,-.10)
        +.018*oval(.160,.674,.038,.117,-.16)
        +.010*oval(.090,.537,.026,.050,.28)
        -.003*oval(.127,.655,.010,.093,-.13))
    # Hamstring heads; calf heads and the tibialis ridge remain distinct.
    d+=back*(.010*oval(.127,.654,.027,.104,.12)
        +.013*oval(.181,.644,.030,.112,-.08)
        +.012*oval(.120,.315,.028,.082,.08)
        +.011*oval(.159,.322,.027,.081,-.09)
        -.002*oval(.140,.317,.008,.071))
    d+=front*.006*oval(.169,.278,.021,.115,-.10)
    # Gluteal volume. Preserve the gluteal fold rather than painting muscle lines.
    d+=back*.014*oval(.105,.879,.064,.067,.16)
    # Preserve the concave axilla; defining adjacent bellies must not inflate
    # the arm into the torso or turn the armpit into intersecting folds.
    distance=np.sqrt((x-.175)**2+(z-1.275)**2)
    t=np.clip((distance-.045)/.055,0,1)
    d*=t*t*(3-2*t)
    return p+normals*d[:,None]*strength
