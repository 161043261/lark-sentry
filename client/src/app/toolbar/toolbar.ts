import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TPage } from '../types';
import { output } from '@angular/core';

@Component({
  selector: 'app-toolbar',
  imports: [MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar>
      <span (click)="handleClick('home')">Movie List</span>
      <span class="toolbar-spacer"></span>
      <button matIconButton (click)="handleClick('search')">
        <mat-icon>search</mat-icon>
      </button>
      <button matIconButton (click)="handleClick('favorite')">
        <mat-icon>favorite</mat-icon>
      </button>
    </mat-toolbar>
  `,
  styles: `
    .toolbar-spacer {
      flex: 1 1 auto;
    }
  `,
})
export class Toolbar {
  handleClick(page: TPage) {
    this.onPageChange.emit(page);
  }
  onPageChange = output<TPage>();
}
