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
import { MovieList } from "../../components/movie-list";
import { Spinner } from "../../components/spinner";
import { Search } from "lucide-react";
import type { IMovie } from "../../types";

function SearchList() {
  const [searchTitle, setSearchTitle] = useState("");
  const [movieList, setMovieList] = useState<IMovie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchMovie = async () => {
    const keyword = searchTitle.trim();
    if (!keyword) {
      setMovieList([]);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await fetch(
        `/api/movie?keyword=${encodeURIComponent(keyword)}`,
      );
      const data = await response.json();
      setMovieList(data.movies ?? []);
    } catch (err) {
      console.error(err);
      setMovieList([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mx-auto mb-10 max-w-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          Search Movies
        </h1>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title or description..."
              className="focus:border-accent-500 focus:ring-accent-500/20 w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-10 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:ring-2 focus:outline-none"
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchMovie()}
            />
          </div>
          <button
            onClick={handleSearchMovie}
            disabled={isLoading}
            className="bg-accent-600 hover:bg-accent-500 cursor-pointer rounded-xl px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : hasSearched ? (
        <MovieList movieList={movieList} />
      ) : null}
    </div>
  );
}

export default SearchList;
