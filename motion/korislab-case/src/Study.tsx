import {AbsoluteFill,useVideoConfig} from 'remotion';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {BrandScene} from './scenes/BrandScene';
import {InsightScene} from './scenes/InsightScene';
import {ComparisonScene} from './scenes/ComparisonScene';
import {colors} from './design';
export const KorisLabStudy=()=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:colors.background}}><TransitionSeries>
  <TransitionSeries.Sequence name="Brand" durationInFrames={2.4*fps} premountFor={fps}><BrandScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="Season insight" durationInFrames={3.7*fps} premountFor={fps}><InsightScene/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="Matchup Lab" durationInFrames={4.5*fps} premountFor={fps}><ComparisonScene/></TransitionSeries.Sequence>
 </TransitionSeries></AbsoluteFill>;
};
