import React, { useState } from 'react';
import axios from 'axios';
import { FaCloudUploadAlt, FaSpinner } from 'react-icons/fa';

const VideoUpload = ({ onResults }) => {
    const [file, setFile] = useState(null);
    const [videoLink, setVideoLink] = useState('');
    const [channelName, setChannelName] = useState('');
    const [category, setCategory] = useState('');
    const [responseCount, setResponseCount] = useState('1');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retrySeconds, setRetrySeconds] = useState(0);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setVideoLink('');
    };

    const handleLinkChange = (e) => {
        setVideoLink(e.target.value);
        setFile(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file && !videoLink) {
            setError('Please provide a video file or link.');
            return;
        }

        setLoading(true);
        setError(null);
        onResults(null);

        const formData = new FormData();
        if (file) {
            formData.append('video', file);
        } else {
            formData.append('videoLink', videoLink);
        }
        const rcNum = Number(responseCount) || 1;
        formData.append('responseCount', rcNum);
        formData.append('channelName', channelName);
        formData.append('category', category);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
            const response = await axios.post(`${apiUrl}/api/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Accept: 'application/json',
                },
                timeout: 120000,
            });
            onResults(response.data.results);
        } catch (err) {
            if (err?.response) {
                console.error('Server error response:', err.response);
                const serverMessage = err.response.data?.error || JSON.stringify(err.response.data);
                setError(`${err.response.status}: ${serverMessage}`);
                const ra = err.response.data?.retryAfter || err.response.data?.retry_after || null;
                if (ra && Number(ra) > 0) {
                    setRetrySeconds(Number(ra));
                }
            } else {
                console.error('Network or client error:', err);
                setError(err.message || 'Failed to analyze video. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Countdown effect for retrySeconds
    React.useEffect(() => {
        if (!retrySeconds || retrySeconds <= 0) return undefined;
        const id = setInterval(() => {
            setRetrySeconds((s) => {
                if (s <= 1) {
                    clearInterval(id);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [retrySeconds]);

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Upload Video for Analysis</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer relative">
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center">
                        <FaCloudUploadAlt className="text-5xl text-blue-500 mb-2" />
                        <p className="text-gray-600 font-medium">{file ? file.name : "Drag & Drop or Click to Upload Video"}</p>
                        <p className="text-xs text-gray-400 mt-1">Supported formats: MP4, MOV, AVI</p>
                    </div>
                </div>

                <div className="text-center text-gray-400 font-medium">- OR -</div>

                {/* Video Link Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Video Link (YouTube, etc.)</label>
                    <input
                        type="text"
                        value={videoLink}
                        onChange={handleLinkChange}
                        placeholder="Paste video link here"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        disabled={!!file}
                    />
                </div>

                {/* Channel Name Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name (Optional)</label>
                    <input
                        type="text"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        placeholder="e.g. TechDaily"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Used for SEO keywords and hashtags.</p>
                </div>

                {/* Category Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
                    <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. Gaming, Education, Vlog"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Helps tailor the tone and audience.</p>
                </div>

                {/* Response Count Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of Variations (1-5)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        value={responseCount}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                                setResponseCount('');
                                return;
                            }
                            const v = parseInt(val, 10);
                            if (Number.isNaN(v)) {
                                setResponseCount('');
                            } else {
                                setResponseCount(String(Math.max(1, Math.min(5, v))));
                            }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Retry countdown */}
                {retrySeconds > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                        Retry available in: {new Date(retrySeconds * 1000).toISOString().substr(14, 5)}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || retrySeconds > 0}
                    className={`w-full py-3 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center ${(loading || retrySeconds > 0) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {loading ? (
                        <>
                            <FaSpinner className="animate-spin mr-2" /> Analyzing...
                        </>
                    ) : retrySeconds > 0 ? (
                        `Retry in ${new Date(retrySeconds * 1000).toISOString().substr(14, 5)}`
                    ) : (
                        'Generate Viral Metadata'
                    )}
                </button>
            </form>
        </div>
    );
};

export default VideoUpload;
