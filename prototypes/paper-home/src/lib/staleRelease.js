// A tab opened before a release asks for page files that the release has replaced. A fresh load gets the new ones.
const MISSING_PAGE_FILE=/dynamically imported module|Importing a module script failed|Unable to preload CSS/i;
const KEY='korislab-release-reload',WAIT_MS=60_000;
export const isMissingPageFile=error=>MISSING_PAGE_FILE.test(error?.message??'');
// One try a minute, so a file that is really gone ends on the error page and not in a reload loop.
export function canReloadForRelease(error,{storage,online=true,now=Date.now()}){
 if(!online||!isMissingPageFile(error))return false;
 try{return !(now-Number(storage.getItem(KEY))<WAIT_MS);}catch{return false;}
}
export function markReload(storage,now=Date.now()){storage.setItem(KEY,String(now));}
