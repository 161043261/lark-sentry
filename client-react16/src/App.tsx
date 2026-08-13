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

export default App;
