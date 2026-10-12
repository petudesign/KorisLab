import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
await Promise.all([
 loadFont({family:'Cal Sans',url:staticFile('fonts/CalSans.ttf'),weight:'400'}),
 loadFont({family:'Inter',url:staticFile('fonts/Inter-Regular.ttf'),weight:'400'}),
 loadFont({family:'Inter',url:staticFile('fonts/Inter-Semibold.ttf'),weight:'600'}),
 loadFont({family:'Array',url:staticFile('fonts/Array-Semibold.woff2'),weight:'600'}),
]);
