import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Tile {
  title: string;
  text: string;
  link: string | null; // null = not built yet
  icon: 'cosmos' | 'tree' | 'book';
}

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  protected readonly tiles: Tile[] = [
    {
      title: 'Vedic Cosmology',
      text: 'The lokas, from Goloka to Naraka, as nested realms. Add, edit, recolor and delete any loka.',
      link: '/cosmology',
      icon: 'cosmos',
    },
    {
      title: 'Vedic Genealogy',
      text: 'Build a family tree with consorts, children and notes, saved as plain JSON.',
      link: '/genealogy',
      icon: 'tree',
    },
    {
      title: 'Other Vedic Reading Materials',
      text: 'Browse the available PDFs, search by title and read them. Ten on each page.',
      link: '/reading',
      icon: 'book',
    },
  ];
}
