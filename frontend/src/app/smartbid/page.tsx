import type { Metadata } from 'next';
import { SmartBidTracker } from '@/components/smartbid/SmartBidTracker';

export const metadata: Metadata = {
  title: 'SmartBid | Term 3 Elective Bid Tracker — MU One',
  description:
    "Live Term 3 elective bidding tracker for Masters' Union students: seats, bids, seat cutoffs and a bid planner. No login required.",
  openGraph: {
    title: 'SmartBid — Term 3 Elective Bid Tracker',
    description: 'Live bids, seats and seat cutoffs for every Term 3 elective. Free, no login.',
    url: 'https://muone.live/smartbid',
    siteName: 'MU One',
  },
};

export default function SmartBidPage() {
  return <SmartBidTracker />;
}
