import { BookOpen, Home, Trophy, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/lessons", label: "Lecciones", icon: BookOpen },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export default function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <nav className="border-t border-slate-200 bg-white px-6 py-3 flex justify-around text-[11px]">
      {tabs.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-1 transition-colors ${
              active
                ? "text-violet-600"
                : "text-slate-400 hover:text-violet-600"
            }`}
          >
            <Icon size={24} strokeWidth={2.5} />
            <span className={active ? "font-semibold" : ""}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
