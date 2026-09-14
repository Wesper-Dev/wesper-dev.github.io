"""Check the actual static artifact, including deep links and metadata."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote, urljoin
import argparse, json, re, sys, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'dist/client'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--public',action='store_true')
parser.add_argument('--private-patterns',type=Path,help='Optional private JSON array of regular expressions; keep outside public sources')
args=parser.parse_args()
public=args.public
patterns=[r'\bRNCP\b',r'\bAlumni\b',r'\+33[ .]?[1-9]',r'data/profil\.json',r'/Users/']
if args.private_patterns:
 patterns.extend(json.loads(args.private_patterns.read_text()))
forbidden=re.compile('|'.join(patterns),re.I)
origin='https://wesper-dev.github.io'
paths=['','projects/','hackathons/','projects/droit-de-retard/','projects/diary/','projects/croix-rouge/']
routes=['/'+prefix+p for prefix in ['', 'fr/'] for p in paths]
class Page(HTMLParser):
 def __init__(self,content):
  super().__init__();self.links=[];self.assets=[];self.ids=set();self.meta={};self.lang=None;self.headings=0;self.feed(content)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='html':self.lang=a.get('lang')
  if tag=='h1':self.headings+=1
  if tag=='a' and 'href' in a:self.links.append(a['href'])
  if tag in ['script','img'] and 'src' in a:self.assets.append(a['src'])
  if tag=='link':
   if a.get('rel')=='stylesheet':self.assets.append(a['href'])
   if a.get('rel')=='canonical':self.meta['canonical']=a['href']
   if a.get('rel')=='alternate':self.meta[a.get('hreflang')]=a['href']
  if tag=='meta':self.meta[a.get('name',a.get('property'))]=a.get('content')
def canonical(url):
 u=urlparse(url);return u._replace(path=u.path or '/').geturl()
def file_for(path):
 p=root/unquote(path.lstrip('/'))
 return p/'index.html' if path.endswith('/') else p
pages={r:Page(file_for(r).read_text()) for r in routes}
errors=[]
def check(condition,message):
 if not condition:errors.append(message)
for route,p in pages.items():
 check(p.headings==1,route+' h1')
 check(p.lang==('fr' if route.startswith('/fr/') else 'en'),route+' html lang')
 check(canonical(p.meta.get('canonical',''))==origin+route,route+' canonical')
 path=route[4:] if route.startswith('/fr/') else route[1:]
 check(canonical(p.meta.get('en',''))==origin+'/'+path and canonical(p.meta.get('fr',''))==origin+'/fr/'+path,route+' hreflang')
 check(bool(p.meta.get('description')),route+' description')
 check(('noindex' not in p.meta.get('robots','')) if public else ('noindex' in p.meta.get('robots','')),route+' robots')
 for key in ['og:image','twitter:image']:
  image=p.meta.get(key,'');check(image.startswith(origin+'/') and file_for(urlparse(image).path).is_file(),route+' '+key)
 for link in p.links+p.assets:
  u=urlparse(urljoin(origin+route,link))
  if u.scheme not in ['http','https'] or u.netloc!='wesper-dev.github.io':continue
  f=file_for(u.path);check(f.is_file(),route+' missing '+link)
  if u.fragment and f.is_file() and f.suffix=='.html':check(u.fragment in Page(f.read_text()).ids,route+' missing anchor '+link)
 for asset in p.assets:check(not asset.startswith(('http:','https:','//')),route+' external asset '+asset)
check('Disallow: /' not in (root/'robots.txt').read_text() if public else 'Disallow: /' in (root/'robots.txt').read_text(),'robots.txt mode')
sitemap=ET.parse(root/'sitemap.xml');locs={e.text for e in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
check(locs=={origin+r for r in routes},'sitemap routes')
four=Page((root/'404.html').read_text());check('noindex' in four.meta.get('robots','') and '/' in four.links and '/fr/' in four.links,'custom bilingual 404')
for p in root.rglob('*'):
 if p.is_file() and p.suffix in ['.html','.js','.json','.rsc','.css','.txt']:
  text=p.read_text(errors='replace');check(not forbidden.search(text),'private/stale text '+str(p.relative_to(root)))
report={'mode':'public' if public else 'preview','routes':len(routes),'errors':errors}
print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(bool(errors))
