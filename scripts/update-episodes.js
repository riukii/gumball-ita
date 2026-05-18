const fs = require('fs');

const SHOWS = [
  { tmdbId: 37606, showName: 'Lo straordinario mondo di Gumball', logo: 'Gumball.png' },
  { tmdbId: 291904, showName: 'Lo strano e meraviglioso mondo di Gumball', logo: 'Gumball2.png' }
];

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'it-IT' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractSeasons(html) {
  const seasons = new Map();
  const r = /href="[^"]*\/tv\/\d+[^"]*\/season\/(\d+)[^"]*"[^>]*>.*?(\d+)\s*episod/gis;
  for (const m of [...html.matchAll(r)]) {
    const sn = parseInt(m[1]), ec = parseInt(m[2]);
    if (sn > 0 && ec > 0) seasons.set(sn, ec);
  }
  if (seasons.size === 0) {
    const r2 = /Stagione\s+(\d+)[\s\S]*?(\d+)\s*episod/gi;
    for (const m of [...html.matchAll(r2)]) {
      const sn = parseInt(m[1]), ec = parseInt(m[2]);
      if (sn > 0 && ec > 0) seasons.set(sn, ec);
    }
  }
  return seasons;
}

function extractEpisodes(html) {
  const episodes = [];
  const r = /data-episode-number="(\d+)"[^>]*data-season-number="(\d+)"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = r.exec(html)) !== null) {
    const epNum = parseInt(m[1]);
    const title = m[3].trim();
    if (epNum > 0 && title && title !== 'Leggi di più' && title.length > 1)
      episodes.push({ episode: epNum, title });
  }
  if (episodes.length === 0) {
    const r2 = /<span\s+class="episode_number">(\d+)<\/span>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
    while ((m = r2.exec(html)) !== null) {
      const epNum = parseInt(m[1]);
      const title = m[2].trim();
      if (epNum > 0) episodes.push({ episode: epNum, title: title || `Episodio ${epNum}` });
    }
  }
  const seen = new Set();
  return episodes.filter(ep => {
    if (seen.has(ep.episode)) return false;
    seen.add(ep.episode);
    return true;
  });
}

async function fetchShow(config) {
  console.log(`Scaricando ${config.showName}...`);
  const mainHtml = await fetchHtml(`https://www.themoviedb.org/tv/${config.tmdbId}?language=it-IT`);
  let seasons = extractSeasons(mainHtml);

  if (seasons.size === 0) {
    try {
      const seasonsHtml = await fetchHtml(`https://www.themoviedb.org/tv/${config.tmdbId}/seasons?language=it-IT`);
      seasons = extractSeasons(seasonsHtml);
    } catch {}
  }

  console.log(`  Trovate ${seasons.size} stagioni`);
  const allEps = [];

  for (const [seasonNum, epCount] of seasons) {
    if (seasonNum <= 0) continue;
    try {
      const html = await fetchHtml(`https://www.themoviedb.org/tv/${config.tmdbId}/season/${seasonNum}?language=it-IT`);
      const eps = extractEpisodes(html);
      if (eps.length > 0) {
        for (const ep of eps) {
          allEps.push({ season: seasonNum, episode: ep.episode, title: ep.title });
        }
      } else if (epCount > 0) {
        for (let i = 1; i <= epCount; i++) {
          allEps.push({ season: seasonNum, episode: i, title: `Episodio ${i}` });
        }
      }
    } catch (e) {
      console.warn(`  Stagione ${seasonNum} fallita: ${e.message}`);
    }
  }

  console.log(`  ${allEps.length} episodi totali`);
  return allEps;
}

async function main() {
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
  console.log(`Totale: ${totalEps} episodi`);

  fs.writeFileSync('episodes.json', JSON.stringify(db, null, 2));
  console.log('episodes.json scritto!');
}

main().catch(e => { console.error(e); process.exit(1); });
