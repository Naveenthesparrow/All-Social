import React from 'react';
import { FaHashtag, FaCopy } from 'react-icons/fa';

const ResultsDisplay = ({ results }) => {
    if (!results || results.length === 0) return null;

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg">Option {index + 1}</h3>
                        <span className="text-xs bg-white/20 px-2 py-1 rounded">Viral</span>
                    </div>

                    <div className="p-5 flex-grow flex flex-col gap-4">

                        {/* Title Section */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</span>
                                <button
                                    onClick={() => copyToClipboard(item.title)}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                    title="Copy Title"
                                >
                                    <FaCopy size={12} />
                                </button>
                            </div>
                            <p className="font-bold text-gray-800 text-lg leading-tight">{item.title}</p>
                        </div>

                        {/* Description Section */}
                        <div className="flex-grow">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</span>
                                <button
                                    onClick={() => copyToClipboard(item.description)}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                    title="Copy Description"
                                >
                                    <FaCopy size={12} />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 whitespace-pre-line">{item.description}</p>
                        </div>

                        {/* Hashtags Section */}
                        <div className="mt-2 pt-3 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <FaHashtag className="mr-1" size={10} /> Hashtags
                                </span>
                                <button
                                    onClick={() => copyToClipboard(Array.isArray(item.hashtags) ? item.hashtags.join(' ') : item.hashtags)}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                    title="Copy Hashtags"
                                >
                                    <FaCopy size={12} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {(Array.isArray(item.hashtags) ? item.hashtags : (item.hashtags || '').split(' ')).map((tag, i) => (
                                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                                        {tag.startsWith('#') ? tag : `#${tag}`}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Keywords Section */}
                        {item.keywords && (
                            <div className="mt-2 pt-3 border-t border-gray-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SEO Keywords</span>
                                    <button
                                        onClick={() => copyToClipboard(item.keywords)}
                                        className="text-gray-400 hover:text-blue-500 transition-colors"
                                        title="Copy Keywords"
                                    >
                                        <FaCopy size={12} />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{item.keywords}</p>
                            </div>
                        )}

                    </div>
                </div>
            ))}
        </div>
    );
};

export default ResultsDisplay;
