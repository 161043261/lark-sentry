import { Link, useLocation, matchPath } from "react-router-dom";
import { Search, Heart, Clapperboard } from "lucide-react";

const navItems = [
  { to: "/search-list", label: "Search", icon: Search },
  { to: "/favorite-list", label: "Favorites", icon: Heart },
];

export function Toolbar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-gray-900 transition-opacity hover:opacity-70"
        >
          <Clapperboard className="text-accent-500 h-6 w-6" />
          <span>Movie</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = !!matchPath(location.pathname, { path: to });
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-accent-50 text-accent-600"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
