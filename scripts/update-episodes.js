// ============================================
// Aggiorna episodes.json usando la TMDB API v3
// ============================================
// Richiede la variabile d'ambiente TMDB_API_KEY
// (impostata come repository secret su GitHub)

const fs = require('fs');
const TMDB_KEY = process.env.TMDB_API_KEY;

if (!TMDB_KEY) {
  console.error('ERRORE: TMDB_API_KEY non impostata');
  console.error('Impostala come repository secret su GitHub');
  process.exit(1);
}

const SHOWS = [
  { tmdbId: 37606, showName: 'Lo straordinario mondo di Gumball', logo: 'Gumball.png' },
  { tmdbId: 291904, showName: 'Lo strano e meraviglioso mondo di Gumball', logo: 'Gumball2.png' }
];

const API_BASE = 'https://api.themoviedb.org/3';

async function tmdbFetch(path) {
  const url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}&language=it-IT`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText} per ${path}`);
  return res.json();
}

// Decodifica entità HTML (&#39; → ', &amp; → &, ecc.)
function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function fetchShow(config) {
  console.log(`\nScaricando ${config.showName} (TMDB ID: ${config.tmdbId})...`);

  // 1. Info della serie (include la lista delle stagioni)
  const showData = await tmdbFetch(`/tv/${config.tmdbId}`);
  const seasons = showData.seasons || [];
  console.log(`  Trovate ${seasons.length} stagioni`);

  const allEps = [];

  // 2. Scarica ogni stagione in parallelo
  const seasonResults = await Promise.all(
    seasons
      .filter(s => s.season_number > 0 && s.episode_count > 0)
      .map(async (s) => {
        try {
          const seasonData = await tmdbFetch(`/tv/${config.tmdbId}/season/${s.season_number}`);
          const eps = (seasonData.episodes || []).map(ep => ({
            season: ep.season_number,
            episode: ep.episode_number,
            title: decodeHtml(ep.name) || `Episodio ${ep.episode_number}`
          })).filter(ep => ep.episode > 0);

          console.log(`  Stagione ${s.season_number}: ${eps.length} episodi`);
          return eps;
        } catch (e) {
          console.warn(`  Stagione ${s.season_number} fallita: ${e.message}`);
          return [];
        }
      })
  );

  for (const eps of seasonResults) allEps.push(...eps);

  console.log(`  Totale: ${allEps.length} episodi`);
  return allEps;
}

async function main() {
  console.log('=== Aggiornamento episodes.json ===');

  const db = {
    version: 1,
    updated: new Date().toISOString().split('T')[0],
    shows: []
  };

  for (const config of SHOWS) {
    const episodes = await fetchShow(config);
    db.shows.push({
      tmdbId: config.tmdbId,
      showName: config.showName,
      logo: config.logo,
      episodes
    });
  }

  const totalEps = db.shows.reduce((sum, s) => sum + s.episodes.length, 0);
  console.log(`\nTotale generale: ${totalEps} episodi`);

  fs.writeFileSync('episodes.json', JSON.stringify(db, null, 2));
  console.log('episodes.json scritto con successo!');
}

main().catch(e => { console.error(e); process.exit(1); });
