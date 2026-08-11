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

import { readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { faker } from "@faker-js/faker";
import { newGroup, destroyGroup, type Group } from "@swifty.js/cache";

const GROUP_NAME = "movies";
const CACHE_KEY = "all";

export interface Movie {
  id: string;
  name: string;
  image: string;
  description: string;
}

const require = createRequire(import.meta.url);
const lucideEntry = require.resolve("lucide-static");
// realpathSync resolves pnpm's symlinked node_modules to the real store path
export const lucideIconsDir = realpathSync(join(dirname(lucideEntry), "../../icons"));
const staticImages = readdirSync(lucideIconsDir)
  .filter((f) => f.endsWith(".svg"))
  .map((f) => `/static/${f}`);

let movieGroup: Group | null = null;
let moviesData: Movie[] = [];

function generateMovies(count: number): Movie[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    name: faker.lorem.words({ min: 2, max: 5 }),
    image: staticImages[Math.floor(Math.random() * staticImages.length)],
    description: faker.lorem.sentence(),
  }));
}

export function initMovieCache(): void {
  moviesData = generateMovies(1000);

  const payload = Buffer.from(JSON.stringify({ movies: moviesData }));

  movieGroup = newGroup(GROUP_NAME, 64 * 1024 * 1024, async () => payload);
}

export function destroyMovieCache(): void {
  destroyGroup(GROUP_NAME);
  movieGroup = null;
}

export async function getAllMovies(): Promise<Movie[]> {
  if (!movieGroup) return [];

  const view = await movieGroup.get(new AbortController().signal, CACHE_KEY);
  const data = JSON.parse(view.toString());
  return data.movies;
}
