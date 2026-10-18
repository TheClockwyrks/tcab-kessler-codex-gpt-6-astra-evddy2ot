"""One-time authoring recipe. Requires the asset tools; never used by the build."""
import json, math, pathlib, subprocess, wave, array
ROOT=pathlib.Path(__file__).resolve().parents[1]
TMP=pathlib.Path('/tmp/kessler-author'); TMP.mkdir(exist_ok=True)
def run(tool,*args):
 subprocess.run([tool,*map(str,args)],check=True,stdout=subprocess.DEVNULL,cwd=TMP)
def save(path,data):
 pathlib.Path(path).write_text(json.dumps(data))
def raster(name,size,pixel,tool='draw'):
 ops=[]
 for y in range(size):
  for x in range(size):
   c=pixel(x+.5,y+.5)
   if c: ops.append(dict(op='set_pixel',x=x,y=y,color='#'+''.join(f'{max(0,min(255,int(v))):02x}' for v in c)))
 log=TMP/(name.replace('/','-')+'.json');save(log,ops)
 out=ROOT/'assets/sprites'/name;out.parent.mkdir(parents=True,exist_ok=True)
 run(tool,'render','--actions',log,'--out',out,'--width',size,'--height',size,'--no-layers')
def planet(x,y):
 u=(x-80)/70;v=(y-80)/70;r=math.hypot(u,v)
 if r>1:
  a=max(0,1-(r-1)/.12)**2*90
  return (80,179,213,a) if a>1 else None
 z=math.sqrt(1-r*r);light=max(.07,(-u*.5-v*.4+z*.7))
 terrain=math.sin(u*14+math.sin(v*12)*2)+math.cos(v*17+u*5)+.5*math.sin(u*39-v*27)
 base=(183,137,77) if terrain>.35 else (35,103,127)
 cloud=max(0,math.sin(v*35+math.sin(u*9)*3)+math.sin(u*18+v*12)-1.1)*.7
 return (*[(b*(1-cloud)+225*cloud)*light+12 for b in base],255)
raster('planet.png',160,planet)
colors=[(100,235,213),(255,105,101),(185,162,255),(111,197,255),(255,206,108)]
for idx,name in enumerate(['widen','narrow','multiball','shield','pierce']):
 def pod(x,y,idx=idx):
  u=x-12;v=y-12;d=abs(u)+abs(v)
  if d>14:return None
  c=colors[idx]
  if d>11:return (*c,230)
  mark= (abs(v)<1.2 and abs(u)<6) or (idx==0 and abs(abs(u)-5)<1 and abs(v)<4) or (idx==1 and abs(u)<1.2 and abs(v)<5) or (idx==2 and any(math.hypot(u-a,v-b)<2 for a,b in [(-4,3),(4,3),(0,-4)])) or (idx==3 and abs(math.hypot(u,v)-5)<1.1) or (idx==4 and abs(u+v*.5)<1.6 and abs(v)<7)
  return (*(c if mark else (16,35,48)),255)
 raster('pods/'+name+'.png',24,pod)
for frame in range(6):
 def ball(x,y,f=frame):
  u=x-12;v=y-12;r=math.hypot(u,v)
  if r>10:return None
  if r>8:return (125,222,255,(10-r)*60)
  z=math.sqrt(max(0,64-r*r));light=.45+.55*max(0,(-u-v+z)/14)
  stripe=math.sin(math.atan2(u,z)+f*math.pi/3+v*.13)>0.65
  base=(66,160,196) if stripe else (235,252,255)
  return (*(b*light for b in base),255)
 raster('ball/'+str(frame)+'.png',24,ball,'draw-sheet')
for name,col,count,speed,life in [('burst','#ffc67e',48,100,700),('spark','#9ceaff',20,85,360),('burnup','#ff8059',36,55,850)]:
 cfg=TMP/(name+'.json');save(cfg,dict(width=128,height=128,duration_ms=1200,fps=30,seed=42,actions=str(TMP/(name+'-ops.json')),preview=str(TMP/(name+'.gif')),system=str(ROOT/'assets/particles'/ (name+'.json'))))
 run('particle-2d','--config',cfg,'init')
 run('particle-2d','--config',cfg,'add-emitter','--name','debris','--shape','point','--x',64,'--y',64,'--burst',count,'--lifetime',life,'--lifetime-spread',150,'--speed',speed,'--speed-spread',30,'--cone-angle',180)
 run('particle-2d','--config',cfg,'set-particle','--emitter','debris','--size-from',1.3,'--size-to',0,'--opacity-from',1,'--opacity-to',0,'--color-gradient',f'#ffffff@0,{col}@0.25,#375376@1','--stretch',.03)
 run('particle-2d','--config',cfg,'render','--frame',10)
