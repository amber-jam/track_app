export default async function handler(req, res) {
  const { url } = req.query;
  const debug = req.query.debug === '1';

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing url query parameter.' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid URL.' });
    return;
  }

  const allowedHosts = ['tfrrs.org', 'www.tfrrs.org', 'milesplit.com', 'www.milesplit.com', 'al.milesplit.com'];
  if (!allowedHosts.includes(parsed.hostname)) {
    res.status(400).json({ error: 'Host is not allowed.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    console.log(`[profile-proxy] fetching: ${parsed.toString()}`);
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'TrackFlowPro/1.0 (+https://track-app-delta.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    console.log(`[profile-proxy] upstream status: ${upstream.status}`);
    console.log(`[profile-proxy] upstream final URL: ${upstream.url}`);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream request failed with ${upstream.status}.` });
      return;
    }

    const html = await upstream.text();
    console.log(`[profile-proxy] html length: ${html.length}`);
    console.log(`[profile-proxy] html preview: ${html.slice(0, 1000).replace(/\s+/g, ' ')}`);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    if (debug) {
      res.status(200).json({
        html,
        debug: {
          status: upstream.status,
          redirected: upstream.redirected,
          finalUrl: upstream.url,
          htmlLength: html.length,
          htmlPreview: html.slice(0, 1000),
          tableCount: (html.match(/<table/gi) || []).length,
        },
      });
      return;
    }
    res.status(200).json({ html });
  } catch (error) {
    clearTimeout(timeout);
    const isAbort = error?.name === 'AbortError';
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? 'Upstream timeout.' : 'Proxy request failed.' });
  }
}
