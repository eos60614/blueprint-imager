'use client';

export function HelpText() {
  return (
    <div className="text-sm text-gray-500 space-y-1">
      <p className="font-medium">Page selection format:</p>
      <ul className="list-disc list-inside space-y-0.5 text-gray-400">
        <li>
          Single pages: <code className="bg-gray-100 px-1 rounded">3, 7, 15</code>
        </li>
        <li>
          Ranges: <code className="bg-gray-100 px-1 rounded">1-10</code>
        </li>
        <li>
          Combined: <code className="bg-gray-100 px-1 rounded">1-5, 8, 12-15</code>
        </li>
      </ul>
    </div>
  );
}