cues=[('paddle-bounce',620,110),('field-bounce',420,150),('target-hit',880,130),('target-break',190,420),('shield-reflect',1050,300),('pod-catch',740,260),('pod-catch-narrow',230,350),('pod-burn',155,380),('ball-lost',120,600),('wave-clear',520,850),('game-over',65,1800),('menu-move',1000,45),('menu-select',1300,90)]
for i,(name,freq,dur) in enumerate(cues):
 cfg=TMP/(name+'.json');save(cfg,dict(sample_rate=44100,channels='stereo',max_duration_ms=dur+200,seed=42,actions=str(TMP/(name+'-ops.json')),preview=str(TMP/(name+'.png')),wav=str(ROOT/'assets/audio'/(name+'.wav'))))
 run('sfx-synth','--config',cfg,'init')
 run('sfx-synth','--config',cfg,'add-voice','--name','body','--wave','sine','--freq',freq,'--gain',-13,'--dur',dur)
 run('sfx-synth','--config',cfg,'set-envelope','--voice','body','--env','pluck')
 run('sfx-synth','--config',cfg,'set-pitch','--voice','body','--slide-to',freq*(1.5 if name in ['pod-catch','wave-clear','menu-select'] else .45),'--over',dur)
 if i<11:
  run('sfx-synth','--config',cfg,'add-voice','--name','glass','--wave','triangle','--freq',freq*2.76,'--gain',-24,'--dur',dur*.65)
  run('sfx-synth','--config',cfg,'set-envelope','--voice','glass','--env','pluck')
 if name in ['target-break','ball-lost','game-over','pod-burn']:
  run('sfx-synth','--config',cfg,'add-voice','--name','dust','--wave','noise','--gain',-25,'--dur',dur*.6)
  run('sfx-synth','--config',cfg,'set-envelope','--voice','dust','--env','pluck')
 run('sfx-synth','--config',cfg,'render')
for name,tempo in [('title',96),('play',120)]:
 cfg=TMP/('music-'+name+'.json');out=ROOT/'assets/audio'/('music-'+name+'.wav')
 save(cfg,dict(sample_rate=44100,channels='stereo',max_duration_ms=30000,seed=42,actions=str(TMP/('music-'+name+'-ops.json')),preview=str(TMP/('music-'+name+'.png')),wav=str(out),mid=str(TMP/(name+'.mid'))))
 run('music','--config',cfg,'init');run('music','--config',cfg,'set-tempo','--bpm',tempo)
 for track,inst,gain in [('bass','sine',-23),('glass','triangle',-29),('air','sine',-30)]:
  run('music','--config',cfg,'define-track','--name',track,'--instrument',inst)
  run('music','--config',cfg,'set-track-fx','--track',track,'--gain',gain,'--env','gate')
 for beat in range(40):
  root=[38,34,41,36][(beat//8)%4]
  run('music','--config',cfg,'add-note','--track','bass','--pitch',root,'--t',beat,'--dur',.9,'--velocity',80)
  run('music','--config',cfg,'add-note','--track','glass','--pitch',root+24+[0,7,10,14][beat%4],'--t',beat,'--dur',.6,'--velocity',65)
  if beat%4==0:run('music','--config',cfg,'add-note','--track','air','--pitch',root+12,'--t',beat,'--dur',4,'--velocity',65)
 run('music','--config',cfg,'render')
 # Keep the interior eight-bar cycle, removing the synth's startup and tail.
 with wave.open(str(out),'rb') as w:params=w.getparams();data=w.readframes(w.getnframes())
 framebytes=params.sampwidth*params.nchannels; start=int(4*60/tempo*params.framerate);length=int(32*60/tempo*params.framerate)
 data=data[start*framebytes:(start+length)*framebytes]
 # A short circular crossfade makes the exact sample junction continuous.
 a=array.array('h',data);n=256*params.nchannels
 for j in range(n):
  t=j/n;a[len(a)-n+j]=int(a[len(a)-n+j]*(1-t)+a[j]*t)
 with wave.open(str(out),'wb') as w:w.setparams(params);w.writeframes(a.tobytes())
