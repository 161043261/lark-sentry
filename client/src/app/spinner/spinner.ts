import { Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-spinner',
  imports: [MatProgressSpinnerModule],
  template: `<mat-spinner class="spinner" />`,
  styles: `
    .spinner {
      margin: 1rem auto;
    }
  `,
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Spinner {}
