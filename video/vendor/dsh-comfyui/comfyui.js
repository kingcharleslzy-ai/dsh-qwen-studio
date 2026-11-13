/**
 * Minimal ComfyUI HTTP API client: queue a workflow, poll history for
 * completion, read object_info/system_stats, and fetch generated media.
 * Only the endpoints dsh-comfyui needs are implemented; the server's own
 * WebSocket progress channel is deliberately unused (history polling is
 * simpler and works across proxies and remote installs).
 */
import { randomUUID } from 'node:crypto';
/** Failure talking to the ComfyUI server. */
export class ComfyUIError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'ComfyUIError';
    }
}
function sleep(millis, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new ComfyUIError('ComfyUI generation aborted'));
            return;
        }
        const timer = setTimeout(resolve, millis);
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new ComfyUIError('ComfyUI generation aborted'));
        }, { once: true });
    });
}
export function guessContentType(filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png'))
        return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
        return 'image/jpeg';
    if (lower.endsWith('.webp'))
        return 'image/webp';
    if (lower.endsWith('.gif'))
        return 'image/gif';
    if (lower.endsWith('.mp4'))
        return 'video/mp4';
    if (lower.endsWith('.webm'))
        return 'video/webm';
    if (lower.endsWith('.avi'))
        return 'video/x-msvideo';
    if (lower.endsWith('.mp3'))
        return 'audio/mpeg';
    if (lower.endsWith('.wav'))
        return 'audio/wav';
    if (lower.endsWith('.ogg'))
        return 'audio/ogg';
    if (lower.endsWith('.flac'))
        return 'audio/flac';
    if (lower.endsWith('.m4a'))
        return 'audio/mp4';
    if (lower.endsWith('.aac'))
        return 'audio/aac';
    if (lower.endsWith('.opus'))
        return 'audio/opus';
    return 'application/octet-stream';
}
/** The per-process client id ComfyUI uses to correlate queued prompts. */
export const CLIENT_ID = randomUUID();
/**
 * Route prefix learned per base URL: '' when bare routes answer, '/api' when
 * only the /api-prefixed mirror does. ComfyUI serves every route under both,
 * but API-only reverse proxies (comfy-api-proxy, Issue #6) forward just
 * `/api/*`, so the bare /system_stats probe 404s. Learned on the first
 * request and kept for the process — clients are created per call.
 */
