import type { Metadata } from 'next';
import type { Locale } from '../content/home';
import routes from '../content/routes.json';
// Canonical origin comes from the route manifest shared with the export scripts and the sitemap.
const origin=routes.origin;
export function pageMetadata(locale:Locale,path:string,title:string,description:string):Metadata {
 const url=origin+(locale==='fr'?'/fr/':'/')+path;
 // Default share image: one per language (name and title of that language beside the tree, decision S2).
 const image=path==='projects/droit-de-retard/'?'/images/droit-de-retard-social.jpg':locale==='fr'?'/og-arbre-fr.jpg':'/og-arbre-en.jpg';
 return {title,description,metadataBase:new URL(origin),icons:{icon:'/favicon.svg'},robots:{index:process.env.SITE_PUBLIC==='1',follow:process.env.SITE_PUBLIC==='1'},alternates:{canonical:url,languages:{en:origin+'/'+path,fr:origin+'/fr/'+path,'x-default':origin+'/'+path}},openGraph:{title,description,type:'website',url,locale:locale==='fr'?'fr_FR':'en_GB',alternateLocale:locale==='fr'?'en_GB':'fr_FR',siteName:'Arnaud Durand',images:[{url:origin+image,width:1200,height:630,alt:path==='projects/droit-de-retard/'?(locale==='fr'?'droit-de-retard : aperçu du prototype':'droit-de-retard: prototype preview'):(locale==='fr'?'Arnaud Durand, ingénieur logiciel':'Arnaud Durand, Software Engineer')}]},twitter:{card:'summary_large_image',title,description,images:[origin+image]}};
}
