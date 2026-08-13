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

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { IMovie } from "../types";

interface FavoriteContextType {
  movieList: IMovie[];
  has: (movie: IMovie) => boolean;
  add: (movie: IMovie) => void;
  remove: (movie: IMovie) => void;
}

const FavoriteContext = createContext<FavoriteContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "favorite-list";

export function FavoriteProvider({ children }: { children: ReactNode }) {
  const [movieList, setMovieList] = useState<IMovie[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to parse favorite list from localStorage", e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movieList));
  }, [movieList]);

  const has = (movie: IMovie) => {
    return movieList.some((m) => m.id === movie.id);
  };

  const add = (movie: IMovie) => {
    if (has(movie)) return;
    setMovieList((prev) => [movie, ...prev]);
  };

  const remove = (movie: IMovie) => {
    setMovieList((prev) => prev.filter((m) => m.id !== movie.id));
  };

  return (
    <FavoriteContext.Provider value={{ movieList, has, add, remove }}>
      {children}
    </FavoriteContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorite() {
  const context = useContext(FavoriteContext);
  if (context === undefined) {
    throw new Error("useFavorite must be used within a FavoriteProvider");
  }
  return context;
}
