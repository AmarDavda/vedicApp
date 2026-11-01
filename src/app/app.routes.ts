import { Routes } from '@angular/router';

// Titles here must equal the titles in site.config.json (the build script writes those into each page's HTML);
// scripts/seo.test.mjs checks that they match.
export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Vedic App – Vedic Cosmology, Family Tree & PDFs', loadComponent: () => import('./home/home-page').then((m) => m.HomePage) },
  { path: 'cosmology', title: 'Vedic Cosmology – Interactive Map of the Lokas | Vedic App', loadComponent: () => import('./cosmology/cosmology-page').then((m) => m.CosmologyPage) },
  { path: 'genealogy', title: 'Vedic Family Tree Maker – Build a Genealogy | Vedic App', loadComponent: () => import('./genealogy/genealogy-page').then((m) => m.GenealogyPage) },
  { path: 'reading', title: 'Vedic Reading Materials – Vedas, Puranas PDFs | Vedic App', loadComponent: () => import('./reading/reading-page').then((m) => m.ReadingPage) },
  { path: '**', redirectTo: '' },
];
