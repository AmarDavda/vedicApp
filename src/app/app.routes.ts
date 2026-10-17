import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Vedic App', loadComponent: () => import('./home/home-page').then((m) => m.HomePage) },
  { path: 'cosmology', title: 'Vedic App · Cosmology', loadComponent: () => import('./cosmology/cosmology-page').then((m) => m.CosmologyPage) },
  { path: 'genealogy', title: 'Vedic App · Genealogy', loadComponent: () => import('./genealogy/genealogy-page').then((m) => m.GenealogyPage) },
  { path: 'reading', title: 'Vedic App · Other Vedic Reading Materials', loadComponent: () => import('./reading/reading-page').then((m) => m.ReadingPage) },
  { path: '**', redirectTo: '' },
];
