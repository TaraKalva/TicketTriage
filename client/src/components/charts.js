import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

export const CHART_TEXT_COLOR = '#6b7a94';
export const CHART_GRID_COLOR = 'rgba(125, 211, 252, 0.25)';

// Pastel severity palette (soft fills, still ordered by intensity: Critical -> Low)
export const SEVERITY_COLORS = {
  Critical: '#f8b4c0',
  High: '#fbcfa0',
  Medium: '#fde68a',
  Low: '#a7e8c8',
};

// Light-blue-led categorical palette (8 categories) — blues first, fanning into
// complementary pastels only as needed for distinguishability.
export const PALETTE = ['#7dd3fc', '#93c5fd', '#a5b4fc', '#67e8f9', '#bae6fd', '#c4b5fd', '#fbcfe8', '#fde68a'];
