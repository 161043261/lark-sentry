/**
 * Copyright (c) 2026 hangtiancheng
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { NavLink, Link } from "react-router-dom";
import { Search, Heart } from "lucide-react";

const navItems = [
  { to: "/search-list", label: "Search", icon: Search },
  { to: "/favorite-list", label: "Favorites", icon: Heart },
];

export function Toolbar() {
  return (
    <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 p-4">
      <Link
        to="/"
        className="text-lg font-bold transition-colors select-none hover:text-blue-600"
      >
        Movie List
      </Link>
      <nav className="flex gap-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `rounded p-2 transition-colors hover:bg-gray-200 ${
                isActive ? "bg-gray-200 text-blue-600" : ""
              }`
            }
          >
            <Icon className="h-6 w-6" />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
