const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

// Model configuration (Switched to Gemini 1.5 Flash for stability)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

exports.analyzeVideo = async (req, res) => {
    try {
        const videoFile = req.file;
        const videoLink = req.body.videoLink;
        const responseCount = req.body.responseCount || 3;

        if (!videoFile && !videoLink) {
            return res.status(400).json({ error: "No video file or link provided." });
        }

        const channelName = req.body.channelName || "";
        const category = req.body.category || "";

        let channelContext = channelName ? `For the channel "${channelName}",` : "";
        if (category) {
            channelContext += ` targeting the "${category}" audience/niche,`;
        }

        let prompt = `Analyze this video and provide ${responseCount} unique, independent viral content options. ${channelContext}
    
    IMPORTANT: Generate exactly ${responseCount} distinct options. Each option must be a standalone analysis of the ENTRIE video from a different angle. Do NOT split the video content across the options (e.g., do not make Option 1 about the first half and Option 2 about the second half).
    
    Strictly follow these formatting rules:
    1. **Title:** Must use a pipe separator '|' (e.g., "Hook | Clarification") AND be **under 100 characters** (strict YouTube limit).
    2. **Description:** Must include specific timestamps for any key spoken words or actions (e.g., "00:15 - [Topic]").
    3. **Hashtags:** Provide 5-7 viral, high-volume hashtags. ${channelName ? `Include #${channelName.replace(/\s+/g, '')} as one of them.` : ""}
    4. **Keywords:** Provide a comma-separated list of high-ranking keywords for SEO. ${channelName ? `Include "${channelName}" in the keywords.` : ""}

    Format the output as JSON with an array of objects. Each object must have the following fields:
    - 'title' (String, max 100 chars)
    - 'description' (String)
    - 'hashtags' (Array of Strings)
    - 'keywords' (String)`;

        let result;

        // Helper function for retry logic with exponential backoff and smart retry-after
        async function generateWithRetry(fn, retries = 5, delay = 2000) {
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
                    console.log(`Rate limited (429). Retrying in ${Math.ceil(waitTime / 1000)}s... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    // Check if we extracted a specific huge waitTime, if so, maybe reset delay or keep doubling? 
                    // To be safe, we just pass the original 'delay' * 2 for the fallback geometric growth, 
                    // ignoring the one-off spike from the API request for the *next* calculation base 
                    // (unless we want to be very conservative). 
                    // Let's stick to doubling the *base* delay.
                    return generateWithRetry(fn, retries - 1, delay * 2);
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
                await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s wait
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
                }
            }), 3, 2000);

            // Cleanup local file
            fs.unlinkSync(videoFile.path);

        } else if (videoLink) {
            prompt = `Analyze the video at this link: ${videoLink}. ` + prompt;
            result = await generateWithRetry(() => model.generateContent(prompt, {
                generationConfig: {
                    responseMimeType: "application/json",
                }
            }), 3, 2000);
        }

        const responseText = result.response.text();
        let jsonString = responseText.trim();
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '');
        }
        const parsedIs = JSON.parse(jsonString);

        res.json({ results: parsedIs });

    } catch (error) {
        console.error("Error analyzing video:", error);
        res.status(500).json({ error: "Failed to analyze video." });
    }
};
