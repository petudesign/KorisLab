import HomeOutlined from "@mui/icons-material/HomeOutlined";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import SportsBasketballOutlined from "@mui/icons-material/SportsBasketballOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import BarChartOutlined from "@mui/icons-material/BarChartOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import MonitorHeartOutlined from "@mui/icons-material/MonitorHeartOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import EmojiEventsOutlined from "@mui/icons-material/EmojiEventsOutlined";
import FlagOutlined from "@mui/icons-material/FlagOutlined";
import MyLocationOutlined from "@mui/icons-material/MyLocationOutlined";
import BoltOutlined from "@mui/icons-material/BoltOutlined";
import UnfoldMoreOutlined from "@mui/icons-material/UnfoldMoreOutlined";
import ArrowUpwardOutlined from "@mui/icons-material/ArrowUpwardOutlined";
import ArrowDownwardOutlined from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowOutwardOutlined from "@mui/icons-material/ArrowOutwardOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import TrendingDownOutlined from "@mui/icons-material/TrendingDownOutlined";
import RemoveOutlined from "@mui/icons-material/RemoveOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import PriorityHighOutlined from "@mui/icons-material/PriorityHighOutlined";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import PauseOutlined from "@mui/icons-material/PauseOutlined";
import SkipPreviousOutlined from "@mui/icons-material/SkipPreviousOutlined";
import SkipNextOutlined from "@mui/icons-material/SkipNextOutlined";

// Individual imports keep the unused icon catalogue out of the app bundle.
const icons = {
  play: PlayArrowOutlined, pause: PauseOutlined, previous: SkipPreviousOutlined, next: SkipNextOutlined,
  home: HomeOutlined,
  overview: GridViewOutlined,
  games: SportsBasketballOutlined,
  teams: GroupsOutlined,
  players: PersonOutlined,
  season: BarChartOutlined,
  matchup: CompareArrowsOutlined,
  health: MonitorHeartOutlined,
  settings: SettingsOutlined,
  sun: LightModeOutlined,
  moon: DarkModeOutlined,
  chevron: ExpandMoreOutlined,
  trophy: EmojiEventsOutlined,
  flag: FlagOutlined,
  target: MyLocationOutlined,
  bolt: BoltOutlined,
  sort: UnfoldMoreOutlined,
  sortAsc: ArrowUpwardOutlined,
  sortDesc: ArrowDownwardOutlined,
  arrowOutward: ArrowOutwardOutlined,
  arrowBack: ArrowBackOutlined,
  trendUp: TrendingUpOutlined,
  trendDown: TrendingDownOutlined,
  minus: RemoveOutlined,
  check: CheckOutlined,
  warning: PriorityHighOutlined,
};

export type IconName = keyof typeof icons;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const Component = icons[name];
  return <Component aria-hidden="true" focusable="false" className={className} style={{ width: size, height: size, fontSize: size }} />;
}
