import { Component, input } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MovieCard } from '../movie-card/movie-card';
import { IMovie } from '../types';

@Component({
  selector: 'app-movie-list',
  imports: [MatGridListModule, MovieCard],
  template: `
    <mat-grid-list cols="1" rowHeight="2:1">
      @for (movie of movieList(); track movie.id) {
        <app-movie-card [movie]="movie" />
      } @empty {
        <h1 class="empty-list">Empty Movie List</h1>
      }
    </mat-grid-list>
  `,
  styles: `
    .empty-list {
      text-align: center;
    }
  `,
})
export class MovieList {
  movieList = input.required<IMovie[]>();
}