const routePrefix = new Map();
/** HTTP client over the ComfyUI REST API. */
export class ComfyUIClient {
    baseUrl;
    apiKey;
    connectTimeoutMs;
    maxMediaBytes;
    constructor(baseUrl, apiKey, connectTimeoutMs, maxMediaBytes) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.connectTimeoutMs = connectTimeoutMs;
        this.maxMediaBytes = maxMediaBytes;
    }
    base() {
        return this.baseUrl.replace(/\/+$/, '');
    }
    endpoint(path) {
        if (path.startsWith('/api/'))
            return `${this.base()}${path}`;
        return `${this.base()}${routePrefix.get(this.base()) ?? ''}${path}`;
    }
    /** fetch() one route, retrying a 404 under /api until the prefix is known. */
    async fetchRoute(path, init) {
        const base = this.base();
        const response = await fetch(this.endpoint(path), init);
        if (path.startsWith('/api/') || routePrefix.has(base))
            return response;
        if (response.ok) {
            routePrefix.set(base, '');
            return response;
        }
        if (response.status !== 404)
            return response;
        const retry = await fetch(`${base}/api${path}`, init);
        if (!retry.ok) {
            await retry.body?.cancel();
            return response;
        }
        routePrefix.set(base, '/api');
        await response.body?.cancel();
        return retry;
    }
    async request(path, init = {}, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.connectTimeoutMs);
        try {
            const headers = { ...init.headers };
            if (this.apiKey !== undefined)
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            const response = await this.fetchRoute(path, { ...init, headers, signal: controller.signal });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new ComfyUIError(`ComfyUI ${path} failed: HTTP ${response.status}${body !== '' ? ` — ${body.slice(0, 300)}` : ''}`, response.status);
            }
            const text = await response.text();
            if (text === '')
                return undefined;
            try {
                return JSON.parse(text);
            }
            catch {
                throw new ComfyUIError(`ComfyUI ${path} returned non-JSON body`);
            }
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** Best-effort GET of an arbitrary JSON endpoint on the ComfyUI server.
     *
     * Used to force TTS-Audio-Suite's voice-library rescan, a custom-node API
     * route that is not part of the core API. Resolves true when the request
     * succeeds, false on any failure (404 on servers without the route, auth,
     * network). The response body is discarded. */
    async getOk(path, timeoutMs) {
        try {
            await this.request(path, {}, timeoutMs);
            return true;
        }
        catch {
            return false;
        }
    }
    /** Upload a file (multipart body forwarded verbatim) into ComfyUI's input directory. */
    /** Forward a multipart/form-data upload body verbatim (the browser's own
     * form, field "image", as ComfyUI's /upload/image expects it). */
    async uploadFile(body, contentType) {
        const data = await this.request('/upload/image', {
            method: 'POST',
            headers: { 'content-type': contentType },
            body,
        });
        return data ?? {};
    }
    /**
     * Put one file into ComfyUI's input directory (images, video, audio alike).
     *
     * /upload/image only accepts multipart/form-data: posting the bytes as a
     * raw body with their own content-type answers HTTP 400, which is why
     * picking a generated file into the load area used to fail instead of
     * copying it. The form is built here so callers can pass plain bytes.
     * `overwrite` keeps a repeated pick from piling up "name (1).png" copies.
     */
    async uploadMedia(bytes, filename, contentType, opts = {}) {
        const form = new FormData();
        form.append('image', new Blob([bytes], { type: contentType !== '' ? contentType : 'application/octet-stream' }), filename);
        form.append('overwrite', opts.overwrite === false ? 'false' : 'true');
        if (opts.subfolder !== undefined && opts.subfolder !== '')
            form.append('subfolder', opts.subfolder);
        // Video files are large; the connect timeout is far too tight for them.
        const data = await this.request('/upload/image', { method: 'POST', body: form }, opts.timeoutMs ?? Math.max(this.connectTimeoutMs, 120_000));
        return data ?? {};
    }
    /** Queue one API-format workflow and return its prompt id. */
    async queuePrompt(workflow, options = {}) {
        const payload = { prompt: workflow, client_id: CLIENT_ID };
        if (options.promptId !== undefined)
            payload['prompt_id'] = options.promptId;
        if (options.front === true)
            payload['front'] = true;
        if (options.extraData !== undefined && Object.keys(options.extraData).length > 0) {
            payload['extra_data'] = options.extraData;
        }
        const data = await this.request('/prompt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (typeof data.prompt_id !== 'string') {
            throw new ComfyUIError('ComfyUI /prompt returned no prompt_id');
        }
        return data.prompt_id;
    }
    /** Read one prompt's history entry; undefined while the prompt is unknown or evicted. */
    async getHistory(promptId) {
        const data = await this.request(`/history/${encodeURIComponent(promptId)}`);
        return data[promptId];
    }
    /** The server-side queue: running + pending prompts. */
    async getQueue() {
        // ComfyUI serializes each queue slot as [number, prompt_id, prompt, ...];
        // only the number and prompt_id are needed here.
        const raw = await this.request('/queue');
        const parse = (list) => {
            if (!Array.isArray(list))
                return [];
            const items = [];
            for (const entry of list) {
                if (Array.isArray(entry) && typeof entry[1] === 'string' && entry[1] !== '') {
                    items.push({ number: typeof entry[0] === 'number' ? entry[0] : 0, prompt_id: entry[1] });
                }
            }
            return items;
        };
        return { queue_running: parse(raw.queue_running), queue_pending: parse(raw.queue_pending) };
    }
    /** Unified job list with status filters, sorting, and pagination. */
    async getJobs(options = {}) {
        const params = new URLSearchParams();
        if (options.status !== undefined && options.status.length > 0)
            params.set('status', options.status.join(','));
        if (options.limit !== undefined)
            params.set('limit', String(options.limit));
        if (options.offset !== undefined)
            params.set('offset', String(options.offset));
        if (options.sortBy !== undefined)
            params.set('sort_by', options.sortBy);
        if (options.sortOrder !== undefined)
            params.set('sort_order', options.sortOrder);
        const query = params.toString();
        return this.request(`/api/jobs${query !== '' ? `?${query}` : ''}`);
    }
    /** One job by id, including its workflow prompt and outputs. */
    async getJob(jobId) {
        try {
            return await this.request(`/api/jobs/${encodeURIComponent(jobId)}`);
        }
        catch (error) {
            if (error instanceof ComfyUIError && error.status === 404)
                return undefined;
            throw error;
        }
    }
    /** Remove specific prompts from the pending queue. */
    async deleteQueueItems(promptIds) {
        await this.request('/queue', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ delete: promptIds }),
        });
    }
    /** Clear the entire pending queue (running job is unaffected). */
    async clearQueue() {
        await this.request('/queue', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ clear: true }),
        });
    }
    /**
     * Stop one prompt without touching anyone else's work: dequeue it while
     * pending, interrupt it only while it is the running one, no-op once it has
     * left the queue. A bare `interrupt()` stops whatever is running — another
     * session's job or the user's own ComfyUI run — and ComfyUI versions before
     * prompt-scoped interrupts ignore the `prompt_id` body, hence the queue
     * check. (Older servers keep a tiny race: the prompt could finish between
     * the check and the interrupt.)
     */
    async cancelPrompt(promptId) {
        const queue = await this.getQueue();
        if (queue.queue_pending.some((item) => item.prompt_id === promptId)) {
            await this.deleteQueueItems([promptId]);
            return;
        }
        if (queue.queue_running.some((item) => item.prompt_id === promptId)) {
            await this.interruptPrompt(promptId);
        }
    }
    /** Interrupt the running prompt; without an id, interrupt globally. */
    async interruptPrompt(promptId) {
        await this.request('/interrupt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(promptId !== undefined ? { prompt_id: promptId } : {}),
        });
    }
    /** Cancel one job regardless of state (running → interrupt, pending → dequeue). */
    async cancelJob(jobId) {
        return this.request(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
        });
    }
    /** Best-effort batch cancel; finished or unknown ids are no-ops. */
    async cancelJobs(jobIds) {
        return this.request('/api/jobs/cancel', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ job_ids: jobIds }),
        });
    }
    /** Clear or selectively delete history entries. */
    async clearHistory() {
        await this.request('/history', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ clear: true }),
        });
    }
    /** Delete specific history entries. */
    async deleteHistory(promptIds) {
        await this.request('/history', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ delete: promptIds }),
        });
    }
    /** Ask ComfyUI to unload models / free memory (per /free flags). */
    async freeMemory(options = {}) {
        await this.request('/free', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ unload_models: options.unloadModels === true, free_memory: options.freeMemory === true }),
        });
    }
    /** List one user-data subdirectory (e.g. 'workflows') on the ComfyUI server. */
    async listUserData(subdir) {
        let data;
        try {
            data = await this.request(`/v2/userdata?path=${encodeURIComponent(subdir)}`);
        }
        catch (error) {
            // Some builds (e.g. the 0.35 desktop app, Issue #5) have no /v2/userdata;
            // the v1 listing takes `dir` and returns paths relative to it.
            if (!(error instanceof ComfyUIError) || error.status !== 404)
                throw error;
            const legacy = await this.request(`/userdata?dir=${encodeURIComponent(subdir)}&recurse=true&split=false&full_info=true`);
            if (!Array.isArray(legacy))
                return [];
            return legacy.map((item) => {
                const rel = (typeof item === 'string' ? item : item.path).replace(/\\/g, '/');
                const entry = { name: rel, path: `${subdir}/${rel}`, type: 'file' };
                if (typeof item !== 'string' && item.size !== undefined)
                    entry.size = item.size;
                if (typeof item !== 'string' && item.modified !== undefined)
                    entry.modified = item.modified;
                return entry;
            });
        }
        if (!Array.isArray(data))
            return [];
        if (typeof data[0] === 'string') {
            return data.map((name) => ({ name, path: `${subdir}/${name}`, type: 'file' }));
        }
        return data;
    }
    /** Read one user-data file (path relative to the user root, e.g. 'workflows/x.json'). */
    async getUserDataFile(relPath) {
        // The {file} route matches a single segment only, so the relative path is
        // URL-encoded (the handler unquotes it) — see app/user_manager.py.
        return this.request(`/userdata/${encodeURIComponent(relPath)}`);
    }
    /** Node definitions for workflow construction (comfyui_object_info). */
    async objectInfo() {
        return this.request('/object_info');
    }
    /** Server health/version probe. */
    async systemStats() {
        return this.request('/system_stats');
    }
    /** Download one generated media file through GET /view. */
    async fetchView(ref) {
        const params = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder, type: ref.type });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.connectTimeoutMs);
        try {
            const headers = {};
            if (this.apiKey !== undefined)
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            const response = await this.fetchRoute(`/view?${params.toString()}`, { headers, signal: controller.signal });
            if (!response.ok) {
                throw new ComfyUIError(`ComfyUI /view failed: HTTP ${response.status}`);
            }
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.byteLength > this.maxMediaBytes) {
                throw new ComfyUIError(`ComfyUI media too large: ${bytes.byteLength} bytes exceeds maxMediaBytes ${this.maxMediaBytes}`);
            }
            return { bytes, contentType: response.headers.get('content-type') ?? guessContentType(ref.filename) };
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * Stream one generated media file through GET /view without buffering it,
     * honoring an optional Range header so the browser can seek in audio/video
     * (the media proxy re-emits the status/headers and pipes the body). ComfyUI
     * answers valid ranges with 206 + Content-Range and out-of-range starts with
     * 416 — both pass through untouched. HEAD forwards as HEAD so no body is
     * downloaded. The maxMediaBytes guard applies to the full 200 response only
     * (a partial segment is bounded by definition).
     */
    async fetchViewStreamed(ref, rangeHeader, method = 'GET') {
        const params = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder, type: ref.type });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.connectTimeoutMs);
        try {
            const headers = {};
            if (this.apiKey !== undefined)
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            if (rangeHeader !== undefined)
                headers['Range'] = rangeHeader;
            const response = await this.fetchRoute(`/view?${params.toString()}`, { headers, method, signal: controller.signal });
            if (response.status !== 206 && response.status !== 416 && !response.ok) {
                await response.body?.cancel().catch(() => undefined);
                throw new ComfyUIError(`ComfyUI /view failed: HTTP ${response.status}`, response.status);
            }
            if (response.status === 200) {
                const contentLength = response.headers.get('content-length');
                if (contentLength !== null && Number(contentLength) > this.maxMediaBytes) {
                    await response.body?.cancel().catch(() => undefined);
                    throw new ComfyUIError(`ComfyUI media too large: ${contentLength} bytes exceeds maxMediaBytes ${this.maxMediaBytes}`, 413);
                }
            }
            return { status: response.status, headers: response.headers, body: response.body };
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * Poll history until the prompt completes, fails, or the budget/signal ends.
     * When the signal aborts — mid-sleep included — cancels this prompt only
     * (`cancelPrompt`) and throws an "interrupted" error. `onPoll` runs once per
     * poll, for callers that publish progress.
     */
    async waitForCompletion(opts) {
        const { promptId, timeoutMs, pollIntervalMs, signal, onPoll } = opts;
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            if (signal.aborted) {
                await this.cancelPrompt(promptId).catch(() => undefined);
                throw new ComfyUIError(`ComfyUI generation interrupted (prompt ${promptId})`);
            }
            onPoll?.();
            const entry = await this.getHistory(promptId);
            if (entry !== undefined) {
                const status = entry.status;
                if (status?.status_str === 'success' || status?.completed === true || hasMedia(entry)) {
                    return entry;
                }
                if (status?.status_str === 'error') {
                    throw new ComfyUIError(historyErrorMessage(promptId, entry));
                }
            }
            if (Date.now() >= deadline) {
                throw new ComfyUIError(`ComfyUI generation timed out after ${timeoutMs} ms (prompt ${promptId})`);
            }
            // An abort ends the sleep early; the loop top then cancels and throws.
            await sleep(pollIntervalMs, signal).catch(() => undefined);
        }
    }
}
export function hasMedia(entry) {
    for (const output of Object.values(entry.outputs ?? {})) {
        if ((output.images?.length ?? 0) > 0 || (output.videos?.length ?? 0) > 0 || (output.gifs?.length ?? 0) > 0 || (output.audio?.length ?? 0) > 0) {
            return true;
        }
    }
    return false;
}
/** Compose a readable failure message from history status messages. */
export function historyErrorMessage(promptId, entry) {
    const details = [];
    for (const message of entry.status?.messages ?? []) {
        if (Array.isArray(message) && typeof message[0] === 'string') {
            const [, payload] = message;
            if (typeof payload === 'object' && payload !== null) {
                const record = payload;
                if (typeof record.exception_message === 'string') {
                    details.push(record.exception_message.slice(0, 500));
                }
                else if (typeof record.exception_type === 'string') {
                    details.push(record.exception_type);
                }
            }
        }
    }
    return `ComfyUI execution failed (prompt ${promptId}): ${details.join('; ') || 'unknown error'}`;
}
/**
 * Build the same-origin proxy URL for one media file.
 *
 * The file is addressed by its own name/subfolder/type rather than by
 * prompt+node+index: the latter has to be resolved through ComfyUI's
 * /history, which lives in memory and is dropped on server restart or a
 * "clear history" click — after which every stored asset URL 404s even though
 * the file is still sitting in the output directory. Addressing the file
 * directly keeps old assets viewable for as long as the file exists.
 */
