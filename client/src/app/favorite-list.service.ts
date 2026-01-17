import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { IMovie } from './types';

export const browserStorage = new InjectionToken<Storage>('BrowserStorage', {
  providedIn: 'root',
  factory: () => window.localStorage,
});

const storageKey = 'favorite-list';

@Injectable({
  providedIn: 'root',
})
export class FavoriteListService {
  private storage = inject(browserStorage);
  movieList = signal<IMovie[]>(this.get());

  has(movie: IMovie) {
    const { id: movieId } = movie;
    return this.movieList().some(({ id }) => id === movieId);
  }

  get() {
    return JSON.parse(this.storage.getItem(storageKey) ?? '[]');
  }

  set() {
    this.storage.setItem(storageKey, JSON.stringify(this.movieList()));
  }

  add(movie: IMovie) {
    if (this.has(movie)) {
      return;
    }
    this.movieList.update((favoriteList) => {
      // favoriteList.unshift(movie);
      // return favoriteList;
      return [movie, ...favoriteList];
    });
    this.set();
  }

  remove(movie: IMovie) {
    this.movieList.update((favoriteList) => {
      return favoriteList.filter(({ id }) => id !== movie.id);
    });
    this.set();
  }
}
