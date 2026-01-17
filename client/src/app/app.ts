import { Component, signal } from '@angular/core';
import { Toolbar } from './toolbar/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { SearchList } from './search-list/search-list';
import { TPage } from './types';
import { Home } from './home/home';
import { FavoriteList } from './favorite-list/favorite-list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  imports: [Toolbar, MatDividerModule, SearchList, Home, FavoriteList, MatButtonModule],
  template: `
    <app-toolbar (onPageChange)="handlePageChange($event)" />
    <mat-divider />
    @switch (currentPage()) {
      @case ('home') {
        <app-home />
      }
      @case ('search') {
        <app-search-list />
      }
      @case ('favorite') {
        <app-favorite-list />
      }
      @default {
        <p>Not Found</p>
        <button matButton="filled" class="search-button" (click)="handlePageChange('home')">
          Back to Home
        </button>
      }
    }
  `,
})
export class App {
  currentPage = signal<TPage>('home');

  handlePageChange(page: TPage) {
    this.currentPage.set(page);
  }
}
