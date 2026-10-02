/** Keep makes and attempts readable as one figure, with the chart's color meaning. */
export function ShotCount({ made, attempted }: { made: number; attempted: number }) {
  return <span className="shot-count"><span className="shot-count-made">{made}</span><span className="shot-count-divider"> / </span><span className="shot-count-attempted">{attempted}</span></span>;
}
