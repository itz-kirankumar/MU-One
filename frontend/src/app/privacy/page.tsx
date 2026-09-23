import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-8 md:p-16 lg:p-24 text-gray-300">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mt-8">1. Information we collect</h2>
          <p>We collect information you provide directly to us, such as when you create or modify your account, use our services, request customer support, or otherwise communicate with us. This includes data from your Google Calendar, Tasks, and Gmail as explicitly authorized by you.</p>

          <h2 className="text-xl font-semibold text-white mt-8">2. How we use your information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services. Specifically, to surface your academic deadlines, classes, and important Masters&apos; Union announcements in one dashboard.</p>

          <h2 className="text-xl font-semibold text-white mt-8">3. Data Security and Transparency</h2>
          <p>MU One is a student-developed initiative. We store minimal data (such as sync tokens) on our secure servers, and the majority of operations happen locally or directly via the Google APIs. You can revoke access at any time from your Google Account settings or from the MU One dashboard.</p>
        </div>
      </div>
    </div>
  );
}
