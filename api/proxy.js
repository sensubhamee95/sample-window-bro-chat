const TARGET = 'http://37.27.180.36:5005';

module.exports = async function handler(req, res) {
    // req.query.path is an array like ['api', 'customers', 'insert-with-authentication']
    const pathSegments = req.query.path || [];
    const targetPath   = '/' + pathSegments.join('/');
    const targetUrl    = `${TARGET}${targetPath}`;

    console.log(`[proxy] ${req.method} ${targetUrl}`);

    try {
        const headers = { ...req.headers };
        delete headers['host'];
        delete headers['content-length'];

        let body = null;
        if (!['GET', 'HEAD'].includes(req.method)) {
            body = JSON.stringify(req.body);
            headers['content-type'] = 'application/json';
        }

        const fetchRes = await fetch(targetUrl, {
            method:  req.method,
            headers: headers,
            body:    body,
        });

        // Copy status
        res.status(fetchRes.status);

        // Copy headers — skip ones that break streaming
        fetchRes.headers.forEach((value, key) => {
            if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key)) {
                res.setHeader(key, value);
            }
        });

        // Flush headers immediately (critical for SSE)
        res.flushHeaders();

        // Stream body back chunk by chunk
        const reader = fetchRes.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }

        res.end();

    } catch (err) {
        console.error('[proxy] error:', err.message);
        res.status(500).json({ error: 'Proxy error: ' + err.message });
    }
};