import json,sys,hashlib
import PIL
from PIL import Image,ImageDraw,ImageFont
if '--metadata' in sys.argv:
 f=ImageFont.truetype('Helvetica.ttc',18)
 print(json.dumps({'pillowVersion':PIL.__version__,'fontSha256':hashlib.sha256(open(f.path,'rb').read()).hexdigest()}))
 sys.exit(0)
r=json.load(sys.stdin)
im=Image.new('RGB',(1500,1100),'#f3f0e5');d=ImageDraw.Draw(im)
font=ImageFont.truetype('Helvetica.ttc',18);small=ImageFont.truetype('Helvetica.ttc',15);title=ImageFont.truetype('Helvetica.ttc',25)
d.text((22,16),'A one-sided headland: three fixed local variants',font=title,fill='#263832')
d.text((22,50),'Fixed .13 root, unchanged lobe/bay intervals and targets. Largest paid body shown; no islands or world claim.',font=font,fill='#263832')
for k,v in enumerate(r['variants']):
 group=[x for x in r['reports'] if x['variant']==v['id']];p=group[0];c=p['candidate'];m=p['certificate']['metrics'];passed=sum(x['certificate']['ok'] for x in group)
 d.text((25+500*k,92),v['id']+' — '+str(passed)+'/15 local certificates',font=font,fill='#263832')
 for row in range(2):
  ox=250+500*k;oy=335+row*465;scale=200
  def pt(p):return(ox+p[0]*scale,oy-p[1]*scale)
  d.polygon([pt(p) for p in c['bodyBoundary']],fill='#344c49')
  if row:
   for j,(a,role) in enumerate(zip(c['attachments'],m['roles'])):
    d.polygon([pt(p) for p in a['polygon']],fill=['#698c5c','#72999e','#d38c43'][j])
    d.line([pt(p) for p in a['root']],fill='#be4033',width=3)
    d.line([pt(p) for p in a['collar']['far']],fill='#296d9f',width=3)
    q=pt(a['collar']['disk']);d.ellipse((q[0]-3,q[1]-3,q[0]+3,q[1]+3),fill='#192e30');d.text((q[0]+5,q[1]+6),['L1','L2','P'][j],font=small,fill='#152522')
   d.line([pt(p) for p in c['bay']['mouth']],fill='#a23f88',width=4)
 role=m['roles'][-1]
 d.text((25+500*k,1010),f"P share {role['share']:.5f}; extent upper {role['extentUpper']:.4f}",font=small,fill='#263832')
 d.text((25+500*k,1034),f"Width lower/upper {role['widthLower']:.4f}/{role['widthUpper']:.4f}",font=small,fill='#263832')
d.text((22,1070),'Red = fixed root; blue = far cut. V1 fails all five balanced widths; V2/V3 fail area share. No fourth trial.',font=font,fill='#913c32')
im.save(sys.stdout.buffer,format='PNG')
