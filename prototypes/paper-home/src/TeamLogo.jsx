import teamLogos from '../source/team-logos.json';
// Bounds of the visible marks, measured from the original PNG alpha channels.
// Keep source images intact; normalize their transparent margins at render time.
const logoBounds = {
 '01M4JY38MCJ9HYJQSQN7XB5KS6': [1653,1653,12,136,1499,1517],
 '01M4JY48TXE0MM7Z3AEWRGHS3N': [500,483,0,0,499,482],
 '01M4JYR36RCHZ2W52CKVWP505N': [500,500,21,107,458,286],
 '01M4JYSG66K44Q3ESDFBA94DM7': [100,100,16,22,69,71],
 '01M4JZ22GP1M2QGKCGHSCXASM8': [594,564,26,33,542,498],
 '01M4JZ3A0N7K2RNBX6F1WD9B1D': [240,289,0,0,240,289],
};
// `decorative` hides the mark from screen readers when the team name is written right next to it.
export function TeamLogo({assetId,name,className='',decorative=false}) {
 const logo=teamLogos[name],label=decorative?{'aria-hidden':true}:{role:'img','aria-label':name};
 if(logo?.src){const [width,height,x,y,right,bottom]=logo.bounds,w=right-x,h=bottom-y,padding=Math.max(w,h)*.05;return <svg className={className} viewBox={`${x-padding} ${y-padding} ${w+padding*2} ${h+padding*2}`} {...label} focusable="false"><image href={logo.src} width={width} height={height}/></svg>;}

 if(!assetId||!logoBounds[assetId])return <span className={`${className} team-logo-fallback`} {...label}>{name.split(' ').map(part=>part[0]).slice(0,3).join('')}</span>;
 const [width,height,x,y,w,h]=logoBounds[assetId];
 const padding=Math.max(w,h)*.05;
 return <svg className={className} viewBox={`${x-padding} ${y-padding} ${w+padding*2} ${h+padding*2}`} {...label} focusable="false"><image href={`/assets/${assetId}.png`} width={width} height={height}/></svg>;
}
