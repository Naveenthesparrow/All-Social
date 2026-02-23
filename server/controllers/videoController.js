const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

// Validate remote video links before sending to model to avoid fabricated analysis
async function isValidVideoLink(link) {
    try {
        const parsed = new URL(link);
        const host = parsed.hostname.toLowerCase();

        // YouTube: use oEmbed to check existence
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`;
            const r = await fetch(oembed);
            return r.ok;
        }

        // Vimeo: oEmbed endpoint
        if (host.includes('vimeo.com')) {
            const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}`;
            const r = await fetch(oembed);
            return r.ok;
        }

        // For direct video links or other hosts, try a HEAD request first
        try {
            let r = await fetch(link, { method: 'HEAD' });
            if (r.ok) {
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                if (ct.startsWith('video/')) return true;
                // If it's HTML, we cannot assume it's a direct video file
                if (!ct.includes('text/html')) return false;
            }
        } catch (e) {
            // Some hosts block HEAD; continue to GET-range fallback
        }

        // Fallback: request first byte to check content-type
        try {
            const r2 = await fetch(link, { method: 'GET', headers: { Range: 'bytes=0-0' } });
            if (r2.ok) {
                const ct2 = (r2.headers.get('content-type') || '').toLowerCase();
                return ct2.startsWith('video/');
            }
        } catch (e) {
            return false;
        }

        return false;
    } catch (err) {
        return false;
    }
}

// Helpers to pull YouTube metadata and captions so the model has real content
function extractYouTubeId(link) {
    try {
        const u = new URL(link);
        if (u.hostname.includes('youtu.be')) {
            return u.pathname.slice(1);
        }
        if (u.pathname.includes('embed')) {
            return u.pathname.split('/').pop();
        }
        return u.searchParams.get('v');
    } catch (e) {
        return null;
    }
}

async function fetchYouTubeOEmbed(link) {
    try {
        const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`;
        const r = await fetch(oembed);
        if (!r.ok) return null;
        return await r.json();
    } catch (e) {
        return null;
    }
}

function decodeHtmlEntities(str) {
    if (!str) return '';
    return str.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

async function fetchYouTubeCaptions(videoId) {
    if (!videoId) return null;
    const langs = ['en', 'en-US', 'a.en', 'ta', 'auto'];
    for (const lang of langs) {
        try {
            const url = `https://video.google.com/timedtext?lang=${encodeURIComponent(lang)}&v=${encodeURIComponent(videoId)}`;
            const r = await fetch(url);
            if (!r.ok) continue;
            const text = await r.text();
            if (!text || !text.includes('<text')) continue;
            // Extract text nodes
            const matches = [...text.matchAll(/<text[^>]*>(.*?)<\/text>/g)];
            const parts = matches.map(m => decodeHtmlEntities(m[1].replace(/\n/g, ' ')));
            if (parts.length) return parts.join(' ');
        } catch (e) {
            continue;
        }
    }
    return null;
}

// Model configuration (Switched to Gemini 1.5 Flash for stability)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

