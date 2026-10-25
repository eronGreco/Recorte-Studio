import {cutAppearance} from './cut-appearance.mjs';

// Only the screen preview receives trajectories. Printed pages remain artwork + marks.
export function machineCutPreview(svg,paths,style){
 const appearance=cutAppearance(style);
 const lines=paths.flatMap(path=>path.motions||[path]).map(path=>{
  const d='M'+path.quantizedPointsMm.map(point=>point.join(',')).join('L')+(path.closed?'Z':'');
  return `<path d="${d}" vector-effect="non-scaling-stroke"/>`;
 }).join('');
 return svg.replace(/<\/svg>\s*$/,`<g data-recorte-cut-preview="true" fill="none" stroke="${appearance.color}" stroke-width="${appearance.widthPx}" stroke-linejoin="round">${lines}</g></svg>`);
}
