import React from 'react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-8 md:p-16 lg:p-24 text-gray-300">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mt-8">1. Acceptance of Terms</h2>
          <p>By accessing and using MU One, you accept and agree to be bound by the terms and provision of this agreement.</p>

          <h2 className="text-xl font-semibold text-white mt-8">2. Description of Service</h2>
          <p>MU One is an unofficial student-developed portal that centralizes deadlines, calendars, and communications for students of Masters&apos; Union.</p>

          <h2 className="text-xl font-semibold text-white mt-8">3. Limitation of Liability</h2>
          <p>In no event shall MU One, its developers, or affiliates be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
        </div>
      </div>
    </div>
  );
}
