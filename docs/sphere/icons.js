const paths = {
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  wallet: 'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6m18 6h-5v5h5m-3-2.5h.01',
  send: 'm22 2-7 20-4-9-9-4 20-7ZM11 13 22 2',
  plus: 'M12 5v14M5 12h14',
  swap: 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
  'arrow-down': 'M12 3v17m-6-6 6 6 6-6',
  'arrow-right': 'M4 12h16m-6-6 6 6-6 6',
  'arrow-left': 'M20 12H4m6-6-6 6 6 6',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  card: 'M3 5h18v14H3V5Zm0 5h18M6 15h3',
  qr: 'M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6ZM15 15h2v2h-2v-2Zm6-2v4m-8 4h4m4 0h.01',
  grid: 'M3 4h7v7H3V4Zm11 0h7v7h-7V4ZM3 15h7v7H3v-7Zm11 0h7v7h-7v-7',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-2a8 8 0 0 1 16 0v2',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  'eye-off': 'm3 3 18 18M9 5a10 10 0 0 1 3-.5c7 0 10 7.5 10 7.5a15 15 0 0 1-3 4M6 6a17 17 0 0 0-4 6s3 7 10 7c1.6 0 3-.3 4-.8',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M9 21h6',
  moon: 'M20 14A9 9 0 0 1 10 4 9 9 0 1 0 20 14Z',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v2m0 18v2M1 12h2m18 0h2M4 4l1 1m14 14 1 1M4 20l1-1M19 5l1-1',
  shield: 'm12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5l8-3Zm-4 9 3 3 5-6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  check: 'm5 12 4 4L19 6',
  help: 'M21 4H3v14h5v4l5-4h8V4ZM7 9h10m-10 4h6',
  globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2c-6 7-6 13 0 20 6-7 6-13 0-20Z',
  phone: 'M7 2h10v20H7V2Zm0 15h10m-5 4h.01',
  plane: 'm21 4-6 16-3-7-7-3 16-6Zm-9 9 9-9',
  file: 'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h6',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8m-8 4h8',
  copy: 'M8 8h12v12H8zM16 4H4v12',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  search: 'M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 5 5',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6m0-10h.01'
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.info}"></path></svg>`;
}
