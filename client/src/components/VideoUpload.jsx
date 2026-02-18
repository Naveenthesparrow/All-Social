import React, { useState } from 'react';
import axios from 'axios';
import { FaCloudUploadAlt, FaSpinner } from 'react-icons/fa';

const VideoUpload = ({ onResults }) => {
    const [file, setFile] = useState(null);
    const [videoLink, setVideoLink] = useState('');
    const [channelName, setChannelName] = useState('');
    const [category, setCategory] = useState('');
    const [responseCount, setResponseCount] = useState(3);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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
        formData.append('responseCount', responseCount);
        formData.append('channelName', channelName);
        formData.append('category', category);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await axios.post(`${apiUrl}/api/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            onResults(response.data.results);
        } catch (err) {
            console.error(err);
            setError('Failed to analyze video. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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
                        onChange={(e) => setResponseCount(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {loading ? (
                        <>
                            <FaSpinner className="animate-spin mr-2" /> Analyzing...
                        </>
                    ) : (
                        'Generate Viral Metadata'
                    )}
                </button>
            </form>
        </div>
    );
};

export default VideoUpload;
