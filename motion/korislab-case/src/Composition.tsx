import {AbsoluteFill,useVideoConfig} from 'remotion';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {HookScene} from './scenes/HookScene';
import {SearchScene} from './scenes/SearchScene';
import {PlayersScene} from './scenes/PlayersScene';
import {InsightScene} from './scenes/InsightScene';
import {ShotsScene} from './scenes/ShotsScene';
import {GameScene} from './scenes/GameScene';
import {ComparisonScene} from './scenes/ComparisonScene';
import {EndScene} from './scenes/EndScene';
import {colors} from './design';
export const KorisLabCase=()=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:colors.background}}><TransitionSeries>
  <TransitionSeries.Sequence name="Hook" durationInFrames={1.4*fps} premountFor={fps}><HookScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Search" durationInFrames={3.6*fps} premountFor={fps}><SearchScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Player leaders" durationInFrames={2*fps} premountFor={fps}><PlayersScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Season insight" durationInFrames={2.6*fps} premountFor={fps}><InsightScene tempo={1.15}/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Shot map" durationInFrames={2*fps} premountFor={fps}><ShotsScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Game story" durationInFrames={2.3*fps} premountFor={fps}><GameScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Matchup Lab" durationInFrames={2.8*fps} premountFor={fps}><ComparisonScene tempo={1.05}/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.1*fps})}/>
  <TransitionSeries.Sequence name="Why KorisLab" durationInFrames={2.8*fps} premountFor={fps}><EndScene/></TransitionSeries.Sequence>
 </TransitionSeries></AbsoluteFill>;
};
