// Printed images and prepared cut geometry are not paintable vector artwork.
export function isUnpreparedArtwork(item){
 if(!item||['png','cut-vector','cut','bleed'].includes(item.data?.kind)||item.className==='Raster')return false;
 return !item.children||item.children.every(isUnpreparedArtwork);
}
export function canStyleArtworkSelection(items){return items.length>0&&items.every(isUnpreparedArtwork);}
export function automaticCutCandidates(items){return items.filter(isUnpreparedArtwork);}
