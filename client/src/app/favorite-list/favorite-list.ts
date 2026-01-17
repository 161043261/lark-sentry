import { Component, inject } from '@angular/core';
import { MovieList } from '../movie-list/movie-list';
import { FavoriteListService } from '../favorite-list.service';

@Component({
  selector: 'app-favorite-list',
  imports: [MovieList],
  template: `<app-movie-list [movieList]="movieList()" />`,
})
export class FavoriteList {
  favoriteService = inject(FavoriteListService);
  movieList = this.favoriteService.movieList;
}
