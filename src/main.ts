/**
 * Mount point. Everything else is `src/components/app.ts`.
 */
import './styles.css';
import { mountApp } from '@/components/app';

const root = document.querySelector<HTMLDivElement>('#app');
if (root !== null) mountApp(root);
