// PostCSS plugin: moves every :hover selector into a hover-capable media query.
// Selectors listed with it, such as :focus-visible, stay where they are so keyboard focus still works on touch.
const QUERY='(hover:hover) and (pointer:fine)';
const gated=rule=>{for(let node=rule.parent;node;node=node.parent)if(node.type==='atrule'&&(/keyframes$/.test(node.name)||node.name==='media'&&/hover:\s*hover/.test(node.params)))return true;return false;};
export const gateHover={postcssPlugin:'gate-hover',Once(root,{AtRule}){
 root.walkRules(rule=>{
  if(!rule.selector.includes(':hover')||gated(rule))return;
  const hover=rule.selectors.filter(selector=>selector.includes(':hover')),rest=rule.selectors.filter(selector=>!selector.includes(':hover'));
  const media=new AtRule({name:'media',params:QUERY});
  media.append(rule.clone({selector:hover.join(',')}));
  rule.parent.insertAfter(rule,media);
  if(rest.length)rule.selector=rest.join(',');else rule.remove();
 });
}};
