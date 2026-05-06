const TARGET = 'http://37.27.180.36:5005';

module.exports = async function handler(req, res) {
    const pathSegments = req.query.path || [];
    const targetPath   = '/' + pathSegments.join('/');
    const targetUrl    = `${TARGET}${targetPath}`;

    console.log(`[proxy] ${req.method} → ${targetUrl}`);
    console.log(`[proxy] body:`, req.body);

    try {
        const headers = {};

        // Only forward these specific headers
        if (req.headers['x-api-key'])    headers['x-api-key']    = req.headers['x-api-key'];
        if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
        if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

        const fetchOptions = {
            method:  req.method,
            headers: headers,
        };

        // Attach body for non-GET requests
        if (!['GET', 'HEAD'].includes(req.method) && req.body) {
            fetchOptions.body = JSON.stringify(req.body);
            headers['content-type'] = 'application/json';
        }

        const fetchRes = await fetch(targetUrl, fetchOptions);

        console.log(`[proxy] response status: ${fetchRes.status}`);

        // Set response status
        res.status(fetchRes.status);

        // Forward safe headers only
        const contentType = fetchRes.headers.get('content-type');
        if (contentType) res.setHeader('content-type', contentType);

        const isSSE = contentType && contentType.includes('text/event-stream');

        if (isSSE) {
            // SSE streaming
            res.setHeader('cache-control', 'no-cache');
            res.setHeader('connection', 'keep-alive');
            res.setHeader('x-accel-buffering', 'no');
            res.flushHeaders();

            const reader = fetchRes.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
            }
            res.end();
        } else {
            // Regular JSON response
            const text = await fetchRes.text();
            res.send(text);
        }

    } catch (err) {
        console.error('[proxy] error:', err);
        res.status(500).json({ error: 'Proxy error: ' + err.message });
    }
};