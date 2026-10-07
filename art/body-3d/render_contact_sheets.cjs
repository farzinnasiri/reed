// Compose actual exported-GLB renders. Requires sharp in the local tooling environment.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../../assets/body-3d/previews');
const bg = { r: 18, g: 17, b: 16, alpha: 1 };
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function label(text, width, height, size=15) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#121110"/><text x="14" y="${height-9}" fill="#b8afa4" font-family="sans-serif" font-size="${size}">${escape(text)}</text></svg>`);
}
async function sheet(filename, columns, title) {
  const tileWidth=280, tileHeight=350, width=columns.length*tileWidth;
  const header=65, rowHeight=385, height=header+rowHeight*2;
  const layers=[{input:label(title,width,35,18),left:0,top:0}];
  columns.forEach((c,i)=>layers.push({input:label(c.label,tileWidth,30,13),left:i*tileWidth,top:35}));
  for(const [row,variant] of ['male','female'].entries()) {
    layers.push({input:label(variant[0].toUpperCase()+variant.slice(1),width,30),left:0,top:header+row*rowHeight});
    for(const [col,c] of columns.entries()) {
      const input=await sharp(path.join(root,`${variant}-${c.file}.png`)).resize(tileWidth,tileHeight).png().toBuffer();
      layers.push({input,left:col*tileWidth,top:header+row*rowHeight+30});
    }
  }
  await sharp({create:{width,height,channels:4,background:bg}}).composite(layers).png().toFile(path.join(root,filename));
}
(async()=>{
  await sheet('family-contact-sheet.png',[
    {label:'Front',file:'front'},{label:'Oblique',file:'oblique'},{label:'Side',file:'side'},
    {label:'Back oblique',file:'back-oblique'},{label:'Back',file:'back'}
  ],'Reed body assets · anatomy');
  await sheet('shapes-contact-sheet.png',[
    {label:'Base',file:'front'},{label:'Adiposity 1',file:'adiposity-front'},
    {label:'Muscularity 1',file:'muscularity-front'},{label:'Both 1',file:'combined-front'}
  ],'Reed body assets · appearance variations');
  await sheet('highlights-contact-sheet.png',[
    {label:'Pain · front',file:'pain-front'},{label:'Pain · back',file:'pain-back'},
    {label:'Quadriceps · primary',file:'muscles-front'},{label:'Glutes / hamstrings · secondary',file:'muscles-back'}
  ],'Reed body assets · runtime highlights');
  await sheet('exercise-contact-sheet.png',[
    {label:'Pectorals · primary',file:'push-muscles-front'},{label:'Deltoids / triceps · secondary',file:'push-muscles-oblique'},
    {label:'Back · primary',file:'pull-muscles-back'},{label:'Quadriceps · primary',file:'muscles-front'}
  ],'Reed body assets · exercise muscle groups');
  console.log('Created four contact sheets from final GLB renders.');
})().catch(e=>{console.error(e);process.exitCode=1});
