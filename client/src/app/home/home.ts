import { Component, inject, OnInit, signal } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { HttpClient } from '@angular/common/http';
import { IMovie, IResponse } from '../types';
import { catchError, finalize, map, of } from 'rxjs';
import { Spinner } from '../spinner/spinner';
import { MovieList } from '../movie-list/movie-list';

@Component({
  selector: 'app-home',
  imports: [MatGridListModule, Spinner, MovieList],
  template: `
    @if (isLoading()) {
      <app-spinner />
    } @else {
      <app-movie-list [movieList]="movieList()" />
    }
  `,
})
export class Home implements OnInit {
  ngOnInit() {
    this.fetchMovieList();
  }
  http = inject(HttpClient);
  movieList = signal<IMovie[]>([]);
  isLoading = signal(false);

  fetchMovieList() {
    this.isLoading.set(true);
    this.http
      .get<IResponse>('https://api.imdbapi.dev/interests')
      .pipe(
        map((res) => {
          const randomIndex = Math.floor(Math.random() * res.categories.length);
          const { interests: randomInterests } = res.categories[randomIndex];
          return randomInterests.map(({ id, name, primaryImage, description }) => ({
            id,
            name,
            image: primaryImage.url,
            description,
          }));
        }),
        catchError((err) => {
          console.error(err);
          return of([] /** newMovieList */);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((newMovieList) => {
        this.movieList.set(newMovieList);
      });
  }
}
