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

import { useState, useEffect } from "react";
import { MovieList } from "../components/movie-list";
import { Spinner } from "../components/spinner";
import type { IMovie } from "../types";

function Home() {
  const [movieList, setMovieList] = useState<IMovie[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMovieList = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/movie");
        const data = await response.json();

        if (data.movies && data.movies.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.movies.length);
          const count = Math.min(20, data.movies.length);
          const movies = data.movies.slice(randomIndex, randomIndex + count);
          setMovieList(movies);
        }
      } catch (err) {
        console.error(err);
        setMovieList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovieList();
  }, []);

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Discover</h1>
      <MovieList movieList={movieList} />
    </div>
  );
}

export default Home;
