export const RELEASES_URL='https://github.com/eronGreco/Recorte-Studio/releases/latest';
export const RELEASES_API='https://api.github.com/repos/eronGreco/Recorte-Studio/releases/latest';
export function versionParts(version){const m=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);if(!m)throw Error('Versão inválida.');return m.slice(1).map(Number);}
export function compareVersions(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
export async function checkRelease({currentVersion,fetchImpl=fetch,timeoutMs=9000}={}){
 try{
  versionParts(currentVersion);
  const response=await fetchImpl(RELEASES_API,{headers:{Accept:'application/vnd.github+json','User-Agent':'Recorte-Studio/'+currentVersion},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error('GitHub indisponível.');
  const text=await response.text();if(text.length>1000000)throw Error('Resposta muito grande.');
  const release=JSON.parse(text);if(release.draft||release.prerelease)throw Error('Versão não publicada.');
  const latestVersion=versionParts(release.tag_name).join('.');
  const status=compareVersions(latestVersion,currentVersion)>0?'available':'current';
  return{status,currentVersion,latestVersion,releaseUrl:RELEASES_URL};
 }catch{return{status:'unavailable',currentVersion,releaseUrl:RELEASES_URL};}
}
