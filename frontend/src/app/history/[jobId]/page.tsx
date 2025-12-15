'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useJobDetails, useJobPages, usePdfUrl } from '@/hooks/useJobDetails';
import { PageGrid } from '@/components/PageGrid';
import { DownloadButton } from '@/components/DownloadButton';

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    processing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
    failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
  };

  const style = statusStyles[status] || statusStyles.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId ? parseInt(params.jobId as string, 10) : null;

  const { jobDetails, isLoading: isLoadingDetails, error: detailsError } = useJobDetails(jobId);
  const { pagesData, isLoading: isLoadingPages, error: pagesError } = useJobPages(jobId);
  const { pdfUrl, isLoading: isLoadingPdf, error: pdfError } = usePdfUrl(jobId);

  const isLoading = isLoadingDetails || isLoadingPages || isLoadingPdf;
  const error = detailsError || pagesError;

  const handlePageClick = (pageNumber: number) => {
    if (jobId) {
      router.push(`/history/${jobId}/${pageNumber}`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-24">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    );
  }

  if (error || !jobDetails) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load job details
          </h2>
          <p className="text-red-600 mb-4">{error || 'Job not found'}</p>
          <Link
            href="/history"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/history" className="text-blue-600 hover:text-blue-800">
              History
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600 truncate max-w-xs">
            {jobDetails.fileName}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">
              {jobDetails.fileName}
            </h1>
            <p className="text-gray-500 mt-1">{formatDate(jobDetails.uploadedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(jobDetails.status)}
            {jobDetails.status === 'completed' && jobId && (
              <DownloadButton jobId={jobId} />
            )}
          </div>
        </div>

        {/* Job details grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Total Pages</dt>
            <dd className="font-medium text-gray-900">{jobDetails.totalPages}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Selected Pages</dt>
            <dd className="font-medium text-gray-900">
              {jobDetails.selectedPages.length}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Progress</dt>
            <dd className="font-medium text-gray-900">{jobDetails.progress}%</dd>
          </div>
          <div>
            <dt className="text-gray-500">Processed</dt>
            <dd className="font-medium text-gray-900">
              {jobDetails.processedPages} / {jobDetails.selectedPages.length}
            </dd>
          </div>
        </div>

        {/* Conversion settings */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Settings: {jobDetails.dpi} DPI | {jobDetails.tileSize}x{jobDetails.tileSize} tiles |{' '}
            {jobDetails.overlap}px overlap
          </p>
        </div>

        {/* Error message */}
        {jobDetails.errorMessage && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            {jobDetails.errorMessage}
          </div>
        )}
      </div>

      {/* Page grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Processed Pages
        </h2>
        <PageGrid
          pages={pagesData?.pages || []}
          pdfUrl={pdfUrl}
          selectedPages={jobDetails.selectedPages}
          onPageClick={handlePageClick}
          isLoading={isLoadingPages || isLoadingPdf}
        />
      </div>
    </div>
  );
}
