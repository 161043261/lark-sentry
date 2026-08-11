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
import { Heart } from "lucide-react";
import type { IMovie } from "../types";

interface MovieCardProps {
  movie: IMovie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const { has, add, remove } = useFavorite();
  const isFavored = has(movie);

  const handleLike = () => {
    if (isFavored) remove(movie);
    else add(movie);
  };

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-lg shadow-black/20 transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-black/30">
      <div className="relative aspect-video overflow-hidden">
        <img
          src={movie.image}
          alt={movie.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent" />
        <h3 className="absolute bottom-0 left-0 p-4 text-lg font-semibold text-white drop-shadow-md">
          {movie.name}
        </h3>
      </div>
      <div className="p-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-gray-400">
          {movie.description}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleLike}
            className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isFavored
                ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                : "bg-white/5 text-gray-400 hover:bg-accent-500/15 hover:text-accent-300"
            }`}
          >
            <Heart
              className={`h-4 w-4 ${isFavored ? "fill-rose-400" : ""}`}
            />
            {isFavored ? "Favorited" : "Favorite"}
          </button>
        </div>
      </div>
    </article>
  );
}
