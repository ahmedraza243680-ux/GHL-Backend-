export default function PeakwaHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white px-6 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
        style={{ backgroundColor: '#6366F1' }}
      >
        P
      </div>
      <h1 className="text-4xl font-black tracking-tight text-gray-900 md:text-6xl">
        Powered by Peakwa
      </h1>
      <p className="mt-4 max-w-lg text-lg text-gray-600">
        Business websites built automatically, premium, unique, and ready for your customers.
      </p>
    </main>
  );
}
