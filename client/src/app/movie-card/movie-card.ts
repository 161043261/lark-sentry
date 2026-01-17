import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { IMovie } from '../types';
import { FavoriteListService } from '../favorite-list.service';

@Component({
  selector: 'app-movie-card',
  imports: [MatCardModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="movie-card" appearance="outlined">
      <mat-card-header>
        <mat-card-title>{{ movie().name }}</mat-card-title>
      </mat-card-header>
      <img mat-card-image [src]="movie().image" [alt]="movie().name" />
      <mat-card-content>
        <p>
          {{ movie().description }}
        </p>
      </mat-card-content>
      <mat-card-actions>
        <button matButton (click)="handleLike()">
          @if (isFavored()) {
            Dislike
          } @else {
            Like
          }
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .movie-card {
      max-width: 40rem;
      margin: 1rem auto 0;
    }
  `,
})
export class MovieCard {
  movie = input.required<IMovie>();
  favoriteService = inject(FavoriteListService);
  isFavored = computed(() => {
    return this.favoriteService.has(this.movie());
  });

  handleLike() {
    if (this.isFavored()) {
      this.favoriteService.remove(this.movie());
    } else {
      this.favoriteService.add(this.movie());
    }
  }
}
