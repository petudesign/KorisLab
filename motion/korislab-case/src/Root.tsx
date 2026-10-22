import {Composition,Folder} from 'remotion';
import {KorisLabCase} from './Composition';
import {KorisLabStudy} from './Study';
import {HookScene} from './scenes/HookScene';
import {BrandScene} from './scenes/BrandScene';
import {SearchScene} from './scenes/SearchScene';
import {PlayersScene} from './scenes/PlayersScene';
import {InsightScene} from './scenes/InsightScene';
import {ShotsScene} from './scenes/ShotsScene';
import {GameScene} from './scenes/GameScene';
import {ComparisonScene} from './scenes/ComparisonScene';
import {EndScene} from './scenes/EndScene';
export const RemotionRoot=()=> <>
 <Composition id="KorisLab-Case" component={KorisLabCase} durationInFrames={1128} fps={60} width={1920} height={1080}/>
 <Composition id="KorisLab-Study" component={KorisLabStudy} durationInFrames={600} fps={60} width={1920} height={1080}/>
 <Folder name="Scenes">
  <Composition id="Hook" component={HookScene} durationInFrames={84} fps={60} width={1920} height={1080}/>
  <Composition id="Brand" component={BrandScene} durationInFrames={144} fps={60} width={1920} height={1080}/>
  <Composition id="Search" component={SearchScene} durationInFrames={216} fps={60} width={1920} height={1080}/>
  <Composition id="Player-Leaders" component={PlayersScene} durationInFrames={120} fps={60} width={1920} height={1080}/>
  <Composition id="Season-Insight" component={InsightScene} durationInFrames={156} fps={60} width={1920} height={1080} defaultProps={{tempo:1.15}}/>
  <Composition id="Shot-Map" component={ShotsScene} durationInFrames={120} fps={60} width={1920} height={1080}/>
  <Composition id="Game-Story" component={GameScene} durationInFrames={138} fps={60} width={1920} height={1080}/>
  <Composition id="Matchup-Lab" component={ComparisonScene} durationInFrames={168} fps={60} width={1920} height={1080} defaultProps={{tempo:1.05}}/>
  <Composition id="Closing" component={EndScene} durationInFrames={168} fps={60} width={1920} height={1080}/>
 </Folder>
</>;
