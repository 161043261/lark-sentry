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

import { Suspense, lazy } from "react";
import { Switch, Route, Link } from "react-router-dom";
import { FavoriteProvider } from "./context/favorite";
import { Toolbar } from "./components/toolbar";
import { Spinner } from "./components/spinner";
import { RandomCrash } from "./crash";

const Home = lazy(() => import("./pages/page"));
const SearchList = lazy(() => import("./pages/search-list/page"));
const FavoriteList = lazy(() => import("./pages/favorite-list/page"));

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <p className="text-6xl font-bold text-gray-800">404</p>
      <p className="mt-4 text-lg text-gray-400">Page not found</p>
      <Link
        to="/"
        className="bg-accent-600 hover:bg-accent-500 mt-8 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}

// React16 component stack
NotFound.displayName = "NotFound";

function App() {
  return (
    <FavoriteProvider>
      <div className="flex min-h-screen flex-col">
        <Toolbar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <Suspense fallback={<Spinner />}>
            <Switch>
              <Route exact path="/" render={() => <Home />} />
              <Route path="/search-list" render={() => <SearchList />} />
              <Route path="/favorite-list" render={() => <FavoriteList />} />
              <Route render={() => <NotFound />} />
            </Switch>
          </Suspense>
        </main>
        <RandomCrash />
      </div>
    </FavoriteProvider>
  );
}

// React16 component stack
App.displayName = "App";

export default App;
