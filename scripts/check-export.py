"""Check the actual static artifact, including deep links and metadata.

Usage: python3 scripts/check-export.py [--public] [--dist <dir>] [--private-patterns <file>]
Always prints a JSON report {mode, routes, errors} on stdout; exits 1 when errors is not empty.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote, urljoin
import argparse, json, posixpath, re, sys, xml.etree.ElementTree as ET

site=Path(__file__).resolve().parents[1]
manifest_path=site/'content'/'routes.json'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--public',action='store_true')
parser.add_argument('--dist',type=Path,default=site/'dist'/'client',help='Exported directory to check (default: dist/client)')
parser.add_argument('--private-patterns',type=Path,help='Optional private JSON array of regular expressions; keep outside public sources')
args=parser.parse_args()
public=args.public
errors=[]
report={'mode':'public' if public else 'preview','routes':None,'errors':errors}

def finish():
 print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(1 if errors else 0)

def check(condition,message):
 if not condition:errors.append(message)

# ---- Route manifest (shared with normalize-export.mjs and the sitemap) ----

# Canonical origin: scheme and lowercase host only (no port, path, trailing slash, user or IPv6 literal).
# normalize-export.mjs applies the same expression.
ORIGIN_RE=re.compile(r'https?://[a-z0-9-]+(?:\.[a-z0-9-]+)*')

def manifest_errors(data):
 """Same rules as validateManifest() in normalize-export.mjs."""
 if not isinstance(data,dict):return ['content/routes.json must be a JSON object with origin and paths']
 found=[]
 extra=sorted(set(data)-{'origin','paths'})
 if extra:found.append('content/routes.json has unknown keys: '+', '.join(extra))
 origin=data.get('origin')
 if not isinstance(origin,str) or not origin:found.append('content/routes.json: origin is missing or not a non-empty string')
 elif not ORIGIN_RE.fullmatch(origin):
  found.append('content/routes.json: origin must be a scheme and a lowercase host, without port, path or trailing slash, got '+json.dumps(origin))
 paths=data.get('paths')
 if not isinstance(paths,list):
  found.append('content/routes.json: paths must be an array of strings');return found
 seen=set()
 for i,p in enumerate(paths):
  label='content/routes.json: paths['+str(i)+'] '+json.dumps(p)
  if not isinstance(p,str):found.append(label+' is not a string');continue
  if p in seen:found.append(label+' is listed twice')
  seen.add(p)
  if p=='':continue
  if not p.endswith('/'):found.append(label+' must end with a slash')
  if p.startswith('/'):found.append(label+' must not start with a slash')
  segments=p.rstrip('/').split('/')
  if any(s in ('','.','..') for s in segments):found.append(label+' has an empty or dot segment')
  if segments[0]=='fr':found.append(label+' must not start with fr/ (French routes are derived)')
  if not re.fullmatch(r'[a-z0-9/-]+',p):found.append(label+' may only contain lowercase letters, digits, hyphens and slashes')
 if '' not in seen:found.append('content/routes.json: paths must contain the home page ""')
 return found

try:
 manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
except FileNotFoundError:
 errors.append('content/routes.json not found: '+str(manifest_path));finish()
except (OSError,ValueError,UnicodeDecodeError) as e:
 errors.append('content/routes.json is unreadable or not valid JSON: '+type(e).__name__+': '+str(e));finish()
bad=manifest_errors(manifest)
if bad:errors.extend(bad);finish()
origin=manifest['origin']
host=urlparse(origin).netloc
routes=['/'+prefix+p for p in manifest['paths'] for prefix in ['', 'fr/']]
report['routes']=len(routes)
listed=set(routes)

root=args.dist.resolve()
if not root.is_dir():
 errors.append('export directory not found (--dist): '+str(args.dist));finish()

# ---- Text patterns ----

# Private or stale wording, searched in every text file of the export.
patterns=[r'\bRNCP\b',r'\bAlumni\b',r'data/profil\.json',r'/Users/',r'\btourne(?:nt)? en production\b',r'\brun(?:s|ning) in production\b']
if args.private_patterns:
 try:
  extra=json.loads(args.private_patterns.read_text(encoding='utf-8'))
  if not isinstance(extra,list) or not all(isinstance(x,str) for x in extra):
   errors.append('--private-patterns: the file must contain a JSON array of strings (private patterns not applied)')
  else:
   for x in extra:re.compile(x)
   patterns.extend(extra)
 except re.error as e:errors.append('--private-patterns: a private pattern does not compile ('+str(e)+'); private patterns not applied')
 except (OSError,ValueError,UnicodeDecodeError) as e:errors.append('--private-patterns: unreadable private patterns file ('+type(e).__name__+')')
forbidden=re.compile('|'.join(patterns),re.I)
# French phone numbers: national (01 23 45 67 89) or international (+33 1 23 45 67 89, 0033…), groups separated by
# nothing, a space, a dot, a hyphen or a (narrow) no-break space. A complete number is required, bounded by non-digits,
# so measures (+33.5 %, +331 ms), dates and coordinates do not match.
SEP=r'[ .\-   ]?'
INTL=r'(?:\+|00)'+SEP+r'33'+SEP+r'(?:\(0\)'+SEP+r')?[1-9](?:'+SEP+r'\d{2}){4}'
NATIONAL=r'0[1-9](?:'+SEP+r'\d{2}){4}'
intl_phone=re.compile(r'(?<![\w+])'+INTL+r'(?!\d)')
any_phone=re.compile(r'(?<![\w+])(?:'+INTL+r'|'+NATIONAL+r')(?!\d)')
# Attributes shown to readers or used as link targets.
SHOWN_ATTRS={'alt','title','aria-label','placeholder','content','href'}
# Elements that break the visible text into separate lines; every other element is inline.
BLOCKS={'address','article','aside','blockquote','br','dd','details','dialog','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','pre','section','summary','table','tbody','td','tfoot','th','thead','tr','ul','body','html','head','title','option','select','textarea','button','img','svg','video','audio','canvas','iframe'}
HIDDEN={'script','style','template','noscript'}
# Expected file types of resources, by kind.
RESOURCE_TYPES={'script':{'.js','.mjs'},'modulepreload':{'.js','.mjs'},'stylesheet':{'.css'},'image':{'.jpg','.jpeg','.png','.webp','.avif','.gif','.svg','.ico'},'media':{'.mp4','.webm','.mp3','.ogg','.vtt'},'font':{'.woff2','.woff','.ttf','.otf'}}

def read(path,what):
 try:return path.read_text(encoding='utf-8')
 except FileNotFoundError:errors.append(what+' missing: '+(path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)))
 except (OSError,UnicodeDecodeError) as e:errors.append(what+' unreadable: '+type(e).__name__+': '+str(e))
 return None

class Page(HTMLParser):
 def __init__(self,content):
  super().__init__(convert_charrefs=True)
  self.links=[];self.resources=[];self.ids=set();self.meta={};self.robots=[];self.lang=None;self.headings=0
  self.canonicals=[];self.alternates={};self.lines=[];self.buf=[];self.shown=[];self.tel=[];self.hidden=0
  self.ldjson=[];self.in_ld=False;self.scripts=[]
  # Script loads by kind (entry scripts, module preloads, script preloads) and inline script bodies.
  self.script_srcs=[];self.module_preloads=[];self.script_preloads=[];self.inline=[];self.in_inline=False
  self.feed(content);self.close();self.flush()
 def flush(self):
  text=re.sub(r'[ \t\n\r\f]+',' ',''.join(self.buf)).strip()
  if text:self.lines.append(text)
  self.buf=[]
 def handle_starttag(self,tag,attrs):
  a={k:(v or '') for k,v in attrs}
  rel=a.get('rel','').lower().split()
  if tag in BLOCKS:self.flush()
  if 'id' in a:self.ids.add(a['id'])
  if tag=='html':self.lang=a.get('lang')
  if tag=='h1':self.headings+=1
  if tag in HIDDEN:self.hidden+=1
  if tag=='script':
   self.in_ld=a.get('type','').lower()=='application/ld+json'
   if self.in_ld:self.ldjson.append('')
   if a.get('src'):self.resources.append(('script',a['src']));self.scripts.append(a['src']);self.script_srcs.append(a['src'])
   elif not self.in_ld:self.in_inline=True;self.inline.append('')
  if tag in ('a','area') and 'href' in a:self.links.append(a['href'])
  if tag in ('img','source') and a.get('src'):self.resources.append(('image' if tag=='img' else 'media',a['src']))
  if tag in ('video','audio','track') and a.get('src'):self.resources.append(('media',a['src']))
  if tag=='iframe' and a.get('src'):self.links.append(a['src'])
  if tag=='link' and a.get('href'):
   if 'stylesheet' in rel:self.resources.append(('stylesheet',a['href']))
   if 'modulepreload' in rel:self.resources.append(('modulepreload',a['href']));self.scripts.append(a['href']);self.module_preloads.append(a['href'])
   if 'preload' in rel and a.get('as','').lower()=='script':self.script_preloads.append(a['href'])
   if 'icon' in rel:self.resources.append(('image',a['href']))
   if 'preload' in rel:self.resources.append(({'script':'script','style':'stylesheet','image':'image','font':'font'}.get(a.get('as',''),'media'),a['href']))
  if tag=='link':
   if 'canonical' in rel:self.canonicals.append(a.get('href',''))
   if 'alternate' in rel and 'hreflang' in a:self.alternates.setdefault(a['hreflang'],[]).append(a.get('href',''))
  if tag=='meta':
   name=(a.get('name') or a.get('property') or '')
   self.meta[name]=a.get('content')
   if name.lower()=='robots' or name.lower().endswith('bot'):self.robots.append(a.get('content') or '')
  for k,v in a.items():
   if k=='href' and re.match(r'\s*(tel|callto|sms):',v,re.I):self.tel.append(v)
   if k in SHOWN_ATTRS and not (tag=='meta' and (a.get('name') or a.get('property') or '').startswith(('og:image','twitter:image'))):self.shown.append(unquote(v))
 def handle_startendtag(self,tag,attrs):
  self.handle_starttag(tag,attrs)
  if tag in HIDDEN and self.hidden:self.hidden-=1
 def handle_endtag(self,tag):
  if tag in BLOCKS:self.flush()
  if tag in HIDDEN and self.hidden:self.hidden-=1
  if tag=='script':self.in_ld=False;self.in_inline=False
 def handle_data(self,data):
  if self.in_inline:self.inline[-1]+=data
  if self.in_ld:self.ldjson[-1]+=data
  elif not self.hidden:self.buf.append(data)

def canonical(url):
 u=urlparse(url);return u._replace(path=u.path or '/').geturl()

def page_file(path):
 """Navigation links, resolved like the static server: a directory, with or without a slash, serves its index."""
 p=root/unquote(path.lstrip('/'))
 if path.endswith('/') or p.is_dir():return p/'index.html'
 return p

def resource_file(path):
 """Resources (scripts, styles, images) are fetched as files: no directory index, no redirect."""
 return root/unquote(path.lstrip('/'))

def label_of(f):
 return f.relative_to(root).as_posix()

def resource_errors(where,kind,url):
 u=urlparse(urljoin(origin+where,url))
 if u.scheme in ('data','blob'):return []
 if u.scheme not in ('http','https') or u.netloc!=host:return [where+' external '+kind+' '+url]
 f=resource_file(u.path)
 if u.path.endswith('/') or not f.is_file():return [where+' missing '+kind+' '+url+' (resources are not resolved to a directory index)']
 allowed=RESOURCE_TYPES.get(kind)
 if allowed and f.suffix.lower() not in allowed:return [where+' '+kind+' '+url+' is a '+(f.suffix or 'extensionless')+' file, expected '+'/'.join(sorted(allowed))]
 return []

def phone_in_ldjson(value):
 """True when a JSON-LD document carries a telephone or fax field, or a phone number in any string."""
 if isinstance(value,dict):
  for k,v in value.items():
   if k.lower() in ('telephone','faxnumber') and v not in (None,'',[]):return True
   if phone_in_ldjson(v):return True
 elif isinstance(value,list):return any(phone_in_ldjson(v) for v in value)
 elif isinstance(value,str):return bool(any_phone.search(value))
 return False

# ---- Module graph: real static and dynamic imports of each exported module ----

STATIC_IMPORTS=[
 re.compile(r'''(?<![\w$.])import\s*(?:[\w$*{}\s,]+?\s*from\s*)?(["'])([^"'\n]+)\1'''),
 re.compile(r'''(?<![\w$.])export\s*(?:\*(?:\s*as\s*[\w$]+)?|\{[\w$\s,]*\})\s*from\s*(["'])([^"'\n]+)\1'''),
]
DYNAMIC_IMPORT=re.compile(r'''(?<![\w$.])import\s*\(\s*(["'`])([^"'`\n$]+)\1\s*[,)]''')
# Vite's preload list for dynamic imports: paths relative to the site base.
VITE_DEPS=re.compile(r'''m\.f\s*=\s*\[([^\]]*)\]''')
# Client reference map of the router entry ("<id>":async()=>{… import("./chunk.js") …}) and the
# client references written in a page's flight data (I["<id>",…], JSON-escaped inside the HTML).
CLIENT_REFERENCE=re.compile(r'''["']([0-9a-f]{8,})["']\s*:\s*async\b[^{}]*\{[^{}]*?\bimport\s*\(\s*[`"']([^`"'\n]+)[`"']''')
FLIGHT_REFERENCE=re.compile(r'''\bI\[\\?"([0-9a-f]{8,})\\?"''')

def resolve_spec(module_url,spec):
 spec=spec.split('?')[0].split('#')[0]
 if spec.startswith(('./','../')):return posixpath.normpath(posixpath.join(posixpath.dirname(module_url),spec))
 if spec.startswith('/'):return posixpath.normpath(spec)
 return None  # bare or remote specifier: not part of the static export

def module_graph():
 graph={}
 for f in sorted(root.rglob('*.js'))+sorted(root.rglob('*.mjs')):
  text=read(f,'module')
  if text is None:continue
  url='/'+label_of(f)
  static=[(m[1],resolve_spec(url,m[1])) for p in STATIC_IMPORTS for m in p.findall(text)]
  dynamic=[(m[1],resolve_spec(url,m[1])) for m in DYNAMIC_IMPORT.findall(text)]
  deps=[(d,'/'+d) for block in VITE_DEPS.findall(text) for d in re.findall(r'''["']([^"']+\.m?js)["']''',block)]
  graph[url]={'static':[t for _,t in static if t],'dynamic':[t for _,t in dynamic if t],'all':[x for x in static+dynamic+deps if x[1]]}
 return graph

def module_exists(url):
 f=resource_file(url)
 return f.is_file() and f.suffix in ('.js','.mjs')

def static_closure(graph,entries):
 reached=set();queue=list(entries)
 while queue:
  url=queue.pop()
  if url in reached:continue
  reached.add(url)
  queue.extend(graph.get(url,{}).get('static',[]))
 return reached

try:
 # ---- Manifest -> export: every route has its directory index ----
 pages={}
 for r in routes:
  f=page_file(r)
  if f.is_file():
   text=read(f,r+' page')
   if text is not None:pages[r]=Page(text)
  else:errors.append(r+' missing '+label_of(f)+' (manifest route not exported)')

 # ---- Export -> manifest: no directory index or flat page outside the manifest ----
 flat_exceptions={'404.html','missing.html','fr.html'}
 for f in sorted(root.rglob('*.html')):
  rel=label_of(f)
  if f.name=='index.html':
   route='/'+rel[:-len('index.html')]
   check(route in listed,rel+' is exported for '+route+', which is not in content/routes.json')
  elif rel not in flat_exceptions:
   route='/'+rel[:-len('.html')]+'/'
   check(route in listed,rel+' is an exported page without a route in content/routes.json')

 # ---- Per page: structure, metadata, links and resources ----
 page_cache={}
 def ids_of(f):
  if f not in page_cache:
   text=read(f,'link target')
   page_cache[f]=Page(text).ids if text is not None else set()
  return page_cache[f]
 for route,p in pages.items():
  check(p.headings==1,route+' h1 (exactly one expected, got '+str(p.headings)+')')
  check(p.lang==('fr' if route.startswith('/fr/') else 'en'),route+' html lang')
  check([canonical(c) for c in p.canonicals]==[origin+route],route+' canonical (exactly one, '+origin+route+', expected; got '+json.dumps(p.canonicals)+')')
  path=route[4:] if route.startswith('/fr/') else route[1:]
  expected={'en':origin+'/'+path,'fr':origin+'/fr/'+path,'x-default':origin+'/'+path}
  for lang,href in expected.items():
   got=[canonical(h) for h in p.alternates.get(lang,[])]
   check(got==[href],route+' hreflang '+lang+' (exactly one, '+href+', expected; got '+json.dumps(got)+')')
  for lang in sorted(set(p.alternates)-set(expected)):errors.append(route+' unexpected hreflang '+lang)
  check(bool((p.meta.get('description') or '').strip()),route+' description')
  check(canonical(p.meta.get('og:url') or '')==origin+route,route+' og:url')
  # Every robots meta counts: crawlers apply the most restrictive directive.
  directives={t.strip().lower() for content in p.robots for t in content.split(',') if t.strip()}
  if public:
   check(bool(p.robots) and not directives&{'noindex','nofollow','none'},route+' robots meta (index, follow expected in every robots meta, got '+json.dumps(p.robots)+')')
  else:
   check(bool(directives&{'noindex','none'}) and bool(directives&{'nofollow','none'}),route+' robots meta (noindex, nofollow expected, got '+json.dumps(p.robots)+')')
  for key in ['og:image','twitter:image']:
   image=p.meta.get(key) or ''
   if not image.startswith(origin+'/'):errors.append(route+' '+key+' must be an absolute URL on '+origin);continue
   errors.extend(resource_errors(route,'image',image))
  for link in p.links:
   u=urlparse(urljoin(origin+route,link))
   if u.scheme not in ['http','https'] or u.netloc!=host:continue
   f=page_file(u.path)
   check(f.is_file(),route+' missing '+link)
   if u.fragment and f.is_file() and f.suffix=='.html':check(unquote(u.fragment) in ids_of(f),route+' missing anchor '+link)
  for kind,url in p.resources:errors.extend(resource_errors(route,kind,url))

 # ---- llms.txt (lot 6a, V5, X4): UTF-8, every cited URL on the origin and exported (external ones in ## Optional only), every route and both CV PDFs cited ----
 llms=root/'llms.txt'
 if not llms.is_file():errors.append('llms.txt missing (public/llms.txt)')
 else:
  try:llms_text=llms.read_bytes().decode('utf-8')
  except UnicodeDecodeError:errors.append('llms.txt is not valid UTF-8');llms_text=None
  if llms_text is not None:
   cited=re.findall(r'^- \[[^\]]+\]\((\S+?)\)',llms_text,re.M)
   # External https links are admitted in the "## Optional" section only (lot 6a, X4); their closed list is
   # checked by the tests (V5), not here, and they are not looked for in the export.
   optional=llms_text.split('\n## Optional\n',1)[1].split('\n## ',1)[0] if '\n## Optional\n' in llms_text else ''
   external=set(re.findall(r'^- \[[^\]]+\]\((https://\S+?)\)',optional,re.M))
   for u in cited:
    if u in external and not u.startswith(origin+'/'):continue
    if not u.startswith(origin+'/'):errors.append('llms.txt cites '+u+', outside '+origin);continue
    if not page_file(u[len(origin):]).is_file():errors.append('llms.txt cites '+u[len(origin):]+', which is missing from the export')
   for r in routes+['/cv/arnaud-durand-cv-platform-en.pdf','/cv/arnaud-durand-cv-platform-fr.pdf']:
    if origin+r not in cited:errors.append('llms.txt does not cite '+r)

 # ---- robots.txt, read by user-agent group (RFC 9309) ----
 robots_text=read(root/'robots.txt','robots.txt')
 if robots_text is not None:
  groups=[];sitemaps=[];current=None;last_was_agent=False
  for raw in robots_text.splitlines():
   line=raw.split('#',1)[0].strip()
   if not line or ':' not in line:continue
   key,value=(s.strip() for s in line.split(':',1));key=key.lower()
   if key=='user-agent':
    if not last_was_agent:current={'agents':[],'rules':[]};groups.append(current)
    current['agents'].append(value.lower());last_was_agent=True
   elif key in ('allow','disallow'):
    last_was_agent=False
    if current is None:errors.append('robots.txt has a '+key+' rule outside any User-agent group')
    else:current['rules'].append((key,value))
   elif key=='sitemap':sitemaps.append(value)
  star=[g for g in groups if '*' in g['agents']]
  check(bool(star),'robots.txt has no "User-agent: *" group')
  blocks_all=lambda g:('disallow','/') in g['rules'] and not any(k=='allow' and v for k,v in g['rules'])
  if public:
   for g in groups:check(('disallow','/') not in g['rules'],'robots.txt mode: public export must not block everything for '+', '.join(g['agents']))
   check(sitemaps==[origin+'/sitemap.xml'],'robots.txt mode: public export must point to '+origin+'/sitemap.xml only, got '+json.dumps(sitemaps))
  else:
   for g in groups:check(blocks_all(g),'robots.txt mode: preview export must block everything (Disallow: /, no Allow) for '+', '.join(g['agents']))

 # ---- sitemap.xml: urlset/url/loc, one entry per route, three exact alternates each ----
 SM='{http://www.sitemaps.org/schemas/sitemap/0.9}';XH='{http://www.w3.org/1999/xhtml}'
 OPTIONAL={SM+'lastmod':re.compile(r'\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?'),SM+'changefreq':re.compile(r'always|hourly|daily|weekly|monthly|yearly|never'),SM+'priority':re.compile(r'0(\.\d+)?|1(\.0+)?')}
 if (root/'sitemap.xml').is_file():
  try:
   tree=ET.parse(root/'sitemap.xml');top=tree.getroot()
  except ET.ParseError as e:
   errors.append('sitemap.xml is not well-formed XML: '+str(e));top=None
  if top is not None:
   if top.tag!=SM+'urlset':errors.append('sitemap.xml root element must be urlset, got '+top.tag)
   else:
    locs=[]
    for i,url in enumerate(top):
     if url.tag!=SM+'url':errors.append('sitemap.xml child '+str(i+1)+' must be url, got '+url.tag);continue
     loc_nodes=[c for c in url if c.tag==SM+'loc']
     if len(loc_nodes)!=1:errors.append('sitemap.xml entry '+str(i+1)+' must have exactly one loc');continue
     loc=(loc_nodes[0].text or '').strip();locs.append(loc)
     for c in url:
      if c.tag in OPTIONAL:
       check(len([d for d in url if d.tag==c.tag])==1,'sitemap.xml entry '+loc+' repeats '+c.tag)
       check(bool(OPTIONAL[c.tag].fullmatch((c.text or '').strip())),'sitemap.xml entry '+loc+' has an invalid '+c.tag.split('}')[1]+' value')
      elif c.tag not in (SM+'loc',XH+'link'):errors.append('sitemap.xml entry '+loc+' has unexpected element '+c.tag)
     route=loc[len(origin):] if loc.startswith(origin) else None
     if route not in listed:continue
     path=route[4:] if route.startswith('/fr/') else route[1:]
     expected={'en':origin+'/'+path,'fr':origin+'/fr/'+path,'x-default':origin+'/'+path}
     got={}
     for c in url:
      if c.tag!=XH+'link':continue
      if c.get('rel')!='alternate':errors.append('sitemap.xml entry '+loc+' has a link that is not rel="alternate"')
      got.setdefault(c.get('hreflang'),[]).append(c.get('href'))
     for lang,href in expected.items():
      check(got.get(lang)==[href],'sitemap.xml entry '+loc+' alternate '+lang+' (exactly one, '+href+', expected; got '+json.dumps(got.get(lang))+')')
     for lang in sorted(set(got)-set(expected),key=str):errors.append('sitemap.xml entry '+loc+' unexpected alternate '+str(lang))
    expected_locs={origin+r for r in routes}
    for loc in sorted({l for l in locs if locs.count(l)>1}):errors.append('sitemap.xml lists '+loc+' more than once')
    for loc in sorted(expected_locs-set(locs)):errors.append('sitemap.xml lacks manifest route '+loc)
    for loc in sorted(set(locs)-expected_locs):errors.append('sitemap.xml lists '+loc+', which is not in content/routes.json')
 else:errors.append('sitemap.xml missing: sitemap.xml')

 # ---- Bilingual 404 ----
 four_text=read(root/'404.html','404.html')
 if four_text is not None:
  four=Page(four_text)
  check('noindex' in (four.meta.get('robots') or '') and '/' in four.links and '/fr/' in four.links,'404.html: custom bilingual 404 (noindex, links to / and /fr/) expected')
 check((root/'.nojekyll').is_file(),'.nojekyll missing')

 # ---- Modules: every import resolves; modules imported on demand stay out of every page's static graph ----
 graph=module_graph()
 for url,info in sorted(graph.items()):
  for spec,target in info['all']:
   check(module_exists(target),url.lstrip('/')+' imports '+spec+', which is missing from the export ('+target.lstrip('/')+')')
 # Entry scripts of the pages (<script src>): the framework router, whose import() map serves every page.
 page_entries={urlparse(urljoin(origin+route,s)).path for route,p in pages.items() for kind,s in p.resources if kind=='script'}
 # Modules imported with import() by application code (not by a page entry script, i.e. the framework's router).
 on_demand={}
 for url,info in graph.items():
  if url in page_entries:continue
  for target in info['dynamic']:on_demand.setdefault(target,set()).add(url)
 for route,p in pages.items():
  entries=[urlparse(urljoin(origin+route,s)).path for s in p.scripts]
  reached=static_closure(graph,entries)
  for target in sorted(set(on_demand)&reached):
   errors.append(route+' statically reaches '+target.lstrip('/')+', which is only meant to be loaded on demand (import() in '+', '.join(sorted(u.lstrip('/') for u in on_demand[target]))+')')
 # Client components. The script entries every route shares (runtime, framework, router) are the
 # framework entries; the router maps each client reference id to the module that holds it. Any other
 # script a document loads (<script src>, modulepreload, preload as=script) must be reached from the
 # framework entries or from a client reference written in the document's own React flight data
 # (inline scripts that push to the RSC stream, never visible text). This keeps a component chunk,
 # the tree island of the home page for instance, on the pages that render it, aliases and 404 included.
 html_docs={}
 for f in sorted(root.rglob('*.html')):
  text=read(f,'page')
  if text is not None:html_docs[label_of(f)]=Page(text)
 doc_route={label_of(page_file(r)):r for r in routes}
 def doc_path(doc,url):
  where=doc_route.get(doc,'/'+doc)
  return urlparse(urljoin(origin+where,url)).path
 entry_sets=[{doc_path(d,u) for u in p.script_srcs} for d,p in html_docs.items() if d in doc_route]
 framework_entries=set.intersection(*entry_sets) if entry_sets else set()
 client_refs={}
 for url in sorted(framework_entries):
  text=read(resource_file(url),'module') if module_exists(url) else None
  if text is None:continue
  for ref_id,spec in CLIENT_REFERENCE.findall(text):
   target=resolve_spec(url,spec)
   if target:client_refs[ref_id]=target
 framework_closure=static_closure(graph,framework_entries)
 for doc,p in html_docs.items():
  flight=''.join(t for t in p.inline if 'rsc' in t and '.push(' in t)
  ids=sorted(set(FLIGHT_REFERENCE.findall(flight)))
  if ids and not client_refs:
   errors.append(doc+': client references '+', '.join(ids)+' cannot be resolved, the router format of this build is not understood by check-export.py');continue
  allowed=framework_closure|static_closure(graph,[client_refs[i] for i in ids if i in client_refs])
  for url in p.script_srcs+p.module_preloads+p.script_preloads:
   path=doc_path(doc,url)
   if path not in allowed:
    errors.append(doc+' loads '+path.lstrip('/')+', which neither the framework entries nor the client components of this page need')
 # ---- Privacy and stale text ----
 for f in sorted(root.rglob('*.html')):
  text=read(f,'page')
  if text is None:continue
  p=Page(text);label=label_of(f)
  if p.tel:errors.append(label+' has a phone link ('+str(len(p.tel))+' tel:/callto:/sms: href)')
  if any(any_phone.search(line) for line in p.lines):errors.append(label+' displays a phone number in its text')
  if any(any_phone.search(v) for v in p.shown):errors.append(label+' has a phone number in a shown or link attribute')
  for block in p.ldjson:
   try:found=phone_in_ldjson(json.loads(block))
   except ValueError:found=bool(any_phone.search(block))
   if found:errors.append(label+' has a telephone in its structured data (JSON-LD)')
 for f in root.rglob('*'):
  if f.is_file() and f.suffix in ['.html','.js','.mjs','.json','.rsc','.css','.txt','.xml']:
   text=f.read_text(encoding='utf-8',errors='replace')
   check(not forbidden.search(text),'private/stale text '+label_of(f))
   check(not intl_phone.search(text),'international phone number in '+label_of(f))
except Exception as e:  # never lose the report: an unexpected failure is itself an error
 errors.append('check-export.py internal error: '+type(e).__name__+': '+str(e))
finish()
