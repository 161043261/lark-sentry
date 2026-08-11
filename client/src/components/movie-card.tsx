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

import { useFavorite } from "../context/favorite";
import type { IMovie } from "../types";

interface MovieCardProps {
  movie: IMovie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const { has, add, remove } = useFavorite();
  const isFavored = has(movie);

  const handleLike = () => {
    if (isFavored) {
      remove(movie);
    } else {
      add(movie);
    }
  };

  return (
    <div className="mt-4 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-xl font-semibold">{movie.name}</h3>
      </div>
      <img
        src={movie.image}
        alt={movie.name}
        className="h-50 w-full object-fill"
      />
      <div className="p-4">
        <p className="text-gray-600">{movie.description}</p>
      </div>
      <div className="flex justify-end border-t border-gray-200 p-4">
        <button
          onClick={handleLike}
          className="cursor-pointer rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
        >
          {isFavored ? "Dislike" : "Like"}
        </button>
      </div>
    </div>
  );
}