export function mediaProxyUrl(ref, proxyBase) {
    const query = new URLSearchParams({ file: ref.filename, subfolder: ref.subfolder ?? '', type: ref.type ?? 'output' });
    return `${proxyBase ?? ''}/comfyui/media?${query.toString()}`;
}
/**
 * Collect media items from a completed history entry, in node/output order,
 * capped by maxItems. The URL is the same-origin proxy route when a web
 * server is present, otherwise the bare filename (for headless hosts).
 */
export function collectMedia(opts) {
    const { entry, maxItems, proxyBase } = opts;
    const items = [];
    const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i;
    const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i;
    for (const [node, output] of Object.entries(entry.outputs ?? {})) {
        const collections = [
            ['image', output.images],
            ['video', output.videos],
            // GIFs are displayable images (animated), not opaque "other".
            ['image', output.gifs],
            // Audio previews (PreviewAudio) and saves (SaveAudio) surface through
            // the `audio` field; classify by extension like everything else.
            ['audio', output.audio],
        ];
        for (const [kind, refs] of collections) {
            for (const [index, ref] of (refs ?? []).entries()) {
                if (items.length >= maxItems)
                    return items;
                // Some nodes emit audio/video filenames through the image/video
                // arrays; classify them by extension so the card renders a player.
                const itemKind = AUDIO_EXT.test(ref.filename) ? 'audio' : VIDEO_EXT.test(ref.filename) ? 'video' : kind;
                items.push({
                    ...ref,
                    node,
                    index,
                    kind: itemKind,
                    url: proxyBase !== undefined ? mediaProxyUrl(ref, proxyBase) : ref.filename,
                });
            }
        }
    }
    return items;
}
