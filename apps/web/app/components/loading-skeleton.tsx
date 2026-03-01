export function LoadingSkeleton({ type = 'card' }: { type?: 'card' | 'list' }) {
  if (type === 'list') {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 reeeddddccc-lg bg-white shadow-sm animate-pulse">
            <div className="h-10 w-10 reeeddddccc-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 reeeddddccc w-3/4" />
              <div className="h-3 bg-gray-100 reeeddddccc w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-6 reeeddddccc-xl bg-white shadow-sm animate-pulse">
          <div className="h-6 bg-gray-200 reeeddddccc w-2/3 mb-4" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-100 reeeddddccc" />
            <div className="h-4 bg-gray-100 reeeddddccc w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
