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

import { useState } from "react";
import { FavoriteProvider } from "./context/favorite-context";
import { SearchList } from "./pages/search-list";
import { FavoriteList } from "./pages/favorite-list";
import type { TPage } from "./types";
import { Home } from "./pages/home";
import { Toolbar } from "./components/toolbar";
import { RandomCrash } from "./dev/random-crash";

function App() {
  const [currentPage, setCurrentPage] = useState<TPage>("home");

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home />;
      case "search":
        return <SearchList />;
      case "favorite":
        return <FavoriteList />;
      default:
        return (
          <div className="flex h-64 flex-col items-center justify-center">
            <p className="mb-4 text-xl text-gray-700">Page Not Found</p>
            <button
              className="cursor-pointer rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
              onClick={() => setCurrentPage("home")}
            >
              Back to Home
            </button>
          </div>
        );
    }
  };

  return (
    <FavoriteProvider>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Toolbar onPageChange={setCurrentPage} />
        <main className="container mx-auto flex-1 px-4 py-4">
          {renderPage()}
        </main>
        {/* Invisible probe that randomly throws during render to seed
            EventType.React reports via the SDK's ReactErrorBoundary. */}
        <RandomCrash />
      </div>
    </FavoriteProvider>
  );
}

export default App;
