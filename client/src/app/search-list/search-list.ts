import { Component, inject, signal } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, map, of } from 'rxjs';
import { IMovie, IResponse } from '../types';
import { Spinner } from '../spinner/spinner';
import { MovieList } from '../movie-list/movie-list';
@Component({
  selector: 'app-search-list',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MovieList, Spinner],
  template: `
    <form class="search-form">
      <mat-form-field class="search-form-field">
        <mat-label>Movie Title</mat-label>
        <input matInput [(ngModel)]="searchTitle" name="app-search-title" />
      </mat-form-field>

      <button
        matButton="filled"
        class="search-button"
        (click)="handleSearchMovie()"
        [disabled]="isLoading()"
      >
        Search
      </button>
      @if (isLoading()) {
        <app-spinner />
      } @else {
        <app-movie-list [movieList]="movieList()" />
      }
    </form>
  `,
  styles: `
    .search-form {
      text-align: center;
      margin-top: 1rem;
    }

    .search-form-field {
      width: 50vw;
    }

    .search-button {
      display: block;
      margin: 0 auto;
    }
  `,
})
export class SearchList {
  http = inject(HttpClient);

  searchTitle = signal<string>('');
  movieList = signal<IMovie[]>([]);
  isLoading = signal(false);

  handleSearchMovie() {
    this.isLoading.set(true);
    this.http
      .get<IResponse>('https://api.imdbapi.dev/interests')
      .pipe(map((res) => res.categories))
      .pipe(map((categories) => categories.map((item) => item.interests)))
      .pipe(map((interestLists) => interestLists.flat()))
      .pipe(
        map((interests) =>
          interests.map(({ id, name, primaryImage, description }) => ({
            id,
            name,
            image: primaryImage.url,
            description,
          })),
        ),
      )
      .pipe(
        map((movies) =>
          movies.filter((movie) => {
            const title = this.searchTitle().toLowerCase();
            return (
              movie.name.toLowerCase().includes(title) ||
              movie.description.toLowerCase().includes(title)
            );
          }),
        ),
      )
      .pipe(
        catchError((err) => {
          console.error(err);
          return of([]);
        }),
      )
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((newMovieList) => {
        this.movieList.set(newMovieList);
      });
  }
}
