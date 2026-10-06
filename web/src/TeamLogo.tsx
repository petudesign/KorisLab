type TeamLogoProps = { teamName: string; className?: string; src?: string | null };

export function teamInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((part) => part.slice(0, 1)).join("") : words[0]?.slice(0, 2) ?? "")
    .toLocaleUpperCase("fi-FI");
}

export function TeamLogo({ teamName, className = "", src }: TeamLogoProps) {
  return <span className={`team-recent-match-logo${className ? ` ${className}` : ""}`} aria-hidden="true">
    {src ? <img src={src} alt="" loading="lazy" /> : teamInitials(teamName)}
  </span>;
}
