/** Local dictionaries only. No UI text or user data is sent to a translation service. */
export const languages = Object.freeze([
  {code:'ru',label:'Русский',locale:'ru-RU'},
  {code:'en',label:'English',locale:'en-US'},
  {code:'tg',label:'Тоҷикӣ',locale:'tg-TJ'},
  {code:'uz',label:'O‘zbekcha',locale:'uz-UZ'},
  {code:'kk',label:'Қазақша',locale:'kk-KZ'},
  {code:'ky',label:'Кыргызча',locale:'ky-KG'},
  {code:'be',label:'Беларуская',locale:'be-BY'},
  {code:'hi',label:'हिन्दी',locale:'hi-IN'}
]);
const storageKey='mw-language';
const cache=new Map([['ru',{}]]);
const textSources=new WeakMap();
const attributeSources=new WeakMap();
const observedRoots=new WeakMap();
const attributes=['placeholder','aria-label','aria-description','title','alt'];
let language='ru',dictionary={},matcher=null,matcherValues=new Map(),request=0,initialized=false;
const normalize=value=>String(value??'').replace(/\s+/gu,' ').trim();
const regexEscape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const isLanguage=value=>languages.some(item=>item.code===value);
const skipped=element=>!element||element.closest('script,style,textarea,noscript,[data-i18n-skip],[contenteditable="true"]');
export const getLanguage=()=>language;
export const getLocale=()=>languages.find(item=>item.code===language)?.locale||'ru-RU';

async function loadDictionary(code){
  if(cache.has(code))return cache.get(code);
  const response=await fetch(new URL(`./locales/${code}.json`,import.meta.url));
  if(!response.ok)throw new Error(`Language dictionary is unavailable (${code}).`);
  const value=await response.json();
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.entries(value).some(([key,text])=>!key||typeof text!=='string'||!text.trim()))throw new Error(`Invalid language dictionary (${code}).`);
  cache.set(code,value);
  return value;
}
function configure(code,value){
  language=code;dictionary=value;matcherValues=new Map();
  // A single pass prevents translated output from being translated a second time.
  // Longest phrases win; Unicode boundaries avoid matching substrings inside names.
  const keys=Object.keys(value).filter(key=>normalize(key)&&value[key]!==key).sort((a,b)=>b.length-a.length);
  for(const key of keys)matcherValues.set(normalize(key),value[key]);
  matcher=keys.length?new RegExp(keys.map(key=>{
    const normal=normalize(key), escaped=normal.split(' ').map(regexEscape).join('\\s+');
    const left=/^[\p{L}\p{N}]/u.test(normal)?'(?<![\\p{L}\\p{N}])':'';
    const right=/[\p{L}\p{N}]$/u.test(normal)?'(?![\\p{L}\\p{N}])':'';
    return `${left}${escaped}${right}`;
  }).join('|'),'gu'):null;
  document.documentElement.lang=code;
}
export function t(value){
  const source=String(value??'');
  if(language==='ru'||!source.trim())return source;
  const key=normalize(source);
  if(Object.hasOwn(dictionary,key)){
    const start=source.match(/^\s*/u)?.[0]||'',end=source.match(/\s*$/u)?.[0]||'';
    return start+dictionary[key]+end;
  }
  return matcher?source.replace(matcher,matched=>matcherValues.get(normalize(matched))??matched):source;
}
function translateText(node){
  if(skipped(node.parentElement))return;
  const current=node.nodeValue||'';
  let previous=textSources.get(node);
  if(!previous||current!==previous.rendered)previous={source:current,rendered:current};
  const output=t(previous.source);
  if(current!==output)node.nodeValue=output;
  previous.rendered=output;textSources.set(node,previous);
}
function translateAttributes(element){
  if(skipped(element))return;
  // An option with no explicit value otherwise changes its submitted value when its label changes.
  if(element.tagName==='OPTION'&&!element.hasAttribute('value'))element.setAttribute('value',element.textContent||'');
  let saved=attributeSources.get(element);
  if(!saved){saved=new Map();attributeSources.set(element,saved)}
  for(const attribute of attributes){
    if(!element.hasAttribute(attribute))continue;
    const current=element.getAttribute(attribute)||'';
    let previous=saved.get(attribute);
    if(!previous||current!==previous.rendered)previous={source:current,rendered:current};
    const output=t(previous.source);
    if(output!==current)element.setAttribute(attribute,output);
    previous.rendered=output;saved.set(attribute,previous);
  }
}
export function translateDOM(root=document.body){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){translateText(root);return}
  if(root.nodeType===Node.ELEMENT_NODE)translateAttributes(root);
  for(const element of root.querySelectorAll?.('*')||[])translateAttributes(element);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;while((node=walker.nextNode()))translateText(node);
  const title=document.querySelector('title');
  if(title&&root!==title)for(const child of title.childNodes)if(child.nodeType===Node.TEXT_NODE)translateText(child);
}
function announce(){
  window.dispatchEvent(new CustomEvent('mw:languagechange',{detail:{language,locale:getLocale()}}));
}
export async function setLanguage(code,{persist=true}={}){
  if(!isLanguage(code))throw new Error('Unsupported language.');
  const serial=++request;
  const value=await loadDictionary(code);
  if(serial!==request)return language;
  configure(code,value);
  if(persist){try{localStorage.setItem(storageKey,code)}catch{}}
  translateDOM(document.body);
  announce();
  return language;
}
export async function initI18n(){
  if(initialized)return language;
  initialized=true;
  let preferred='ru';try{preferred=localStorage.getItem(storageKey)||'ru'}catch{}
  if(!isLanguage(preferred))preferred='ru';
  try{await setLanguage(preferred,{persist:false})}catch{configure('ru',{});translateDOM(document.body)}
  window.addEventListener('storage',event=>{
    if(event.key===storageKey&&isLanguage(event.newValue)&&event.newValue!==language)setLanguage(event.newValue,{persist:false}).catch(()=>{});
  });
  return language;
}
export function observeTranslations(root=document.body){
  if(!root)return()=>{};
  if(observedRoots.has(root))return observedRoots.get(root).stop;
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;translateDOM(root)});
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  const title=document.querySelector('title');if(title&&!root.contains(title))observer.observe(title,{subtree:true,childList:true,characterData:true});
  const stop=()=>{observer.disconnect();observedRoots.delete(root)};
  observedRoots.set(root,{observer,stop});translateDOM(root);return stop;
}
