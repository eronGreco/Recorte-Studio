// Numeric starting points for CAMEO 4 + AutoBlade, checked 2026-10-17.
// Manufacturer recommendations apply to their named products, not every paper of similar weight.
const gm='https://www.gmcrafts.co.uk/silhouette-cameo-4-cut-settings/';
const ol='https://www.onlinelabels.com/articles/silhouette-cameo-4-sticker-paper-cut-settings';
const calibration='https://silhouetteamerica.freshdesk.com/support/solutions/articles/35000206256-performing-a-test-cut-how-to-find-optimal-settings';
const preset=(id,label,depth,force,speed,passes,source,reference,note='')=>Object.freeze({id,label,settings:Object.freeze({depth,force,speed,passes}),source,reference,note});
// These are editor calibration starting points, not manufacturer-tested photo-paper recipes.
// GM Crafts publishes 3/25/3/2 for its non-adhesive glossy card. The editor slows
// heavier duplex photo stock and increases blade exposure, pending a physical test.
const photo=(gsm,depth,force,speed)=>Object.freeze({...preset('photo-glossy-duplex-'+gsm,
 'Papel Fotográfico Glossy - Frente e Verso - Não Adesivo · '+gsm+' g/m² · corte total',depth,force,speed,2,
 calibration,'Ajuste inicial do Recorte Studio · AutoBlade · corte total',
 'Valores iniciais do editor, sem validação física para sua marca. Referência de papel revestido: '+gm+'. A Silhouette orienta ajustar lâmina à espessura e testar força/passadas; gramatura não equivale à espessura.'),
 initial:true,grammage:gsm,adhesive:false,cutMode:'through',
 description:'Corte total: atravessar a folha inteira, sem meio-corte. Fixe na base de corte. Valores iniciais para testar no seu papel de '+gsm+' g/m²; todos continuam editáveis.'});
export const MATERIAL_PRESETS=Object.freeze([
 photo(180,3,20,3),photo(220,4,25,2),photo(240,4,25,2),
 preset('gm-card','Cartolina lisa · GM Crafts A4',4,14,4,1,gm,'GM Crafts · GMS A4 Craft card'),
 preset('gm-special-card','Cartolina especial / glitter · GM Crafts',3,25,3,2,gm,'GM Crafts · A4 Glitter / Speciality card'),
 preset('gm-paper','Papel adesivo / kraft · GM Crafts',1,15,5,1,gm,'GM Crafts · A4 printable self adhesive paper'),
 preset('ol-matte-kiss','Adesivo fosco · só a camada adesiva',3,4,3,1,ol,'OnlineLabels · OL177WX · AutoBlade 2','Velocidade 3 e uma passada são pontos de partida do editor; a tabela informa lâmina e força para este corte.'),
 preset('ol-matte-full','Adesivo fosco · cortar também o suporte',3,16,3,2,ol,'OnlineLabels · OL177WX · AutoBlade 2','Velocidade 3 é um ponto de partida do editor; a tabela informa lâmina, força e passadas.'),
 preset('ol-gloss-kiss','Adesivo fotográfico glossy inkjet · só adesivo',3,12,3,1,ol,'OnlineLabels · OL177WG · AutoBlade 2','Velocidade 3 e uma passada são pontos de partida do editor; a tabela informa lâmina e força para este corte.'),
 preset('ol-gloss-full','Adesivo fotográfico glossy inkjet · corte total',3,24,3,2,ol,'OnlineLabels · OL177WG · AutoBlade 2','Velocidade 3 é um ponto de partida do editor; a tabela informa lâmina, força e passadas.'),
 preset('ol-kraft-full','Papel adesivo kraft · corte total',3,24,3,2,ol,'OnlineLabels · OL177BK · AutoBlade 2','Velocidade 3 é um ponto de partida do editor; a tabela informa lâmina, força e passadas.'),
 preset('ol-card','Papel cartão · OnlineLabels',4,20,3,2,ol,'OnlineLabels · OL267KW · AutoBlade 2','Velocidade 3 é um ponto de partida do editor; a tabela informa lâmina, força e passadas.')
]);
let userMaterials=[];
export const setUserMaterials=items=>{userMaterials=items;};
export const allMaterialPresets=()=>[...MATERIAL_PRESETS,...userMaterials];
export const materialPreset=id=>allMaterialPresets().find(p=>p.id===id);
export const matchesMaterial=(p,settings,overcut)=>!!p&&Object.keys(p.settings).every(k=>settings?.[k]===p.settings[k])&&(!p.user||!overcut||['enabled','startMm','endMm'].every(k=>p.overcut[k]===overcut[k]));
const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim();
export function searchMaterials(query){const words=normalized(query).split(' ').filter(Boolean);return allMaterialPresets().filter(p=>{const text=normalized(p.label+' '+p.reference);return words.every(word=>text.includes(word));});}
