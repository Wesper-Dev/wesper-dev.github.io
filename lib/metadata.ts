import type { Metadata } from 'next';
import type { Locale } from '../content/home';
const origin='https://wesper-dev.github.io';
export function pageMetadata(locale:Locale,path:string,title:string,description:string):Metadata {
 const url=origin+(locale==='fr'?'/fr/':'/')+path;
 const image=path==='projects/droit-de-retard/'?'/images/droit-de-retard.png':'/og.jpg';
 return {title,description,metadataBase:new URL(origin),icons:{icon:'/favicon.svg'},robots:{index:process.env.SITE_PUBLIC==='1',follow:process.env.SITE_PUBLIC==='1'},alternates:{canonical:url,languages:{en:origin+'/'+path,fr:origin+'/fr/'+path,'x-default':origin+'/'+path}},openGraph:{title,description,type:'website',url,locale:locale==='fr'?'fr_FR':'en_US',alternateLocale:locale==='fr'?'en_US':'fr_FR',siteName:'Arnaud Durand',images:[{url:origin+image,width: image==='/og.jpg'?1200:1440,height:image==='/og.jpg'?630:1180,alt:path==='projects/droit-de-retard/'?'Droit de Retard — demo interface':'Arnaud Durand — AI, Systems, Projects'}]},twitter:{card:'summary_large_image',title,description,images:[origin+image]}};
}
