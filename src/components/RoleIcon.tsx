import { useState } from "react";

interface RoleIconProps {
  roleStr: string;
}

function resolveRoleAsset(roleStr: string): { file: string | null; label: string } {
  const r = (roleStr || "").toLowerCase();
  if (
    r.startsWith("iniciador") ||
    (!r.startsWith("duelista") &&
      !r.startsWith("controlador") &&
      !r.startsWith("centinela") &&
      r.includes("iniciador"))
  ) {
    return { file: "/iniciador.png", label: "Iniciador" };
  }
  if (
    r.startsWith("controlador") ||
    (!r.startsWith("duelista") && !r.startsWith("centinela") && r.includes("controlador"))
  ) {
    return { file: "/controlador.png", label: "Controlador" };
  }
  if (r.startsWith("centinela") || (!r.startsWith("duelista") && r.includes("centinela"))) {
    return { file: "/centinela.png", label: "Centinela" };
  }
  if (r.includes("duelista")) {
    return { file: "/duelista.png", label: "Duelista" };
  }
  return { file: null, label: "Flex" };
}

export function RoleIcon({ roleStr }: RoleIconProps) {
  const { file, label } = resolveRoleAsset(roleStr);
  const [hidden, setHidden] = useState(false);

  if (!file) {
    return (
      <svg
        className="role-ico-svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-label="Flex"
      >
        <polygon points="12 2 22 12 12 22 2 12" />
      </svg>
    );
  }

  if (hidden) return null;

  return (
    <img
      src={file}
      alt={label}
      title={label}
      width={13}
      height={13}
      className="role-ico"
      onError={() => setHidden(true)}
    />
  );
}