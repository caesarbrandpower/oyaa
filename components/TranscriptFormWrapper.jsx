'use client';

import { useState } from 'react';
import TranscriptForm from '@/components/TranscriptForm';
import OutputCard from '@/components/OutputCard';

export default function TranscriptFormWrapper({ projectId }) {
  const [latestResult, setLatestResult] = useState(null);

  function handleResult(result, outputType) {
    setLatestResult({
      result,
      output_type: outputType,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <>
      <TranscriptForm projectId={projectId} onResult={handleResult} />

      {latestResult && (
        <div className="mt-6">
          <OutputCard output={latestResult} />
        </div>
      )}
    </>
  );
}
