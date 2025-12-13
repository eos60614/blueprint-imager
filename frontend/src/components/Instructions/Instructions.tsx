'use client';

interface InstructionsProps {
  expanded?: boolean;
}

export function Instructions({ expanded = false }: InstructionsProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-blue-800 mb-2">How to use</h3>
      <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
        <li>Upload a PDF file (max 100MB) containing mechanical drawings</li>
        <li>Select which pages to convert using ranges or individual numbers</li>
        <li>Click convert to process the selected pages</li>
        <li>Download the ZIP file containing tiled images</li>
      </ol>

      {expanded && (
        <div className="mt-4 pt-3 border-t border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Page selection syntax
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>
              <code className="bg-blue-100 px-1 rounded">1-5</code> - Pages 1
              through 5
            </li>
            <li>
              <code className="bg-blue-100 px-1 rounded">3, 7, 12</code> -
              Individual pages
            </li>
            <li>
              <code className="bg-blue-100 px-1 rounded">1-5, 8, 12-15</code> -
              Combine ranges and individual pages
            </li>
          </ul>

          <h4 className="text-sm font-medium text-blue-800 mt-3 mb-2">
            Output format
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>600 DPI PNG images (RGB, lossless)</li>
            <li>1920x1920 pixel tiles with 250px overlap</li>
            <li>Optimized for YOLO training datasets</li>
          </ul>
        </div>
      )}
    </div>
  );
}