exports.analyzeVideo = async (req, res) => {
    try {
        const videoFile = req.file;
        const videoLink = req.body.videoLink;
        const responseCount = req.body.responseCount || 1;

        // If a link was provided, attempt to verify it's reachable/valid.
        // Do NOT reject the request if validation fails — proceed anyway (user requested any link analysis).
        let linkValidated = true;
        if (videoLink) {
            const ok = await isValidVideoLink(videoLink);
            if (!ok) {
                linkValidated = false;
                console.warn(`Could not validate video link: ${videoLink}. Proceeding anyway.`);
            }
        }

        if (!videoFile && !videoLink) {
            return res.status(400).json({ error: "No video file or link provided." });
        }

        const channelName = req.body.channelName || "";
        const category = req.body.category || "";

        // If it's a YouTube link, attempt to fetch title/author and captions to include in the prompt
        let externalMetadata = '';
        if (videoLink) {
            try {
                const parsed = new URL(videoLink);
                const host = parsed.hostname.toLowerCase();
                if (host.includes('youtube.com') || host.includes('youtu.be')) {
                    const vid = extractYouTubeId(videoLink);
                    const o = await fetchYouTubeOEmbed(videoLink);
                    const caps = await fetchYouTubeCaptions(vid);
                    // If captions were not found, try to fetch the page HTML and extract meta description / og:description
                    let pageDesc = null;
                    if (!caps) {
                        try {
                            const pageResp = await fetch(videoLink, { method: 'GET' });
                            if (pageResp.ok) {
                                const html = await pageResp.text();
                                const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
                                const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
                                if (ogMatch && ogMatch[1]) pageDesc = ogMatch[1];
                                else if (descMatch && descMatch[1]) pageDesc = descMatch[1];
                            }
                        } catch (e) {
                            // ignore page fetch errors
                        }
                    }
                    if (o && o.title) externalMetadata += `Video Title: ${o.title}. `;
                    if (o && o.author_name) externalMetadata += `Author: ${o.author_name}. `;
                    if (caps) externalMetadata += `Transcript (auto): ${caps.slice(0, 5000)} `; // include up to 5k chars
                    if (pageDesc) externalMetadata += `Description: ${pageDesc.slice(0, 5000)} `;
                    if (!externalMetadata) externalMetadata = '';
                }
            } catch (e) {
                console.warn('YouTube metadata fetch failed:', e.message || e);
            }
        }

        let channelContext = channelName ? `For the channel "${channelName}",` : "";
        if (category) {
            channelContext += ` targeting the "${category}" audience/niche,`;
        }

        const todayDate = new Date().toISOString().split('T')[0];

        // Stronger prompt that requests SEO, trending keywords, short-form clips, thumbnail text, and confidence
        let prompt = `${externalMetadata}Analyze this video and provide ${responseCount} unique, independent viral content options. ${channelContext}
    
    IMPORTANT: Generate exactly ${responseCount} distinct options. Each option must be a standalone analysis of the ENTIRE video from a different angle. Do NOT split the video content across the options (e.g., do not make Option 1 about the first half and Option 2 about the second half).
    
    Strictly follow these formatting rules:
    1. **Title:** Must use a pipe separator '|' (e.g., "Hook | Clarification") AND be **under 100 characters** (strict YouTube limit).
    2. **Description:** Must include specific timestamps for any key spoken words or actions (e.g., "00:15 - [Topic]").
    3. **Hashtags:** Provide 10 viral, high-volume hashtags. ${channelName ? `Include #${channelName.replace(/\s+/g, '')} as one of them.` : ""}
    4. **Keywords:** Provide a comma-separated list of high-ranking keywords for SEO. ${channelName ? `Include "${channelName}" in the keywords.` : ""}

    Additional requirements for SEO & virality (READ CAREFULLY):
    - For each option, include **9 short, high-volume trending keywords** (or best-guess trending keywords if live data is unavailable). Mark each keyword with a confidence score (high/medium/low).
    - Provide **10 hashtags** prioritized by virality and relevance; include one hashtag using the channel name if provided.
    - Provide **5 short-form clip suggestions** (each 8-60s) with exact timestamps and a one-line hook.
    - Suggest **thumbnail text** (15 words max) and **three thumbnail concepts** (short descriptions).
    - Provide an estimated **best posting time** (local timezone inference if possible) and an **engagement angle** (who will share/view).
    - For trending keywords: if you cannot access live trend data, infer likely trending keywords based on the video transcript and explain your confidence.
    - ALWAYS output strictly valid JSON matching the schema below; do not output any additional markdown or commentary.

    Current date (for trend context): ${todayDate}

    Format the output as JSON with an array of objects. Each object must have the following fields:
    - 'title' (String, max 130 chars)
    - 'description' (String)
    - 'hashtags' (Array of Strings)
    - 'keywords' (String)
    - 'trendingKeywords' (Array of objects: { keyword: String, confidence: "high"|"medium"|"low" })
    - 'shortFormClips' (Array of objects: { start: "MM:SS", end: "MM:SS", hook: String })
    - 'thumbnail' (Object { text: String, concepts: [String] })
    - 'bestPostTime' (String)
    - 'confidence' (String, overall confidence: high|medium|low)
    - 'hashtags' (Array of Strings)
    - 'notes' (Optional short String explaining assumptions)
    `;

        let result;

        // Helper function for retry logic with exponential backoff and smart retry-after
        async function generateWithRetry(fn, retries = 5, delay = 1000) {
            try {
                return await fn();
            } catch (error) {
                let waitTime = delay;

                // Try to parse specific retry delay from error details
                if (error.errorDetails) {
                    const retryInfo = error.errorDetails.find(d => d['@type']?.includes('RetryInfo'));
                    if (retryInfo && retryInfo.retryDelay) {
                        const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
                        if (!isNaN(seconds)) {
                            waitTime = (seconds * 1000) + 1000; // Add 1s buffer
                            console.log(`API requested wait: ${waitTime}ms`);
                        }
                    }
                }

                if (retries > 0 && (error.status === 429 || error.status === 503)) {
                    console.log(`Rate limited. Retrying in ${Math.ceil(waitTime / 1000)}s... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return generateWithRetry(fn, retries - 1, Math.min(delay * 2, 8000));
                } else {
                    throw error;
                }
            }
        }

        if (videoFile) {
            // Upload file to Gemini using GoogleAIFileManager
            const { GoogleAIFileManager } = require("@google/generative-ai/server");
            const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

            const uploadResponse = await fileManager.uploadFile(videoFile.path, {
                mimeType: videoFile.mimetype,
                displayName: "Uploaded Video",
            });

            console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);

            let file = await fileManager.getFile(uploadResponse.file.name);
            while (file.state === "PROCESSING") {
                process.stdout.write(".");
                await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s wait (faster polling)
                file = await fileManager.getFile(uploadResponse.file.name);
            }

            if (file.state === "FAILED") {
                throw new Error("Video processing failed.");
            }

            console.log("Video is active. Generative content...");

            result = await generateWithRetry(() => model.generateContent([
                prompt,
                {
                    fileData: {
                        mimeType: uploadResponse.file.mimeType,
                        fileUri: uploadResponse.file.uri
                    }
                }
            ], {
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.6,
                    maxOutputTokens: 2048
                }
            }), 2, 1000);

            // Cleanup local file
            fs.unlinkSync(videoFile.path);

        } else if (videoLink) {
            const validationNote = linkValidated ? '' : 'NOTE: Could not verify link reachability; analyze based on the provided link and available metadata. ';
            prompt = `${validationNote}Analyze the video at this link: ${videoLink}. ` + prompt;
            result = await generateWithRetry(() => model.generateContent(prompt, {
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.6,
                    maxOutputTokens: 2048
                }
            }), 2, 1000);
        }

        try {
            const responseText = result.response.text();
            let jsonString = responseText.trim();
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '');
            }
            const parsedIs = JSON.parse(jsonString);

            // Basic validation: ensure array and required keys exist, otherwise request reformat from model
            function isValidSchema(arr) {
                if (!Array.isArray(arr)) return false;
                for (const obj of arr) {
                    if (!obj.title || !obj.description || !obj.hashtags || !obj.keywords) return false;
                }
                return true;
            }

            if (!isValidSchema(parsedIs)) {
                console.warn('Parsed model output did not match expected schema, requesting reformat.');
                // Ask model to reformat strictly as JSON according to schema using the previous output as context
                const reformatPrompt = `The previous response did not follow the required JSON schema. Reformat the following content strictly as JSON array of objects matching the original schema without commentary: ${jsonString}`;
                const reResult = await generateWithRetry(() => model.generateContent(reformatPrompt, {
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1024 }
                }), 1, 1000);
                let reText = reResult.response.text().trim();
                if (reText.startsWith('```json')) reText = reText.replace(/^```json/, '').replace(/```$/, '');
                try {
                    const reParsed = JSON.parse(reText);
                    return res.json({ results: reParsed });
                } catch (e) {
                    console.error('Reformatting failed:', e);
                    return res.status(502).json({ error: 'Model returned invalid JSON and reformatting failed.' });
                }
            }

            res.json({ results: parsedIs });
        } catch (parseError) {
            console.error("Failed to parse model response:", parseError);
            return res.status(502).json({ error: "Invalid response from model service." });
        }

    } catch (error) {
        console.error("Error analyzing video:", error);

        // Default
        let status = error.status && Number.isInteger(error.status) ? error.status : 500;
        let message = error.message || "Failed to analyze video.";

        // Try to extract RetryInfo / retryDelay from various possible error shapes
        let retryAfterSeconds = null;
        try {
            // 1) Structured field (used earlier in retry helper)
            if (error.errorDetails) {
                const retryInfo = error.errorDetails.find(d => d['@type']?.includes('RetryInfo'));
                if (retryInfo && retryInfo.retryDelay) {
                    const m = String(retryInfo.retryDelay).match(/([0-9.]+)s/);
                    if (m) retryAfterSeconds = parseFloat(m[1]);
                }
            }

            // 2) Some libraries nest the response body: error.response.data
            if (retryAfterSeconds === null && error.response && error.response.data) {
                const body = error.response.data;
                const text = typeof body === 'string' ? body : JSON.stringify(body);
                const m = text.match(/"retryDelay"\s*:\s*"?([0-9.]+)s"?/i);
                if (m) retryAfterSeconds = parseFloat(m[1]);
            }

            // 3) Last resort: stringify full error
            if (retryAfterSeconds === null) {
                const s = JSON.stringify(error);
                const m = s.match(/"retryDelay"\s*:\s*"?([0-9.]+)s"?/i);
                if (m) retryAfterSeconds = parseFloat(m[1]);
            }
        } catch (e) {
            // ignore parsing errors
        }

        // If this is a rate-limit / quota error, make it explicit and include retryAfter (seconds) if present
        if (status === 429 || /quota|rate limit|Too Many Requests/i.test(message)) {
            status = 429;
            if (!message) message = 'Quota exceeded or rate limited by the generative model API.';
            const payload = { error: message };
            if (retryAfterSeconds !== null && !Number.isNaN(retryAfterSeconds)) {
                payload.retryAfter = Math.ceil(retryAfterSeconds);
            }
            return res.status(429).json(payload);
        }

        res.status(status).json({ error: message });
    }
};
