import React, { useState } from 'react';
import VideoUpload from './components/VideoUpload';
import ResultsDisplay from './components/ResultsDisplay';

function App() {
  const [results, setResults] = useState(null);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold mb-8 text-blue-600">Viral Video Metadata Generator</h1>

      <div className="w-full max-w-4xl px-4">
        <VideoUpload onResults={setResults} />

        {results && <ResultsDisplay results={results} />}
      </div>
    </div>
  );
}

export default App;
