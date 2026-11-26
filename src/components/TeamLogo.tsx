import { useEffect, useState } from "react";
import { useDbStore } from "../stores/useDbStore.ts";

interface TeamLogoProps {
  teamName: string;
  className?: string;
}

function buildFallbackSvg(code: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="2" fill="#11141B" stroke="${color}" stroke-width="3"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ECEFF4" font-family="JetBrains Mono, monospace" font-weight="700" font-size="22">${code}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function TeamLogo({ teamName, className = "" }: TeamLogoProps) {
  const meta = useDbStore((s) => s.teamMeta[teamName]);
  const logoFile = meta?.logo || "vct.png";
  const code = meta?.code || teamName.slice(0, 3).toUpperCase();
  const color = meta?.color || "#E5484D";
  const logoCls = meta?.logoCls || "";
  const isCustomBadge = logoFile.startsWith("__custom__");

  const src =
    logoFile.startsWith("http") || logoFile.startsWith("data:") || logoFile.startsWith("/")
      ? logoFile
      : `/${logoFile}`;

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (isCustomBadge || failed) {
    return <img src={buildFallbackSvg(code, color)} alt={teamName} className={className} />;
  }

  return (
    <img
      src={src}
      alt={teamName}
      className={`${className} ${logoCls}`.trim()}
      onError={() => setFailed(true)}
    />
  );
}