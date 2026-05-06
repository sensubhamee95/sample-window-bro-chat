export const config = { runtime: 'edge' };

const TARGET = 'http://37.27.180.36:5005';

export default async function handler(req) {
    const url = new URL(req.url);

    // Strip /api/proxy prefix → forward the rest to your backend
    const targetPath = url.pathname.replace('/api/proxy', '');
    const targetUrl  = `${TARGET}${targetPath}${url.search}`;

    const headers = new Headers(req.headers);
    headers.delete('host');

    const response = await fetch(targetUrl, {
        method:  req.method,
        headers: headers,
        body:    ['GET','HEAD'].includes(req.method) ? null : req.body,
        duplex:  'half',
    });

    return new Response(response.body, {
        status:  response.status,
        headers: response.headers,
    });
}